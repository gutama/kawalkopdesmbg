import { desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { deliveries, type DeliveryStatus } from '@/db/schema';
import {
  extractQrToken,
  getDeliveryPassById,
  type DeliveryPassView,
} from '@/lib/dispatch';

/** Allowed forward state transitions for a delivery dispatch. */
const VALID_STATUS_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  DRAFT: ['DISPATCHED'],
  DISPATCHED: ['VERIFIED', 'REJECTED'],
  VERIFIED: [],
  REJECTED: [],
};

/** Quantity comparison outcome when an SPPG kitchen inspects a delivered line item. */
export type ItemInspectionStatus = 'MATCH' | 'SHORTAGE' | 'SURPLUS';

/** Detailed quantity comparison for a single inspected line item. */
export interface ItemInspectionEvaluation {
  readonly dispatchedQuantity: number;
  readonly receivedQuantity: number;
  readonly deviation: number;
  readonly status: ItemInspectionStatus;
  readonly hasDiscrepancy: boolean;
  readonly label: string;
}

/** Input item shape for validating the SPPG receiving inspection checklist. */
export interface ItemInspectionInput {
  readonly itemId: number;
  readonly commodityName: string;
  readonly unit: string;
  readonly dispatchedQuantity: number;
  readonly receivedQuantity: number;
  readonly checked: boolean;
}

/** Validation outcome for the SPPG receiving inspection checklist. */
export type InspectionChecklistValidationResult =
  | {
      readonly success: true;
      readonly items: readonly ItemInspectionInput[];
      readonly hasAnyDiscrepancy: boolean;
      readonly generatedNote: string;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

/** Lookup outcome when searching for a delivery by QR token. */
export type DeliveryLookupResult =
  | { readonly success: true; readonly delivery: DeliveryPassView }
  | { readonly success: false; readonly error: string };

/**
 * Checks whether a delivery can legally transition from `currentStatus` to `targetStatus`.
 * Once `VERIFIED` or `REJECTED`, the delivery is in an immutable terminal state.
 */
export function canTransitionDeliveryStatus(
  currentStatus: DeliveryStatus,
  targetStatus: DeliveryStatus,
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

/**
 * Evaluates the physical quantity received at the SPPG kitchen against the
 * quantity stated on the cooperative's *Surat Jalan Digital*.
 */
export function evaluateItemInspection(
  dispatchedQuantity: number,
  receivedQuantity: number,
): ItemInspectionEvaluation {
  const deviation = Math.round((receivedQuantity - dispatchedQuantity) * 100) / 100;

  if (deviation === 0) {
    return {
      dispatchedQuantity,
      receivedQuantity,
      deviation: 0,
      status: 'MATCH',
      hasDiscrepancy: false,
      label: 'Sesuai Surat Jalan',
    };
  }

  if (deviation < 0) {
    return {
      dispatchedQuantity,
      receivedQuantity,
      deviation,
      status: 'SHORTAGE',
      hasDiscrepancy: true,
      label: `Selisih Kurang (${deviation})`,
    };
  }

  return {
    dispatchedQuantity,
    receivedQuantity,
    deviation,
    status: 'SURPLUS',
    hasDiscrepancy: true,
    label: `Selisih Lebih (+${deviation})`,
  };
}

/**
 * Validates that every line item in the delivery has been physically inspected
 * (`checked === true`) and has a non-negative received quantity, producing an
 * audit summary note of any quantity deviations.
 */
export function validateInspectionChecklist(
  items: readonly ItemInspectionInput[],
): InspectionChecklistValidationResult {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      error: 'Tidak ada item komoditas untuk diperiksa pada Surat Jalan ini.',
    };
  }

  const discrepancyLines: string[] = [];
  for (const item of items) {
    if (!item.checked) {
      return {
        success: false,
        error: `Harap centang pemeriksaan fisik untuk komoditas ${item.commodityName}.`,
      };
    }
    if (!Number.isFinite(item.receivedQuantity) || item.receivedQuantity < 0) {
      return {
        success: false,
        error: `Jumlah diterima untuk ${item.commodityName} tidak boleh negatif.`,
      };
    }

    const evaluation = evaluateItemInspection(
      item.dispatchedQuantity,
      item.receivedQuantity,
    );
    if (evaluation.hasDiscrepancy) {
      discrepancyLines.push(
        `${item.commodityName}: diterima ${item.receivedQuantity} ${item.unit} dari ${item.dispatchedQuantity} ${item.unit} (${evaluation.label})`,
      );
    }
  }

  const hasAnyDiscrepancy = discrepancyLines.length > 0;
  const generatedNote = hasAnyDiscrepancy
    ? `Catatan selisih pemeriksaan: ${discrepancyLines.join('; ')}.`
    : 'Seluruh komoditas diterima lengkap sesuai takaran Surat Jalan Digital.';

  return {
    success: true,
    items,
    hasAnyDiscrepancy,
    generatedNote,
  };
}

/**
 * Looks up a delivery dispatch by its QR token (or verification URL containing the token)
 * so the SPPG receiving team can inspect its items.
 */
export async function lookupDeliveryByQrToken(
  db: AppDatabase,
  rawInput: string,
): Promise<DeliveryLookupResult> {
  const token = extractQrToken(rawInput);
  if (!token) {
    return {
      success: false,
      error: 'Masukkan atau pindai kode token QR Surat Jalan terlebih dahulu.',
    };
  }

  const found = db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.qrToken, token))
    .get();

  if (!found) {
    return {
      success: false,
      error: `Surat Jalan dengan token "${token}" tidak ditemukan. Pastikan kode QR benar.`,
    };
  }

  const pass = await getDeliveryPassById(db, found.id);
  if (!pass) {
    return {
      success: false,
      error: 'Data Surat Jalan tidak dapat dimuat.',
    };
  }

  return {
    success: true,
    delivery: pass,
  };
}

/**
 * Lists deliveries headed to an SPPG central kitchen, prioritizing active `DISPATCHED`
 * shipments followed by recently `VERIFIED` deliveries.
 */
export async function listKitchenDeliveries(
  db: AppDatabase,
  kitchenId: number = 1,
): Promise<DeliveryPassView[]> {
  const rows = db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.kitchenId, kitchenId))
    .orderBy(desc(deliveries.id))
    .all();

  const passes: DeliveryPassView[] = [];
  for (const row of rows) {
    const pass = await getDeliveryPassById(db, row.id);
    if (pass && pass.status !== 'DRAFT') {
      passes.push(pass);
    }
  }

  // Prioritize DISPATCHED deliveries at the top of the receiving queue
  return passes.sort((a, b) => {
    if (a.status === 'DISPATCHED' && b.status !== 'DISPATCHED') return -1;
    if (a.status !== 'DISPATCHED' && b.status === 'DISPATCHED') return 1;
    return b.id - a.id;
  });
}
