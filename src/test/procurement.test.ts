import { describe, expect, it } from 'vitest';
import {
  calculateLineTotal,
  evaluateFairPrice,
  formatRupiah,
  summarizeProcurementItems,
  validateProcurementInput,
} from '@/lib/procurement';

describe('Commodity Procurement Calculations & Fair Price Benchmark Comparison', () => {
  describe('formatRupiah', () => {
    it('formats whole Rupiah amounts with Indonesian thousand separators', () => {
      expect(formatRupiah(13500)).toBe('Rp 13.500');
      expect(formatRupiah(3350000)).toBe('Rp 3.350.000');
      expect(formatRupiah(0)).toBe('Rp 0');
    });

    it('handles negative Rupiah differences cleanly', () => {
      expect(formatRupiah(-500)).toBe('-Rp 500');
    });
  });

  describe('calculateLineTotal', () => {
    it('computes rounded Rupiah total for integer and fractional quantities', () => {
      expect(calculateLineTotal(250, 13400)).toBe(3350000);
      expect(calculateLineTotal(12.5, 28000)).toBe(350000);
      expect(calculateLineTotal(1.333, 13500)).toBe(17996);
    });

    it('returns 0 when quantity or unitPrice is non-positive or non-finite', () => {
      expect(calculateLineTotal(0, 13500)).toBe(0);
      expect(calculateLineTotal(-5, 13500)).toBe(0);
      expect(calculateLineTotal(10, 0)).toBe(0);
      expect(calculateLineTotal(Number.NaN, 13500)).toBe(0);
    });
  });

  describe('evaluateFairPrice', () => {
    it('marks price as FAIR when equal to regional benchmark price', () => {
      const result = evaluateFairPrice(13500, 13500);
      expect(result.status).toBe('FAIR');
      expect(result.isFairForFarmer).toBe(true);
      expect(result.difference).toBe(0);
      expect(result.percentageDiff).toBe(0);
      expect(result.label).toContain('Harga Wajar');
    });

    it('marks price as FAIR when within the -5% to +10% fair tolerance band', () => {
      // -0.74% (e.g., Rp 13.400 vs Rp 13.500 benchmark in Subang seed data)
      const slightlyBelow = evaluateFairPrice(13400, 13500);
      expect(slightlyBelow.status).toBe('FAIR');
      expect(slightlyBelow.isFairForFarmer).toBe(true);
      expect(slightlyBelow.difference).toBe(-100);
      expect(slightlyBelow.percentageDiff).toBeCloseTo(-0.74, 2);

      // Exactly -5% boundary (95% of 20.000 = 19.000)
      const lowerBoundary = evaluateFairPrice(19000, 20000);
      expect(lowerBoundary.status).toBe('FAIR');
      expect(lowerBoundary.isFairForFarmer).toBe(true);

      // +5% above benchmark (21.000 vs 20.000)
      const slightlyAbove = evaluateFairPrice(21000, 20000);
      expect(slightlyAbove.status).toBe('FAIR');
      expect(slightlyAbove.isFairForFarmer).toBe(true);
      expect(slightlyAbove.percentageDiff).toBe(5);
    });

    it('marks price as BELOW_BENCHMARK when more than 5% below benchmark (farmer underpaid)', () => {
      const underpaid = evaluateFairPrice(11500, 13500);
      expect(underpaid.status).toBe('BELOW_BENCHMARK');
      expect(underpaid.isFairForFarmer).toBe(false);
      expect(underpaid.difference).toBe(-2000);
      expect(underpaid.percentageDiff).toBeCloseTo(-14.81, 2);
      expect(underpaid.label).toContain('Di Bawah Acuan');
    });

    it('marks price as ABOVE_BENCHMARK when more than 10% above regional benchmark', () => {
      const overpriced = evaluateFairPrice(16000, 13500);
      expect(overpriced.status).toBe('ABOVE_BENCHMARK');
      expect(overpriced.isFairForFarmer).toBe(true);
      expect(overpriced.difference).toBe(2500);
      expect(overpriced.percentageDiff).toBeCloseTo(18.52, 2);
      expect(overpriced.label).toContain('Di Atas Acuan');
    });

    it('throws an error if benchmarkPrice or unitPrice is non-positive', () => {
      expect(() => evaluateFairPrice(0, 13500)).toThrow(/unitPrice/i);
      expect(() => evaluateFairPrice(13500, 0)).toThrow(/benchmarkPrice/i);
    });
  });

  describe('summarizeProcurementItems', () => {
    it('aggregates totals and fairness counts across multiple procurement items', () => {
      const summary = summarizeProcurementItems([
        { quantity: 200, unitPrice: 13500, benchmarkPrice: 13500 }, // FAIR: 2,700,000
        { quantity: 100, unitPrice: 27800, benchmarkPrice: 28000 }, // FAIR: 2,780,000 (benchmark 2,800,000)
        { quantity: 50, unitPrice: 30000, benchmarkPrice: 36000 }, // BELOW_BENCHMARK: 1,500,000 (benchmark 1,800,000)
        { quantity: 40, unitPrice: 20000, benchmarkPrice: 16000 }, // ABOVE_BENCHMARK: 800,000 (benchmark 640,000)
      ]);

      expect(summary.totalItems).toBe(4);
      expect(summary.totalQuantity).toBe(390);
      expect(summary.totalValue).toBe(7780000);
      expect(summary.totalBenchmarkValue).toBe(7940000);
      expect(summary.fairItemsCount).toBe(2);
      expect(summary.belowBenchmarkCount).toBe(1);
      expect(summary.aboveBenchmarkCount).toBe(1);
      expect(summary.overallFairnessRatio).toBe(75); // 3 of 4 items are fair for the farmer
    });

    it('returns clean zeroes and 100% fairness ratio for an empty list', () => {
      const emptySummary = summarizeProcurementItems([]);
      expect(emptySummary).toEqual({
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
        totalBenchmarkValue: 0,
        fairItemsCount: 0,
        belowBenchmarkCount: 0,
        aboveBenchmarkCount: 0,
        overallFairnessRatio: 100,
      });
    });
  });

  describe('validateProcurementInput', () => {
    it('validates a well-formed procurement record input', () => {
      const valid = validateProcurementInput({
        cooperativeId: 1,
        farmerId: 1,
        commodityId: 1,
        quantity: 150,
        unitPrice: 13500,
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.quantity).toBe(150);
        expect(valid.data.unitPrice).toBe(13500);
      }
    });

    it('rejects invalid cooperative, farmer, commodity, quantity, or unitPrice', () => {
      expect(
        validateProcurementInput({
          cooperativeId: 0,
          farmerId: 1,
          commodityId: 1,
          quantity: 100,
          unitPrice: 13500,
        }).success,
      ).toBe(false);

      expect(
        validateProcurementInput({
          cooperativeId: 1,
          farmerId: 0,
          commodityId: 1,
          quantity: 100,
          unitPrice: 13500,
        }).success,
      ).toBe(false);

      expect(
        validateProcurementInput({
          cooperativeId: 1,
          farmerId: 1,
          commodityId: 0,
          quantity: 100,
          unitPrice: 13500,
        }).success,
      ).toBe(false);

      expect(
        validateProcurementInput({
          cooperativeId: 1,
          farmerId: 1,
          commodityId: 1,
          quantity: -10,
          unitPrice: 13500,
        }).success,
      ).toBe(false);

      expect(
        validateProcurementInput({
          cooperativeId: 1,
          farmerId: 1,
          commodityId: 1,
          quantity: 100,
          unitPrice: 0,
        }).success,
      ).toBe(false);
    });
  });
});
