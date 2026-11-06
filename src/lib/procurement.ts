/**
 * Pure domain calculations and fair-price benchmark comparisons for
 * village cooperative (Koperasi Desa) farmer commodity procurement.
 */

export type FairPriceStatus = 'FAIR' | 'BELOW_BENCHMARK' | 'ABOVE_BENCHMARK';

/** Minimum ratio of unitPrice / benchmarkPrice considered fair to the farmer (95%). */
export const FAIR_PRICE_MIN_RATIO = 0.95;

/** Maximum ratio of unitPrice / benchmarkPrice before triggering a regional budget warning (110%). */
export const FAIR_PRICE_MAX_RATIO = 1.1;

/** Detailed comparison between cooperative purchase price and regional government benchmark price. */
export interface FairPriceEvaluation {
  readonly unitPrice: number;
  readonly benchmarkPrice: number;
  readonly difference: number;
  readonly percentageDiff: number;
  readonly ratio: number;
  readonly status: FairPriceStatus;
  readonly isFairForFarmer: boolean;
  readonly label: string;
  readonly message: string;
}

/** Input item shape for aggregating procurement totals and fairness metrics. */
export interface ProcurementSummaryInputItem {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly benchmarkPrice: number;
}

/** Aggregated metrics across a collection of recorded farmer procurement items. */
export interface ProcurementSummary {
  readonly totalItems: number;
  readonly totalQuantity: number;
  readonly totalValue: number;
  readonly totalBenchmarkValue: number;
  readonly fairItemsCount: number;
  readonly belowBenchmarkCount: number;
  readonly aboveBenchmarkCount: number;
  readonly overallFairnessRatio: number;
}

/** Input payload for recording a local farmer commodity procurement item. */
export interface ProcurementInput {
  readonly cooperativeId: number;
  readonly farmerId: number;
  readonly commodityId: number;
  readonly quantity: number;
  readonly unitPrice: number;
}

/** Validation outcome for a procurement input payload. */
export type ProcurementValidationResult =
  | { readonly success: true; readonly data: ProcurementInput }
  | { readonly success: false; readonly error: string };

/** Formats a whole Rupiah integer with Indonesian thousand separators (e.g. `Rp 13.500`). */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    return 'Rp 0';
  }
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-Rp ${absFormatted}` : `Rp ${absFormatted}`;
}

/** Computes the rounded line total in whole Rupiah (`round(quantity * unitPrice)`). */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPrice) ||
    quantity <= 0 ||
    unitPrice <= 0
  ) {
    return 0;
  }
  return Math.round(quantity * unitPrice);
}

/**
 * Compares the unit price paid to a local farmer against the regional
 * government benchmark price (`Harga Acuan Pemerintah Daerah`).
 */
export function evaluateFairPrice(
  unitPrice: number,
  benchmarkPrice: number,
): FairPriceEvaluation {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('unitPrice must be a positive number');
  }
  if (!Number.isFinite(benchmarkPrice) || benchmarkPrice <= 0) {
    throw new Error('benchmarkPrice must be a positive number');
  }

  const difference = Math.round(unitPrice - benchmarkPrice);
  const ratio = unitPrice / benchmarkPrice;
  const percentageDiff = Math.round(((unitPrice - benchmarkPrice) / benchmarkPrice) * 10000) / 100;

  if (ratio < FAIR_PRICE_MIN_RATIO) {
    return {
      unitPrice,
      benchmarkPrice,
      difference,
      percentageDiff,
      ratio,
      status: 'BELOW_BENCHMARK',
      isFairForFarmer: false,
      label: 'Di Bawah Acuan Petani',
      message:
        'Harga beli lebih rendah >5% dari acuan daerah. Yuk sesuaikan agar petani desa memperoleh kompensasi yang adil.',
    };
  }

  if (ratio > FAIR_PRICE_MAX_RATIO) {
    return {
      unitPrice,
      benchmarkPrice,
      difference,
      percentageDiff,
      ratio,
      status: 'ABOVE_BENCHMARK',
      isFairForFarmer: true,
      label: 'Di Atas Acuan Daerah',
      message:
        'Harga beli melampaui +10% dari acuan daerah. Pastikan tetap sesuai pagu anggaran SPPG.',
    };
  }

  return {
    unitPrice,
    benchmarkPrice,
    difference,
    percentageDiff,
    ratio,
    status: 'FAIR',
    isFairForFarmer: true,
    label: 'Harga Wajar Petani',
    message:
      'Harga beli koperasi sesuai rentang wajar acuan pemerintah daerah dan menguntungkan petani lokal.',
  };
}

/** Aggregates quantities, Rupiah totals, and fair-price compliance across procurement items. */
export function summarizeProcurementItems(
  items: readonly ProcurementSummaryInputItem[],
): ProcurementSummary {
  if (items.length === 0) {
    return {
      totalItems: 0,
      totalQuantity: 0,
      totalValue: 0,
      totalBenchmarkValue: 0,
      fairItemsCount: 0,
      belowBenchmarkCount: 0,
      aboveBenchmarkCount: 0,
      overallFairnessRatio: 100,
    };
  }

  let totalQuantity = 0;
  let totalValue = 0;
  let totalBenchmarkValue = 0;
  let fairItemsCount = 0;
  let belowBenchmarkCount = 0;
  let aboveBenchmarkCount = 0;

  for (const item of items) {
    totalQuantity += item.quantity;
    totalValue += calculateLineTotal(item.quantity, item.unitPrice);
    totalBenchmarkValue += calculateLineTotal(item.quantity, item.benchmarkPrice);

    const evaluation = evaluateFairPrice(item.unitPrice, item.benchmarkPrice);
    if (evaluation.status === 'FAIR') {
      fairItemsCount += 1;
    } else if (evaluation.status === 'BELOW_BENCHMARK') {
      belowBenchmarkCount += 1;
    } else {
      aboveBenchmarkCount += 1;
    }
  }

  const fairForFarmerCount = fairItemsCount + aboveBenchmarkCount;
  const overallFairnessRatio = Math.round((fairForFarmerCount / items.length) * 100);

  return {
    totalItems: items.length,
    totalQuantity: Math.round(totalQuantity * 100) / 100,
    totalValue,
    totalBenchmarkValue,
    fairItemsCount,
    belowBenchmarkCount,
    aboveBenchmarkCount,
    overallFairnessRatio,
  };
}

/** Validates user input before recording a local farmer procurement transaction. */
export function validateProcurementInput(
  raw: Partial<ProcurementInput>,
): ProcurementValidationResult {
  const cooperativeId = Number(raw.cooperativeId);
  const farmerId = Number(raw.farmerId);
  const commodityId = Number(raw.commodityId);
  const quantity = Number(raw.quantity);
  const unitPrice = Number(raw.unitPrice);

  if (!Number.isInteger(cooperativeId) || cooperativeId <= 0) {
    return { success: false, error: 'Pilih koperasi desa yang valid.' };
  }
  if (!Number.isInteger(farmerId) || farmerId <= 0) {
    return { success: false, error: 'Pilih petani lokal pemasok komoditas.' };
  }
  if (!Number.isInteger(commodityId) || commodityId <= 0) {
    return { success: false, error: 'Pilih komoditas pangan yang diserap.' };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      success: false,
      error: 'Jumlah pasokan harus lebih besar dari 0.',
    };
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return {
      success: false,
      error: 'Harga beli per satuan harus lebih besar dari Rp 0.',
    };
  }

  return {
    success: true,
    data: {
      cooperativeId,
      farmerId,
      commodityId,
      quantity: Math.round(quantity * 100) / 100,
      unitPrice: Math.round(unitPrice),
    },
  };
}
