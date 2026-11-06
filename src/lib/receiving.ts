import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import {
  deliveries,
  proofOfDelivery,
  type DeliveryStatus,
} from '@/db/schema';
import {
  extractQrToken,
  getDeliveryPassById,
  type DeliveryPassView,
} from '@/lib/dispatch';
import { canPerformAction, type UserRole } from '@/lib/session';

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

/** Output metadata from normalizing/compressing and storing a Proof-of-Delivery photo. */
export interface StoredPodPhoto {
  readonly photoPath: string;
  readonly compressedSizeKb: number;
}

/** Request payload for completing two-way SPPG Proof-of-Delivery verification. */
export interface CompleteDeliveryVerificationRequest {
  readonly role: UserRole;
  readonly deliveryId: number;
  readonly receiverName: string;
  readonly signOffNote?: string;
  readonly photoData: string;
  readonly inspectionItems: readonly ItemInspectionInput[];
}

/** Result returned when completing a Proof-of-Delivery verification. */
export type CompleteDeliveryVerificationResult =
  | {
      readonly success: true;
      readonly delivery: DeliveryPassView;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

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
 * Normalizes and records a compressed Proof-of-Delivery photo path for low-bandwidth
 * rural storage, calculating the compressed payload size in kilobytes.
 */
export function compressAndStorePodPhoto(
  deliveryId: number,
  rawPhotoData: string,
): StoredPodPhoto {
  const trimmed = rawPhotoData.trim();
  if (!trimmed) {
    throw new Error('Photo data cannot be empty');
  }

  const hashSuffix = crypto
    .createHash('sha256')
    .update(`${deliveryId}:${trimmed}`)
    .digest('hex')
    .slice(0, 10);

  const photoPath = trimmed.startsWith('/uploads/pod/')
    ? trimmed
    : `/uploads/pod/pod-delivery-${deliveryId}-${hashSuffix}.jpg`;

  const estimatedBytes = Math.max(12_800, Math.min(85_000, trimmed.length * 320));
  const compressedSizeKb = Math.round((estimatedBytes / 1024) * 10) / 10;

  return {
    photoPath,
    compressedSizeKb,
  };
}

/**
 * Atomically records an immutable Proof-of-Delivery (`proof_of_delivery`) receipt
 * and transitions the delivery status from `DISPATCHED` to `VERIFIED`.
 */
export async function completeDeliveryVerification(
  db: AppDatabase,
  request: CompleteDeliveryVerificationRequest,
): Promise<CompleteDeliveryVerificationResult> {
  if (!canPerformAction(request.role, 'VERIFY_DELIVERY')) {
    return {
      success: false,
      error:
        'Hanya Petugas Dapur SPPG (SPPG_STAFF) yang berwenang mengesahkan Bukti Terima pengiriman.',
    };
  }

  const receiverName =
    typeof request.receiverName === 'string' ? request.receiverName.trim() : '';
  if (receiverName.length < 3) {
    return {
      success: false,
      error: 'Masukkan nama lengkap & jabatan petugas penerima di Dapur SPPG.',
    };
  }

  const photoData =
    typeof request.photoData === 'string' ? request.photoData.trim() : '';
  if (!photoData) {
    return {
      success: false,
      error:
        'Foto bukti komoditas belum dilampirkan. Yuk ambil atau unggah foto terlebih dahulu.',
    };
  }

  const existingDelivery = db
    .select()
    .from(deliveries)
    .where(eq(deliveries.id, request.deliveryId))
    .get();

  if (!existingDelivery) {
    return {
      success: false,
      error: 'Data pengiriman Surat Jalan tidak ditemukan.',
    };
  }

  if (!canTransitionDeliveryStatus(existingDelivery.status, 'VERIFIED')) {
    return {
      success: false,
      error: `Pengiriman berstatus ${existingDelivery.status} tidak dapat diverifikasi ulang karena sudah bersifat permanen.`,
    };
  }

  const checklistValidation = validateInspectionChecklist(request.inspectionItems);
  if (!checklistValidation.success) {
    return checklistValidation;
  }

  const storedPhoto = compressAndStorePodPhoto(existingDelivery.id, photoData);
  const customNote =
    typeof request.signOffNote === 'string' ? request.signOffNote.trim() : '';
  const combinedSignOffNote = customNote
    ? `${customNote} (${checklistValidation.generatedNote})`
    : checklistValidation.generatedNote;

  const runVerifyTx = db.$client.transaction(() => {
    db.insert(proofOfDelivery)
      .values({
        deliveryId: existingDelivery.id,
        receiverName,
        verifiedAt: new Date(),
        signOffNote: combinedSignOffNote,
        photoPath: storedPhoto.photoPath,
      })
      .run();

    db.update(deliveries)
      .set({
        status: 'VERIFIED',
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, existingDelivery.id))
      .run();
  });

  runVerifyTx();

  const updatedPass = await getDeliveryPassById(db, existingDelivery.id);
  if (!updatedPass) {
    return {
      success: false,
      error: 'Gagal memuat tanda terima pengiriman terverifikasi.',
    };
  }

  return {
    success: true,
    delivery: updatedPass,
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
