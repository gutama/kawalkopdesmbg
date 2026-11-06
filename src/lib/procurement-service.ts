import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import {
  commodities,
  cooperatives,
  deliveries,
  deliveryItems,
  farmers,
  kitchens,
  type Commodity,
  type Cooperative,
  type DeliveryStatus,
  type Farmer,
  type Kitchen,
} from '@/db/schema';
import { seedDatabase } from '@/db/seed';
import {
  calculateLineTotal,
  evaluateFairPrice,
  summarizeProcurementItems,
  validateProcurementInput,
  type FairPriceEvaluation,
  type ProcurementInput,
  type ProcurementSummary,
} from '@/lib/procurement';
import { canPerformAction, type UserRole } from '@/lib/session';

/** Enriched procurement line item with farmer, commodity, and fair-price benchmark evaluation. */
export interface ProcurementLedgerItem {
  readonly id: number;
  readonly deliveryId: number;
  readonly deliveryStatus: DeliveryStatus;
  readonly scheduledDate: string;
  readonly commodityId: number;
  readonly commodityName: string;
  readonly unit: Commodity['unit'];
  readonly benchmarkPrice: number;
  readonly farmerId: number | null;
  readonly farmerName: string;
  readonly farmerVillage: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalValue: number;
  readonly evaluation: FairPriceEvaluation;
}

/** Complete workspace payload for the Cooperative Procurement & Dispatch portal. */
export interface CooperativeProcurementWorkspace {
  readonly cooperative: Cooperative;
  readonly cooperatives: readonly Cooperative[];
  readonly kitchens: readonly Kitchen[];
  readonly farmers: readonly Farmer[];
  readonly commodities: readonly Commodity[];
  readonly items: readonly ProcurementLedgerItem[];
  readonly summary: ProcurementSummary;
}

/** Request payload for recording a local farmer produce procurement entry. */
export interface RecordFarmerProcurementRequest extends ProcurementInput {
  readonly role: UserRole;
}

/** Result returned when recording a local farmer produce procurement entry. */
export type RecordFarmerProcurementResult =
  | {
      readonly success: true;
      readonly item: ProcurementLedgerItem;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

/** Ensures the database has migrations applied and seed data loaded before serving requests. */
export function ensureInitializedDatabase(db: AppDatabase): void {
  runMigrations(db);
  seedDatabase(db);
}

/**
 * Loads the procurement workspace for a specific village cooperative, including
 * its affiliated farmers, regional commodity benchmarks, recorded procurement items,
 * and aggregated fairness metrics.
 */
export function getCooperativeProcurementWorkspace(
  db: AppDatabase,
  cooperativeId: number = 1,
): CooperativeProcurementWorkspace {
  const allCooperatives = db.select().from(cooperatives).all();
  const activeCooperative =
    allCooperatives.find((coop) => coop.id === cooperativeId) ?? allCooperatives[0];

  if (!activeCooperative) {
    throw new Error('No cooperatives found in database.');
  }

  const allKitchens = db.select().from(kitchens).all();
  const coopFarmers = db
    .select()
    .from(farmers)
    .where(eq(farmers.cooperativeId, activeCooperative.id))
    .all();
  const allCommodities = db.select().from(commodities).all();

  const rows = db
    .select({
      id: deliveryItems.id,
      deliveryId: deliveryItems.deliveryId,
      deliveryStatus: deliveries.status,
      scheduledDate: deliveries.scheduledDate,
      commodityId: commodities.id,
      commodityName: commodities.name,
      unit: commodities.unit,
      benchmarkPrice: commodities.benchmarkPrice,
      farmerId: deliveryItems.farmerId,
      farmerName: farmers.name,
      farmerVillage: farmers.village,
      quantity: deliveryItems.quantity,
      unitPrice: deliveryItems.unitPrice,
      totalValue: deliveryItems.totalValue,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
    .innerJoin(commodities, eq(deliveryItems.commodityId, commodities.id))
    .leftJoin(farmers, eq(deliveryItems.farmerId, farmers.id))
    .where(eq(deliveries.cooperativeId, activeCooperative.id))
    .orderBy(desc(deliveryItems.id))
    .all();

  const items: ProcurementLedgerItem[] = rows.map((row) => ({
    id: row.id,
    deliveryId: row.deliveryId,
    deliveryStatus: row.deliveryStatus,
    scheduledDate: row.scheduledDate,
    commodityId: row.commodityId,
    commodityName: row.commodityName,
    unit: row.unit,
    benchmarkPrice: row.benchmarkPrice,
    farmerId: row.farmerId,
    farmerName: row.farmerName ?? 'Gabungan Petani Desa',
    farmerVillage: row.farmerVillage ?? activeCooperative.village,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    totalValue: row.totalValue,
    evaluation: evaluateFairPrice(row.unitPrice, row.benchmarkPrice),
  }));

  const summary = summarizeProcurementItems(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      benchmarkPrice: item.benchmarkPrice,
    })),
  );

  return {
    cooperative: activeCooperative,
    cooperatives: allCooperatives,
    kitchens: allKitchens,
    farmers: coopFarmers,
    commodities: allCommodities,
    items,
    summary,
  };
}

/**
 * Records a new commodity procurement from a local farmer into the cooperative's
 * active `DRAFT` delivery pool (creating a `DRAFT` delivery record if none exists).
 */
export function recordFarmerProcurement(
  db: AppDatabase,
  request: RecordFarmerProcurementRequest,
): RecordFarmerProcurementResult {
  if (!canPerformAction(request.role, 'RECORD_PROCUREMENT')) {
    return {
      success: false,
      error:
        'Hanya Pengurus Koperasi (KOPERASI_ADMIN) yang dapat mencatat pengadaan hasil tani.',
    };
  }

  const validation = validateProcurementInput(request);
  if (!validation.success) {
    return validation;
  }

  const { cooperativeId, farmerId, commodityId, quantity, unitPrice } = validation.data;

  const cooperative = db
    .select()
    .from(cooperatives)
    .where(eq(cooperatives.id, cooperativeId))
    .get();
  if (!cooperative) {
    return { success: false, error: 'Data koperasi tidak ditemukan.' };
  }

  const farmer = db.select().from(farmers).where(eq(farmers.id, farmerId)).get();
  if (!farmer || farmer.cooperativeId !== cooperative.id) {
    return {
      success: false,
      error: 'Petani yang dipilih tidak terdaftar pada koperasi ini.',
    };
  }

  const commodity = db
    .select()
    .from(commodities)
    .where(eq(commodities.id, commodityId))
    .get();
  if (!commodity) {
    return { success: false, error: 'Komoditas pangan tidak ditemukan.' };
  }

  const totalValue = calculateLineTotal(quantity, unitPrice);
  const evaluation = evaluateFairPrice(unitPrice, commodity.benchmarkPrice);

  // Locate an existing DRAFT delivery for this cooperative or create one linked to a regional kitchen
  const existingDraft = db
    .select()
    .from(deliveries)
    .where(eq(deliveries.cooperativeId, cooperative.id))
    .all()
    .find((delivery) => delivery.status === 'DRAFT');

  let targetDelivery = existingDraft;
  if (!targetDelivery) {
    const allKitchens = db.select().from(kitchens).all();
    const matchingKitchen =
      allKitchens.find((kitchen) => kitchen.regency === cooperative.regency) ??
      allKitchens[0];

    if (!matchingKitchen) {
      return { success: false, error: 'Belum ada Dapur SPPG tujuan yang terdaftar.' };
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const qrToken = `mbg_draft_${cooperative.id}_${todayIso.replace(/-/g, '')}_${randomSuffix}`;

    targetDelivery = db
      .insert(deliveries)
      .values({
        cooperativeId: cooperative.id,
        kitchenId: matchingKitchen.id,
        scheduledDate: todayIso,
        status: 'DRAFT',
        qrToken,
      })
      .returning()
      .get();
  }

  const insertedItem = db
    .insert(deliveryItems)
    .values({
      deliveryId: targetDelivery.id,
      commodityId: commodity.id,
      farmerId: farmer.id,
      quantity,
      unitPrice,
      totalValue,
    })
    .returning()
    .get();

  return {
    success: true,
    item: {
      id: insertedItem.id,
      deliveryId: targetDelivery.id,
      deliveryStatus: targetDelivery.status,
      scheduledDate: targetDelivery.scheduledDate,
      commodityId: commodity.id,
      commodityName: commodity.name,
      unit: commodity.unit,
      benchmarkPrice: commodity.benchmarkPrice,
      farmerId: farmer.id,
      farmerName: farmer.name,
      farmerVillage: farmer.village,
      quantity: insertedItem.quantity,
      unitPrice: insertedItem.unitPrice,
      totalValue: insertedItem.totalValue,
      evaluation,
    },
  };
}
