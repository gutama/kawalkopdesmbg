// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { seedDatabase } from '@/db/seed';
import {
  filterPublicTransparencySnapshot,
  formatPublicFarmerAttribution,
  getPublicTransparencySnapshot,
} from '@/lib/transparency';
import { createTestDatabase } from './helpers/db';

describe('Phase 5 Public Transparency Aggregations & Privacy Queries', () => {
  it('formats privacy-safe farmer attribution without exposing full last names or phones', () => {
    expect(
      formatPublicFarmerAttribution('Pak Asep Sunandar', 'Desa Cibogo', 'Desa Fallback'),
    ).toBe('Pak Asep S. (Desa Cibogo)');
    expect(
      formatPublicFarmerAttribution('Ibu Ratna Ningsih', 'Desa Kalikidang', 'Desa Fallback'),
    ).toBe('Ibu Ratna N. (Desa Kalikidang)');
    expect(formatPublicFarmerAttribution('Slamet Riyadi', 'Desa Sokaraja', 'Desa Fallback')).toBe(
      'Slamet R. (Desa Sokaraja)',
    );
    expect(formatPublicFarmerAttribution(null, null, 'Desa Cibogo')).toBe(
      'Gabungan Petani (Desa Cibogo)',
    );
  });

  it('aggregates live KPIs, commodity breakdown, and verified deliveries from seeded SQLite data', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const snapshot = getPublicTransparencySnapshot(db);

    // Seed has 3 public deliveries (2 VERIFIED + 1 DISPATCHED; 1 DRAFT is excluded)
    expect(snapshot.deliveries).toHaveLength(3);
    expect(snapshot.kpis.totalDeliveriesCount).toBe(3);
    expect(snapshot.kpis.verifiedDeliveriesCount).toBe(2);
    expect(snapshot.kpis.verificationRatePercent).toBe(67);

    // Funds:
    // Subang Verified: 250*13400 (3,350,000) + 90*27800 (2,502,000) + 180*3500 (630,000) = 6,482,000
    // Banyumas Verified: 300*13500 (4,050,000) + 120*35800 (4,296,000) + 150*15900 (2,385,000) = 10,731,000
    // Subang Dispatched: 200*13500 (2,700,000) + 80*36000 (2,880,000) = 5,580,000
    expect(snapshot.kpis.verifiedFundsChanneledIdr).toBe(17213000);
    expect(snapshot.kpis.inTransitFundsIdr).toBe(5580000);
    expect(snapshot.kpis.totalFundsChanneledIdr).toBe(22793000);

    // Volume & weight:
    // Weight (kg): Beras (250+300+200=750) + Telur (90) + Ayam (120+80=200) = 1040 kg
    // Other units: Bayam (180 ikat) + Susu (150 liter) -> Total volume = 1370
    expect(snapshot.kpis.totalWeightKg).toBe(1040);
    expect(snapshot.kpis.totalProduceVolume).toBe(1370);

    // Participating entities:
    expect(snapshot.kpis.participatingCooperativesCount).toBe(2);
    expect(snapshot.kpis.participatingFarmersCount).toBe(4);
    expect(snapshot.kpis.supportedKitchensCount).toBe(2);
    expect(snapshot.kpis.totalDailyMealCapacity).toBe(7000);
    expect(snapshot.kpis.overallFairPriceCompliancePercent).toBe(100);

    // Commodity breakdown sorted by value:
    expect(snapshot.commodityBreakdown).toHaveLength(5);
    expect(snapshot.commodityBreakdown[0].commodityName).toBe('Beras Medium');
    expect(snapshot.commodityBreakdown[0].totalQuantity).toBe(750);

    db.$client.close();
  });

  it('excludes DRAFT deliveries and strips all personal phone numbers from public snapshot', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const snapshot = getPublicTransparencySnapshot(db);
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain('DRAFT');
    // Verify none of the seeded cooperative or farmer phone numbers leak into public view
    expect(serialized).not.toContain('0812-2345-6781');
    expect(serialized).not.toContain('0813-2890-4412');
    expect(serialized).not.toContain('0852-1109-2231');
    expect(serialized).not.toContain('0853-2291-7740');
    expect(serialized).not.toContain('0815-4201-9981');
    expect(serialized).not.toContain('0816-7732-5510');

    db.$client.close();
  });

  it('filters snapshot accurately by cooperative, kitchen, status, and search query', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const fullSnapshot = getPublicTransparencySnapshot(db);

    // Filter by Subang cooperative (id = 1)
    const subangOnly = filterPublicTransparencySnapshot(fullSnapshot, {
      cooperativeId: 1,
    });
    expect(subangOnly.deliveries).toHaveLength(2);
    expect(subangOnly.kpis.totalFundsChanneledIdr).toBe(6482000 + 5580000);
    expect(subangOnly.kpis.participatingCooperativesCount).toBe(1);

    // Filter by Banyumas kitchen (id = 2)
    const banyumasKitchenOnly = filterPublicTransparencySnapshot(fullSnapshot, {
      kitchenId: 2,
    });
    expect(banyumasKitchenOnly.deliveries).toHaveLength(1);
    expect(banyumasKitchenOnly.deliveries[0].cooperativeName).toContain('Sokaraja');

    // Filter by status = VERIFIED
    const verifiedOnly = filterPublicTransparencySnapshot(fullSnapshot, {
      status: 'VERIFIED',
    });
    expect(verifiedOnly.deliveries).toHaveLength(2);
    expect(verifiedOnly.kpis.inTransitFundsIdr).toBe(0);
    expect(verifiedOnly.kpis.verificationRatePercent).toBe(100);

    // Filter by search query matching commodity "Susu Sapi"
    const milkSearch = filterPublicTransparencySnapshot(fullSnapshot, {
      searchQuery: 'susu sapi',
    });
    expect(milkSearch.deliveries).toHaveLength(1);
    expect(milkSearch.deliveries[0].cooperativeRegency).toBe('Kabupaten Banyumas');

    db.$client.close();
  });
});
