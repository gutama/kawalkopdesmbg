import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { AppDatabase } from '@/db/client';
import {
  commodities,
  cooperatives,
  deliveries,
  deliveryItems,
  farmers,
  kitchens,
  proofOfDelivery,
  type Commodity,
  type DeliveryStatus,
} from '@/db/schema';
import {
  calculateLineTotal,
  evaluateFairPrice,
  type FairPriceEvaluation,
} from '@/lib/procurement';
import { canPerformAction, type UserRole } from '@/lib/session';

/** Line item input for creating a new delivery dispatch order. */
export interface DispatchItemInput {
  readonly commodityId: number;
  readonly farmerId?: number | null;
  readonly quantity: number;
  readonly unitPrice: number;
}

/** Input payload for creating a cooperative delivery dispatch order. */
export interface CreateDispatchInput {
  readonly cooperativeId: number;
  readonly kitchenId: number;
  readonly scheduledDate: string;
  readonly items: readonly DispatchItemInput[];
}

/** Validation outcome for a delivery dispatch order payload. */
export type DispatchValidationResult =
  | { readonly success: true; readonly data: CreateDispatchInput }
  | { readonly success: false; readonly error: string };

/** Enriched line item inside a digital delivery pass (`Surat Jalan Digital`). */
export interface DeliveryPassLineItem {
  readonly id: number;
  readonly commodityId: number;
  readonly commodityName: string;
  readonly unit: Commodity['unit'];
  readonly benchmarkPrice: number;
  readonly farmerId: number | null;
  readonly farmerName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalValue: number;
  readonly evaluation: FairPriceEvaluation;
}

/** Complete data model for rendering a digital delivery pass (`Surat Jalan Digital`). */
export interface DeliveryPassView {
  readonly id: number;
  readonly qrToken: string;
  readonly qrCodeDataUrl: string;
  readonly status: DeliveryStatus;
  readonly scheduledDate: string;
  readonly dispatchedAtIso: string | null;
  readonly cooperativeId: number;
  readonly cooperativeName: string;
  readonly cooperativeLocation: string;
  readonly cooperativeContact: string | null;
  readonly kitchenId: number;
  readonly kitchenName: string;
  readonly kitchenAddress: string;
  readonly items: readonly DeliveryPassLineItem[];
  readonly totalValue: number;
  readonly receiverName: string | null;
  readonly verifiedAtIso: string | null;
}

/** Request payload for creating a delivery dispatch via service or Server Action. */
export interface CreateDeliveryDispatchRequest extends CreateDispatchInput {
  readonly role: UserRole;
}

/** Result returned when creating a delivery dispatch order. */
export type CreateDeliveryDispatchResult =
  | { readonly success: true; readonly dispatch: DeliveryPassView }
  | { readonly success: false; readonly error: string };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Generates a unique, cryptographically random QR security token for a
 * cooperative delivery dispatch (`Surat Jalan Digital`).
 */
export function generateDispatchQrToken(
  cooperativeId: number,
  scheduledDate: string,
): string {
  const cleanDate = scheduledDate.replace(/[^0-9]/g, '').slice(0, 8) || '00000000';
  const randomHex = crypto.randomBytes(12).toString('hex');
  return `mbg_coop${cooperativeId}_${cleanDate}_${randomHex}`;
}

/**
 * Extracts a `mbg_...` QR security token from either a raw token string
 * or a verification URL (e.g. `https://.../sppg?token=mbg_...`).
 */
export function extractQrToken(rawPayload: string): string | null {
  if (typeof rawPayload !== 'string') {
    return null;
  }
  const trimmed = rawPayload.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const tokenParam = url.searchParams.get('token');
      if (tokenParam && tokenParam.trim().length > 0) {
        return tokenParam.trim();
      }
    }
  } catch {
    // Fall through to regex/raw extraction
  }

  const match = trimmed.match(/mbg_[a-zA-Z0-9_]+/);
  return match ? match[0] : trimmed;
}

/** Generates a high-contrast PNG Data URL QR code for the given token or payload. */
export async function generateQrCodeDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: {
      dark: '#064e3b', // deep emerald-950 for outdoor contrast
      light: '#ffffff',
    },
  });
}

/** Validates the input payload for creating a cooperative delivery dispatch order. */
export function validateDispatchInput(
  raw: Partial<CreateDispatchInput>,
): DispatchValidationResult {
  const cooperativeId = Number(raw.cooperativeId);
  const kitchenId = Number(raw.kitchenId);
  const scheduledDate = typeof raw.scheduledDate === 'string' ? raw.scheduledDate.trim() : '';

  if (!Number.isInteger(cooperativeId) || cooperativeId <= 0) {
    return { success: false, error: 'Pilih koperasi pengirim yang valid.' };
  }
  if (!Number.isInteger(kitchenId) || kitchenId <= 0) {
    return { success: false, error: 'Pilih Dapur SPPG tujuan pengiriman.' };
  }
  if (!ISO_DATE_PATTERN.test(scheduledDate)) {
    return {
      success: false,
      error: 'Tanggal pengiriman harus berformat YYYY-MM-DD.',
    };
  }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return {
      success: false,
      error: 'Tambahkan minimal satu komoditas pangan ke dalam Surat Jalan.',
    };
  }

  const normalizedItems: DispatchItemInput[] = [];
  for (const item of raw.items) {
    const commodityId = Number(item.commodityId);
    const farmerId =
      item.farmerId !== undefined && item.farmerId !== null ? Number(item.farmerId) : null;
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (!Number.isInteger(commodityId) || commodityId <= 0) {
      return { success: false, error: 'Pilih komoditas pangan yang valid.' };
    }
    if (farmerId !== null && (!Number.isInteger(farmerId) || farmerId <= 0)) {
      return { success: false, error: 'Data petani pemasok tidak valid.' };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'Jumlah pengiriman setiap komoditas harus > 0.' };
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { success: false, error: 'Harga satuan setiap komoditas harus > Rp 0.' };
    }

    normalizedItems.push({
      commodityId,
      farmerId,
      quantity: Math.round(quantity * 100) / 100,
      unitPrice: Math.round(unitPrice),
    });
  }

  return {
    success: true,
    data: {
      cooperativeId,
      kitchenId,
      scheduledDate,
      items: normalizedItems,
    },
  };
}

/** Builds a single `DeliveryPassView` (including generated QR code Data URL) for a delivery ID. */
export async function getDeliveryPassById(
  db: AppDatabase,
  deliveryId: number,
): Promise<DeliveryPassView | null> {
  const deliveryRow = db
    .select({
      id: deliveries.id,
      qrToken: deliveries.qrToken,
      status: deliveries.status,
      scheduledDate: deliveries.scheduledDate,
      dispatchedAt: deliveries.dispatchedAt,
      cooperativeId: cooperatives.id,
      cooperativeName: cooperatives.name,
      cooperativeVillage: cooperatives.village,
      cooperativeDistrict: cooperatives.district,
      cooperativeRegency: cooperatives.regency,
      cooperativeContactName: cooperatives.contactName,
      cooperativeContactPhone: cooperatives.contactPhone,
      kitchenId: kitchens.id,
      kitchenName: kitchens.name,
      kitchenAddress: kitchens.address,
      receiverName: proofOfDelivery.receiverName,
      verifiedAt: proofOfDelivery.verifiedAt,
    })
    .from(deliveries)
    .innerJoin(cooperatives, eq(deliveries.cooperativeId, cooperatives.id))
    .innerJoin(kitchens, eq(deliveries.kitchenId, kitchens.id))
    .leftJoin(proofOfDelivery, eq(proofOfDelivery.deliveryId, deliveries.id))
    .where(eq(deliveries.id, deliveryId))
    .get();

  if (!deliveryRow) {
    return null;
  }

  const itemRows = db
    .select({
      id: deliveryItems.id,
      commodityId: commodities.id,
      commodityName: commodities.name,
      unit: commodities.unit,
      benchmarkPrice: commodities.benchmarkPrice,
      farmerId: deliveryItems.farmerId,
      farmerName: farmers.name,
      quantity: deliveryItems.quantity,
      unitPrice: deliveryItems.unitPrice,
      totalValue: deliveryItems.totalValue,
    })
    .from(deliveryItems)
    .innerJoin(commodities, eq(deliveryItems.commodityId, commodities.id))
    .leftJoin(farmers, eq(deliveryItems.farmerId, farmers.id))
    .where(eq(deliveryItems.deliveryId, deliveryRow.id))
    .all();

  const items: DeliveryPassLineItem[] = itemRows.map((item) => ({
    id: item.id,
    commodityId: item.commodityId,
    commodityName: item.commodityName,
    unit: item.unit,
    benchmarkPrice: item.benchmarkPrice,
    farmerId: item.farmerId,
    farmerName: item.farmerName ?? 'Gabungan Petani Desa',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalValue: item.totalValue,
    evaluation: evaluateFairPrice(item.unitPrice, item.benchmarkPrice),
  }));

  const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);
  const qrCodeDataUrl = await generateQrCodeDataUrl(deliveryRow.qrToken);

  return {
    id: deliveryRow.id,
    qrToken: deliveryRow.qrToken,
    qrCodeDataUrl,
    status: deliveryRow.status,
    scheduledDate: deliveryRow.scheduledDate,
    dispatchedAtIso: deliveryRow.dispatchedAt ? deliveryRow.dispatchedAt.toISOString() : null,
    cooperativeId: deliveryRow.cooperativeId,
    cooperativeName: deliveryRow.cooperativeName,
    cooperativeLocation: `${deliveryRow.cooperativeVillage}, ${deliveryRow.cooperativeDistrict}, ${deliveryRow.cooperativeRegency}`,
    cooperativeContact: deliveryRow.cooperativeContactName
      ? `${deliveryRow.cooperativeContactName}${
          deliveryRow.cooperativeContactPhone ? ` (${deliveryRow.cooperativeContactPhone})` : ''
        }`
      : null,
    kitchenId: deliveryRow.kitchenId,
    kitchenName: deliveryRow.kitchenName,
    kitchenAddress: deliveryRow.kitchenAddress,
    items,
    totalValue,
    receiverName: deliveryRow.receiverName ?? null,
    verifiedAtIso: deliveryRow.verifiedAt ? deliveryRow.verifiedAt.toISOString() : null,
  };
}

/** Lists all delivery dispatches (with QR code passes) for a cooperative, newest first. */
export async function getCooperativeDispatches(
  db: AppDatabase,
  cooperativeId: number = 1,
): Promise<DeliveryPassView[]> {
  const rows = db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.cooperativeId, cooperativeId))
    .orderBy(desc(deliveries.id))
    .all();

  const passes: DeliveryPassView[] = [];
  for (const row of rows) {
    const pass = await getDeliveryPassById(db, row.id);
    if (pass) {
      passes.push(pass);
    }
  }
  return passes;
}

/**
 * Creates a new `DISPATCHED` delivery order with its line items and generates
 * a digital QR delivery pass (`Surat Jalan Digital`).
 */
export async function createDeliveryDispatch(
  db: AppDatabase,
  request: CreateDeliveryDispatchRequest,
): Promise<CreateDeliveryDispatchResult> {
  if (!canPerformAction(request.role, 'CREATE_DISPATCH')) {
    return {
      success: false,
      error:
        'Hanya Pengurus Koperasi (KOPERASI_ADMIN) yang dapat menerbitkan Surat Jalan pengiriman.',
    };
  }

  const validation = validateDispatchInput(request);
  if (!validation.success) {
    return validation;
  }

  const { cooperativeId, kitchenId, scheduledDate, items } = validation.data;

  const cooperative = db
    .select()
    .from(cooperatives)
    .where(eq(cooperatives.id, cooperativeId))
    .get();
  if (!cooperative) {
    return { success: false, error: 'Koperasi pengirim tidak ditemukan.' };
  }

  const kitchen = db.select().from(kitchens).where(eq(kitchens.id, kitchenId)).get();
  if (!kitchen) {
    return { success: false, error: 'Dapur SPPG tujuan tidak ditemukan.' };
  }

  const qrToken = generateDispatchQrToken(cooperative.id, scheduledDate);

  let createdDeliveryId = 0;
  const runTx = db.$client.transaction(() => {
    const insertedDelivery = db
      .insert(deliveries)
      .values({
        cooperativeId: cooperative.id,
        kitchenId: kitchen.id,
        scheduledDate,
        status: 'DISPATCHED',
        qrToken,
        dispatchedAt: new Date(),
      })
      .returning()
      .get();

    createdDeliveryId = insertedDelivery.id;

    db.insert(deliveryItems)
      .values(
        items.map((item) => ({
          deliveryId: insertedDelivery.id,
          commodityId: item.commodityId,
          farmerId: item.farmerId ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalValue: calculateLineTotal(item.quantity, item.unitPrice),
        })),
      )
      .run();
  });

  runTx();

  const pass = await getDeliveryPassById(db, createdDeliveryId);
  if (!pass) {
    return { success: false, error: 'Gagal memuat Surat Jalan Digital.' };
  }

  return {
    success: true,
    dispatch: pass,
  };
}
