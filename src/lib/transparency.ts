import { desc, eq, inArray } from 'drizzle-orm';
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
  evaluateFairPrice,
  type FairPriceEvaluation,
  type FairPriceStatus,
} from '@/lib/procurement';

/** Filter parameters for slicing the Public Transparency Dashboard dataset. */
export interface PublicTransparencyFilter {
  readonly cooperativeId?: number | null;
  readonly kitchenId?: number | null;
  readonly status?: 'ALL' | 'VERIFIED' | 'DISPATCHED';
  readonly searchQuery?: string;
}

/** Public-safe cooperative option for regional filtering (no phone numbers). */
export interface PublicCooperativeOption {
  readonly id: number;
  readonly name: string;
  readonly village: string;
  readonly district: string;
  readonly regency: string;
  readonly province: string;
}

/** Public-safe SPPG kitchen option for regional filtering. */
export interface PublicKitchenOption {
  readonly id: number;
  readonly name: string;
  readonly regency: string;
  readonly province: string;
  readonly dailyCapacity: number;
  readonly serviceArea: string | null;
}

/** Top-level aggregated KPI metrics displayed on the Public Transparency Dashboard. */
export interface PublicKpiMetrics {
  /** Total Rupiah value across all public (VERIFIED + DISPATCHED) deliveries. */
  readonly totalFundsChanneledIdr: number;
  /** Total Rupiah value confirmed via SPPG Proof-of-Delivery sign-off. */
  readonly verifiedFundsChanneledIdr: number;
  /** Total Rupiah value currently in transit (DISPATCHED). */
  readonly inTransitFundsIdr: number;
  /** Total volume across all commodity units (kg, liter, ikat, butir). */
  readonly totalProduceVolume: number;
  /** Total weight of weight-measured (`kg`) commodities absorbed. */
  readonly totalWeightKg: number;
  /** Count of participating village cooperatives in the filtered view. */
  readonly participatingCooperativesCount: number;
  /** Count of distinct local farmers contributing to public deliveries. */
  readonly participatingFarmersCount: number;
  /** Count of SPPG central kitchens receiving deliveries. */
  readonly supportedKitchensCount: number;
  /** Combined daily meal capacity of active SPPG kitchens in the view. */
  readonly totalDailyMealCapacity: number;
  /** Total public deliveries (VERIFIED + DISPATCHED). */
  readonly totalDeliveriesCount: number;
  /** Total deliveries with completed two-way QR & photo Proof of Delivery. */
  readonly verifiedDeliveriesCount: number;
  /** Percentage of public deliveries that are VERIFIED (0–100). */
  readonly verificationRatePercent: number;
  /** Percentage of line items meeting or exceeding farmer fair-price benchmarks (0–100). */
  readonly overallFairPriceCompliancePercent: number;
}

/** Aggregated absorption and fair-price metrics for a single commodity. */
export interface CommodityAbsorptionItem {
  readonly commodityId: number;
  readonly commodityName: string;
  readonly unit: Commodity['unit'];
  readonly benchmarkPrice: number;
  readonly totalQuantity: number;
  readonly verifiedQuantity: number;
  readonly totalValueIdr: number;
  readonly averageUnitPriceIdr: number;
  readonly transactionCount: number;
  readonly fairCompliancePercent: number;
  readonly fairEvaluation: FairPriceEvaluation;
}

/** Privacy-safe line item inside a public delivery log entry. */
export interface PublicDeliveryLineItem {
  readonly id: number;
  readonly commodityId: number;
  readonly commodityName: string;
  readonly unit: Commodity['unit'];
  readonly quantity: number;
  readonly unitPrice: number;
  readonly benchmarkPrice: number;
  readonly totalValue: number;
  readonly farmerId: number | null;
  /** Privacy-safe attribution label (e.g. "Pak Asep S. (Desa Cibogo)"). */
  readonly farmerLabel: string;
  readonly fairPriceStatus: FairPriceStatus;
  readonly fairPriceLabel: string;
}

/** Immutable Proof-of-Delivery summary exposed on public verified deliveries. */
export interface PublicProofOfDeliveryView {
  readonly receiverName: string;
  readonly verifiedAtIso: string;
  readonly signOffNote: string | null;
  readonly photoPath: string;
}

/** Public delivery record with obscured personal contact details. */
export interface PublicDeliveryRecord {
  readonly id: number;
  readonly qrToken: string;
  readonly scheduledDate: string;
  readonly status: 'VERIFIED' | 'DISPATCHED';
  readonly dispatchedAtIso: string | null;
  readonly cooperativeId: number;
  readonly cooperativeName: string;
  readonly cooperativeVillage: string;
  readonly cooperativeDistrict: string;
  readonly cooperativeRegency: string;
  readonly cooperativeProvince: string;
  readonly kitchenId: number;
  readonly kitchenName: string;
  readonly kitchenRegency: string;
  readonly kitchenProvince: string;
  readonly kitchenDailyCapacity: number;
  readonly kitchenServiceArea: string | null;
  readonly totalValueIdr: number;
  readonly totalQuantity: number;
  readonly itemsCount: number;
  readonly items: readonly PublicDeliveryLineItem[];
  readonly proofOfDelivery: PublicProofOfDeliveryView | null;
}

/** Complete data payload for rendering and filtering the Public Transparency Dashboard. */
export interface PublicTransparencySnapshot {
  readonly kpis: PublicKpiMetrics;
  readonly commodityBreakdown: readonly CommodityAbsorptionItem[];
  readonly deliveries: readonly PublicDeliveryRecord[];
  readonly cooperatives: readonly PublicCooperativeOption[];
  readonly kitchens: readonly PublicKitchenOption[];
}

/**
 * Formats a privacy-safe farmer attribution string for public audit views.
 * Retains the honorific + first name and village name while omitting full surname
 * and never exposing personal phone numbers.
 */
export function formatPublicFarmerAttribution(
  farmerName: string | null | undefined,
  farmerVillage: string | null | undefined,
  fallbackVillage: string,
): string {
  const village = (farmerVillage ?? fallbackVillage).trim();
  if (!farmerName || !farmerName.trim()) {
    return `Gabungan Petani (${village})`;
  }

  const tokens = farmerName.trim().split(/\s+/);
  const honorifics = new Set(['pak', 'ibu', 'bu', 'bapak', 'kang', 'mas', 'mbak']);

  let shortName = tokens[0];
  if (tokens.length >= 2 && honorifics.has(tokens[0].toLowerCase())) {
    const lastInitial = tokens.length >= 3 ? ` ${tokens[2][0]}.` : '';
    shortName = `${tokens[0]} ${tokens[1]}${lastInitial}`;
  } else if (tokens.length >= 2) {
    shortName = `${tokens[0]} ${tokens[1][0]}.`;
  }

  return `${shortName} (${village})`;
}

/**
 * Computes KPIs and commodity breakdown from a list of `PublicDeliveryRecord` items
 * and reference cooperative/kitchen lists.
 */
export function buildTransparencyAggregations(
  deliveriesList: readonly PublicDeliveryRecord[],
  cooperativesList: readonly PublicCooperativeOption[],
  kitchensList: readonly PublicKitchenOption[],
): Pick<PublicTransparencySnapshot, 'kpis' | 'commodityBreakdown'> {
  let totalFundsChanneledIdr = 0;
  let verifiedFundsChanneledIdr = 0;
  let inTransitFundsIdr = 0;
  let totalProduceVolume = 0;
  let totalWeightKg = 0;
  let verifiedDeliveriesCount = 0;

  const activeCoopIds = new Set<number>();
  const activeKitchenIds = new Set<number>();
  const activeFarmerIds = new Set<number>();

  let totalLineItemsCount = 0;
  let fairLineItemsCount = 0;

  const commodityMap = new Map<
    number,
    {
      commodityId: number;
      commodityName: string;
      unit: Commodity['unit'];
      benchmarkPrice: number;
      totalQuantity: number;
      verifiedQuantity: number;
      totalValueIdr: number;
      transactionCount: number;
      fairCount: number;
    }
  >();

  for (const delivery of deliveriesList) {
    totalFundsChanneledIdr += delivery.totalValueIdr;
    totalProduceVolume += delivery.totalQuantity;
    activeCoopIds.add(delivery.cooperativeId);
    activeKitchenIds.add(delivery.kitchenId);

    if (delivery.status === 'VERIFIED') {
      verifiedDeliveriesCount += 1;
      verifiedFundsChanneledIdr += delivery.totalValueIdr;
    } else {
      inTransitFundsIdr += delivery.totalValueIdr;
    }

    for (const item of delivery.items) {
      totalLineItemsCount += 1;
      if (item.farmerId !== null) {
        activeFarmerIds.add(item.farmerId);
      }
      if (item.unit === 'kg') {
        totalWeightKg += item.quantity;
      }

      const isFair =
        item.fairPriceStatus === 'FAIR' || item.fairPriceStatus === 'ABOVE_BENCHMARK';
      if (isFair) {
        fairLineItemsCount += 1;
      }

      const existing = commodityMap.get(item.commodityId);
      if (existing) {
        existing.totalQuantity =
          Math.round((existing.totalQuantity + item.quantity) * 100) / 100;
        if (delivery.status === 'VERIFIED') {
          existing.verifiedQuantity =
            Math.round((existing.verifiedQuantity + item.quantity) * 100) / 100;
        }
        existing.totalValueIdr += item.totalValue;
        existing.transactionCount += 1;
        if (isFair) {
          existing.fairCount += 1;
        }
      } else {
        commodityMap.set(item.commodityId, {
          commodityId: item.commodityId,
          commodityName: item.commodityName,
          unit: item.unit,
          benchmarkPrice: item.benchmarkPrice,
          totalQuantity: Math.round(item.quantity * 100) / 100,
          verifiedQuantity:
            delivery.status === 'VERIFIED' ? Math.round(item.quantity * 100) / 100 : 0,
          totalValueIdr: item.totalValue,
          transactionCount: 1,
          fairCount: isFair ? 1 : 0,
        });
      }
    }
  }

  const commodityBreakdown: CommodityAbsorptionItem[] = Array.from(
    commodityMap.values(),
  )
    .map((entry) => {
      const averageUnitPriceIdr =
        entry.totalQuantity > 0
          ? Math.round(entry.totalValueIdr / entry.totalQuantity)
          : entry.benchmarkPrice;
      const fairCompliancePercent =
        entry.transactionCount > 0
          ? Math.round((entry.fairCount / entry.transactionCount) * 100)
          : 100;
      return {
        commodityId: entry.commodityId,
        commodityName: entry.commodityName,
        unit: entry.unit,
        benchmarkPrice: entry.benchmarkPrice,
        totalQuantity: entry.totalQuantity,
        verifiedQuantity: entry.verifiedQuantity,
        totalValueIdr: entry.totalValueIdr,
        averageUnitPriceIdr,
        transactionCount: entry.transactionCount,
        fairCompliancePercent,
        fairEvaluation: evaluateFairPrice(averageUnitPriceIdr, entry.benchmarkPrice),
      };
    })
    .sort((a, b) => b.totalValueIdr - a.totalValueIdr);

  const kitchensInScope =
    activeKitchenIds.size > 0
      ? kitchensList.filter((k) => activeKitchenIds.has(k.id))
      : kitchensList;

  const totalDailyMealCapacity = kitchensInScope.reduce(
    (sum, k) => sum + k.dailyCapacity,
    0,
  );

  const totalDeliveriesCount = deliveriesList.length;
  const verificationRatePercent =
    totalDeliveriesCount > 0
      ? Math.round((verifiedDeliveriesCount / totalDeliveriesCount) * 100)
      : 0;

  const overallFairPriceCompliancePercent =
    totalLineItemsCount > 0
      ? Math.round((fairLineItemsCount / totalLineItemsCount) * 100)
      : 100;

  return {
    kpis: {
      totalFundsChanneledIdr,
      verifiedFundsChanneledIdr,
      inTransitFundsIdr,
      totalProduceVolume: Math.round(totalProduceVolume * 100) / 100,
      totalWeightKg: Math.round(totalWeightKg * 100) / 100,
      participatingCooperativesCount:
        activeCoopIds.size > 0 ? activeCoopIds.size : cooperativesList.length,
      participatingFarmersCount: activeFarmerIds.size,
      supportedKitchensCount:
        activeKitchenIds.size > 0 ? activeKitchenIds.size : kitchensList.length,
      totalDailyMealCapacity,
      totalDeliveriesCount,
      verifiedDeliveriesCount,
      verificationRatePercent,
      overallFairPriceCompliancePercent,
    },
    commodityBreakdown,
  };
}

/**
 * Filters a `PublicTransparencySnapshot` in-memory by cooperative, kitchen,
 * delivery status, and free-text search query, recomputing KPIs and commodity
 * breakdown for the matching subset.
 */
export function filterPublicTransparencySnapshot(
  snapshot: PublicTransparencySnapshot,
  filter?: PublicTransparencyFilter,
): PublicTransparencySnapshot {
  if (!filter) {
    return snapshot;
  }

  const coopId =
    filter.cooperativeId && Number.isInteger(filter.cooperativeId) && filter.cooperativeId > 0
      ? filter.cooperativeId
      : null;
  const kitchId =
    filter.kitchenId && Number.isInteger(filter.kitchenId) && filter.kitchenId > 0
      ? filter.kitchenId
      : null;
  const statusFilter =
    filter.status && filter.status !== 'ALL' ? filter.status : null;
  const query = (filter.searchQuery ?? '').trim().toLowerCase();

  const filteredDeliveries = snapshot.deliveries.filter((delivery) => {
    if (coopId !== null && delivery.cooperativeId !== coopId) {
      return false;
    }
    if (kitchId !== null && delivery.kitchenId !== kitchId) {
      return false;
    }
    if (statusFilter !== null && delivery.status !== statusFilter) {
      return false;
    }
    if (query.length > 0) {
      const searchableText = [
        delivery.cooperativeName,
        delivery.cooperativeVillage,
        delivery.cooperativeRegency,
        delivery.kitchenName,
        delivery.kitchenRegency,
        delivery.scheduledDate,
        delivery.qrToken,
        delivery.proofOfDelivery?.receiverName ?? '',
        delivery.proofOfDelivery?.signOffNote ?? '',
        ...delivery.items.map((i) => `${i.commodityName} ${i.farmerLabel}`),
      ]
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const scopedCoops =
    coopId !== null
      ? snapshot.cooperatives.filter((c) => c.id === coopId)
      : snapshot.cooperatives;
  const scopedKitchens =
    kitchId !== null
      ? snapshot.kitchens.filter((k) => k.id === kitchId)
      : snapshot.kitchens;

  const { kpis, commodityBreakdown } = buildTransparencyAggregations(
    filteredDeliveries,
    scopedCoops,
    scopedKitchens,
  );

  return {
    kpis,
    commodityBreakdown,
    deliveries: filteredDeliveries,
    cooperatives: snapshot.cooperatives,
    kitchens: snapshot.kitchens,
  };
}

/**
 * Queries SQLite via Drizzle ORM to build the complete Public Transparency Dashboard
 * snapshot. Only `VERIFIED` and `DISPATCHED` deliveries are included in public audit
 * views (`DRAFT` internal working pools are excluded), and personal contact phone
 * numbers are stripped at the projection layer.
 */
export function getPublicTransparencySnapshot(
  db: AppDatabase,
  filter?: PublicTransparencyFilter,
): PublicTransparencySnapshot {
  const coopRows = db
    .select({
      id: cooperatives.id,
      name: cooperatives.name,
      village: cooperatives.village,
      district: cooperatives.district,
      regency: cooperatives.regency,
      province: cooperatives.province,
    })
    .from(cooperatives)
    .all();

  const kitchenRows = db
    .select({
      id: kitchens.id,
      name: kitchens.name,
      regency: kitchens.regency,
      province: kitchens.province,
      dailyCapacity: kitchens.dailyCapacity,
      serviceArea: kitchens.serviceArea,
    })
    .from(kitchens)
    .all();

  const coopMap = new Map(coopRows.map((c) => [c.id, c]));
  const kitchenMap = new Map(kitchenRows.map((k) => [k.id, k]));

  const publicStatuses: DeliveryStatus[] = ['VERIFIED', 'DISPATCHED'];
  const deliveryRows = db
    .select()
    .from(deliveries)
    .where(inArray(deliveries.status, publicStatuses))
    .orderBy(desc(deliveries.scheduledDate), desc(deliveries.id))
    .all();

  const itemRows = db
    .select({
      id: deliveryItems.id,
      deliveryId: deliveryItems.deliveryId,
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
    .innerJoin(commodities, eq(deliveryItems.commodityId, commodities.id))
    .leftJoin(farmers, eq(deliveryItems.farmerId, farmers.id))
    .all();

  const podRows = db.select().from(proofOfDelivery).all();
  const podByDeliveryId = new Map(podRows.map((p) => [p.deliveryId, p]));

  const itemsByDeliveryId = new Map<number, typeof itemRows>();
  for (const row of itemRows) {
    const group = itemsByDeliveryId.get(row.deliveryId) ?? [];
    group.push(row);
    itemsByDeliveryId.set(row.deliveryId, group);
  }

  const publicDeliveries: PublicDeliveryRecord[] = [];

  for (const delivery of deliveryRows) {
    if (delivery.status !== 'VERIFIED' && delivery.status !== 'DISPATCHED') {
      continue;
    }

    const coop = coopMap.get(delivery.cooperativeId);
    const kitchen = kitchenMap.get(delivery.kitchenId);
    if (!coop || !kitchen) {
      continue;
    }

    const rawItems = itemsByDeliveryId.get(delivery.id) ?? [];
    const lineItems: PublicDeliveryLineItem[] = rawItems.map((item) => {
      const evaluation = evaluateFairPrice(item.unitPrice, item.benchmarkPrice);
      return {
        id: item.id,
        commodityId: item.commodityId,
        commodityName: item.commodityName,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        benchmarkPrice: item.benchmarkPrice,
        totalValue: item.totalValue,
        farmerId: item.farmerId,
        farmerLabel: formatPublicFarmerAttribution(
          item.farmerName,
          item.farmerVillage,
          coop.village,
        ),
        fairPriceStatus: evaluation.status,
        fairPriceLabel: evaluation.label,
      };
    });

    const totalValueIdr = lineItems.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQuantity =
      Math.round(
        lineItems.reduce((sum, item) => sum + item.quantity, 0) * 100,
      ) / 100;

    const pod = podByDeliveryId.get(delivery.id);
    const podView: PublicProofOfDeliveryView | null = pod
      ? {
          receiverName: pod.receiverName,
          verifiedAtIso:
            pod.verifiedAt instanceof Date
              ? pod.verifiedAt.toISOString()
              : new Date(Number(pod.verifiedAt) * 1000).toISOString(),
          signOffNote: pod.signOffNote ?? null,
          photoPath: pod.photoPath,
        }
      : null;

    publicDeliveries.push({
      id: delivery.id,
      qrToken: delivery.qrToken,
      scheduledDate: delivery.scheduledDate,
      status: delivery.status,
      dispatchedAtIso:
        delivery.dispatchedAt instanceof Date
          ? delivery.dispatchedAt.toISOString()
          : null,
      cooperativeId: coop.id,
      cooperativeName: coop.name,
      cooperativeVillage: coop.village,
      cooperativeDistrict: coop.district,
      cooperativeRegency: coop.regency,
      cooperativeProvince: coop.province,
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
      kitchenRegency: kitchen.regency,
      kitchenProvince: kitchen.province,
      kitchenDailyCapacity: kitchen.dailyCapacity,
      kitchenServiceArea: kitchen.serviceArea ?? null,
      totalValueIdr,
      totalQuantity,
      itemsCount: lineItems.length,
      items: lineItems,
      proofOfDelivery: podView,
    });
  }

  const baseAggregations = buildTransparencyAggregations(
    publicDeliveries,
    coopRows,
    kitchenRows,
  );

  const fullSnapshot: PublicTransparencySnapshot = {
    kpis: baseAggregations.kpis,
    commodityBreakdown: baseAggregations.commodityBreakdown,
    deliveries: publicDeliveries,
    cooperatives: coopRows,
    kitchens: kitchenRows,
  };

  return filterPublicTransparencySnapshot(fullSnapshot, filter);
}

const DEFAULT_SEED_COOPERATIVES: readonly PublicCooperativeOption[] = [
  {
    id: 1,
    name: 'Koperasi Desa Merah Putih Cibogo',
    village: 'Desa Cibogo',
    district: 'Kecamatan Cibogo',
    regency: 'Kabupaten Subang',
    province: 'Jawa Barat',
  },
  {
    id: 2,
    name: 'BUMDes Maju Bersama Sokaraja',
    village: 'Desa Sokaraja Tengah',
    district: 'Kecamatan Sokaraja',
    regency: 'Kabupaten Banyumas',
    province: 'Jawa Tengah',
  },
];

const DEFAULT_SEED_KITCHENS: readonly PublicKitchenOption[] = [
  {
    id: 1,
    name: 'SPPG Dapur Gizi Subang Kota',
    regency: 'Kabupaten Subang',
    province: 'Jawa Barat',
    dailyCapacity: 3200,
    serviceArea: 'Kecamatan Subang & Kecamatan Cibogo',
  },
  {
    id: 2,
    name: 'SPPG Satuan Gizi Purwokerto Timur',
    regency: 'Kabupaten Banyumas',
    province: 'Jawa Tengah',
    dailyCapacity: 3800,
    serviceArea: 'Kecamatan Sokaraja & Purwokerto Timur',
  },
];

const DEFAULT_SEED_DELIVERIES: readonly PublicDeliveryRecord[] = [
  {
    id: 3,
    qrToken: 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e',
    scheduledDate: '2026-10-16',
    status: 'DISPATCHED',
    dispatchedAtIso: '2026-10-15T23:30:00.000Z',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    cooperativeVillage: 'Desa Cibogo',
    cooperativeDistrict: 'Kecamatan Cibogo',
    cooperativeRegency: 'Kabupaten Subang',
    cooperativeProvince: 'Jawa Barat',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
    kitchenRegency: 'Kabupaten Subang',
    kitchenProvince: 'Jawa Barat',
    kitchenDailyCapacity: 3200,
    kitchenServiceArea: 'Kecamatan Subang & Kecamatan Cibogo',
    totalValueIdr: 5580000,
    totalQuantity: 280,
    itemsCount: 2,
    items: [
      {
        id: 7,
        commodityId: 1,
        commodityName: 'Beras Medium',
        unit: 'kg',
        quantity: 200,
        unitPrice: 13500,
        benchmarkPrice: 13500,
        totalValue: 2700000,
        farmerId: 1,
        farmerLabel: 'Pak Asep S. (Desa Cibogo)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
      {
        id: 8,
        commodityId: 3,
        commodityName: 'Daging Ayam Ras',
        unit: 'kg',
        quantity: 80,
        unitPrice: 36000,
        benchmarkPrice: 36000,
        totalValue: 2880000,
        farmerId: 2,
        farmerLabel: 'Ibu Ida F. (Desa Padaasih)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
    ],
    proofOfDelivery: null,
  },
  {
    id: 2,
    qrToken: 'mbg_bms_20261015_verified_1a2b3c4d5e6f7a8b9c0d1e',
    scheduledDate: '2026-10-15',
    status: 'VERIFIED',
    dispatchedAtIso: '2026-10-14T23:00:00.000Z',
    cooperativeId: 2,
    cooperativeName: 'BUMDes Maju Bersama Sokaraja',
    cooperativeVillage: 'Desa Sokaraja Tengah',
    cooperativeDistrict: 'Kecamatan Sokaraja',
    cooperativeRegency: 'Kabupaten Banyumas',
    cooperativeProvince: 'Jawa Tengah',
    kitchenId: 2,
    kitchenName: 'SPPG Satuan Gizi Purwokerto Timur',
    kitchenRegency: 'Kabupaten Banyumas',
    kitchenProvince: 'Jawa Tengah',
    kitchenDailyCapacity: 3800,
    kitchenServiceArea: 'Kecamatan Sokaraja & Purwokerto Timur',
    totalValueIdr: 10731000,
    totalQuantity: 570,
    itemsCount: 3,
    items: [
      {
        id: 4,
        commodityId: 1,
        commodityName: 'Beras Medium',
        unit: 'kg',
        quantity: 300,
        unitPrice: 13500,
        benchmarkPrice: 13500,
        totalValue: 4050000,
        farmerId: 3,
        farmerLabel: 'Pak Slamet R. (Desa Sokaraja Tengah)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
      {
        id: 5,
        commodityId: 3,
        commodityName: 'Daging Ayam Ras',
        unit: 'kg',
        quantity: 120,
        unitPrice: 35800,
        benchmarkPrice: 36000,
        totalValue: 4296000,
        farmerId: 4,
        farmerLabel: 'Ibu Ratna N. (Desa Kalikidang)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
      {
        id: 6,
        commodityId: 5,
        commodityName: 'Susu Sapi Pasteurisasi',
        unit: 'liter',
        quantity: 150,
        unitPrice: 15900,
        benchmarkPrice: 16000,
        totalValue: 2385000,
        farmerId: 4,
        farmerLabel: 'Ibu Ratna N. (Desa Kalikidang)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
    ],
    proofOfDelivery: {
      receiverName: 'Pak Hendra Wijaya (Koordinator SPPG Purwokerto)',
      verifiedAtIso: '2026-10-15T00:45:00.000Z',
      signOffNote: 'Semua komoditas lengkap, suhu susu terjaga baik.',
      photoPath: '/uploads/pod/demo-banyumas-20261015.jpg',
    },
  },
  {
    id: 1,
    qrToken: 'mbg_sbg_20261014_verified_8f9a2b3c4d5e6f7a8b9c0d',
    scheduledDate: '2026-10-14',
    status: 'VERIFIED',
    dispatchedAtIso: '2026-10-13T23:15:00.000Z',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    cooperativeVillage: 'Desa Cibogo',
    cooperativeDistrict: 'Kecamatan Cibogo',
    cooperativeRegency: 'Kabupaten Subang',
    cooperativeProvince: 'Jawa Barat',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
    kitchenRegency: 'Kabupaten Subang',
    kitchenProvince: 'Jawa Barat',
    kitchenDailyCapacity: 3200,
    kitchenServiceArea: 'Kecamatan Subang & Kecamatan Cibogo',
    totalValueIdr: 6482000,
    totalQuantity: 520,
    itemsCount: 3,
    items: [
      {
        id: 1,
        commodityId: 1,
        commodityName: 'Beras Medium',
        unit: 'kg',
        quantity: 250,
        unitPrice: 13400,
        benchmarkPrice: 13500,
        totalValue: 3350000,
        farmerId: 1,
        farmerLabel: 'Pak Asep S. (Desa Cibogo)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
      {
        id: 2,
        commodityId: 2,
        commodityName: 'Telur Ayam Ras',
        unit: 'kg',
        quantity: 90,
        unitPrice: 27800,
        benchmarkPrice: 28000,
        totalValue: 2502000,
        farmerId: 2,
        farmerLabel: 'Ibu Ida F. (Desa Padaasih)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
      {
        id: 3,
        commodityId: 4,
        commodityName: 'Sayur Bayam Segar',
        unit: 'ikat',
        quantity: 180,
        unitPrice: 3500,
        benchmarkPrice: 3500,
        totalValue: 630000,
        farmerId: 1,
        farmerLabel: 'Pak Asep S. (Desa Cibogo)',
        fairPriceStatus: 'FAIR',
        fairPriceLabel: 'Harga Wajar Sesuai Acuan',
      },
    ],
    proofOfDelivery: {
      receiverName: 'Ibu Siti Aminah (Kepala Dapur SPPG Subang)',
      verifiedAtIso: '2026-10-14T01:05:00.000Z',
      signOffNote: 'Beras, telur, dan bayam diterima segar sesuai timbangan.',
      photoPath: '/uploads/pod/demo-subang-20261014.jpg',
    },
  },
];

const defaultSeedAggs = buildTransparencyAggregations(
  DEFAULT_SEED_DELIVERIES,
  DEFAULT_SEED_COOPERATIVES,
  DEFAULT_SEED_KITCHENS,
);

/**
 * Deterministic initial snapshot matching the default seeded Subang & Banyumas
 * Kopdes-MBG dataset for zero-latency initial rendering.
 */
export const DEFAULT_PUBLIC_TRANSPARENCY_SNAPSHOT: PublicTransparencySnapshot = {
  kpis: defaultSeedAggs.kpis,
  commodityBreakdown: defaultSeedAggs.commodityBreakdown,
  deliveries: DEFAULT_SEED_DELIVERIES,
  cooperatives: DEFAULT_SEED_COOPERATIVES,
  kitchens: DEFAULT_SEED_KITCHENS,
};
