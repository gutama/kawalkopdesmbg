// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { seedDatabase } from '@/db/seed';
import {
  compressAndStoreReportPhoto,
  filterWhistleblowerSnapshot,
  getPublicWhistleblowerSnapshot,
  maskReporterIdentity,
  submitCommunityReport,
  triageCommunityReport,
} from '@/lib/whistleblower';
import { createTestDatabase } from './helpers/db';

describe('Whistleblower Service & Privacy Layer', () => {
  it('masks reporter names when non-anonymous and returns Pelapor Anonim when anonymous', () => {
    expect(maskReporterIdentity('Ibu Rina Marlina', true)).toBe('Pelapor Anonim');
    expect(maskReporterIdentity(null, false)).toBe('Pelapor Anonim');
    expect(maskReporterIdentity('', false)).toBe('Pelapor Anonim');
    expect(maskReporterIdentity('Ibu Rina Marlina', false)).toBe('Ibu R*** M***');
    expect(maskReporterIdentity('Pak Slamet Riyadi', false)).toBe('Pak S*** R***');
    expect(maskReporterIdentity('Andi Wijaya', false)).toBe('A*** W***');
  });

  it('generates deterministic /uploads/reports/ paths for compressed photo evidence', () => {
    expect(compressAndStoreReportPhoto('kualitas_pangan', null)).toBeNull();
    expect(compressAndStoreReportPhoto('kualitas_pangan', '   ')).toBeNull();
    expect(
      compressAndStoreReportPhoto('kualitas_pangan', '/uploads/reports/existing.jpg'),
    ).toBe('/uploads/reports/existing.jpg');

    const pathA = compressAndStoreReportPhoto(
      'kualitas_pangan',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    );
    const pathB = compressAndStoreReportPhoto(
      'kualitas_pangan',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    );
    expect(pathA).toMatch(/^\/uploads\/reports\/report-kualitas-pangan-[a-f0-9]{10}\.jpg$/);
    expect(pathA).toBe(pathB);
  });

  it('aggregates seeded community reports and strips all reporter contact numbers', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const snapshot = getPublicWhistleblowerSnapshot(db);
    expect(snapshot.reports).toHaveLength(3);
    expect(snapshot.kpis).toEqual({
      totalReportsCount: 3,
      openReportsCount: 1,
      inProgressReportsCount: 1,
      resolvedReportsCount: 1,
      highSeverityCount: 1,
      resolutionRatePercent: 33,
    });

    const serialized = JSON.stringify(snapshot);
    // Ensure seeded reporterContact phone numbers never leak to public view
    expect(serialized).not.toContain('0812-9001-3344');
    expect(serialized).not.toContain('0857-4411-8899');
    expect(serialized).not.toContain('0815-4201-9981');
    // Ensure full unmasked names do not leak
    expect(serialized).not.toContain('Rina Marlina');
    expect(serialized).toContain('Ibu R*** M***');
    expect(serialized).toContain('Pelapor Anonim');

    db.$client.close();
  });

  it('filters whistleblower snapshot by category, status, cooperative, delivery, and search query', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    const full = getPublicWhistleblowerSnapshot(db);

    const byCategory = filterWhistleblowerSnapshot(full, {
      category: 'KUALITAS_PANGAN',
    });
    expect(byCategory.reports).toHaveLength(1);
    expect(byCategory.kpis.resolvedReportsCount).toBe(1);

    const byStatus = filterWhistleblowerSnapshot(full, { status: 'BARU' });
    expect(byStatus.reports).toHaveLength(1);
    expect(byStatus.reports[0].cooperativeRegency).toBe('Kabupaten Banyumas');

    const byQuery = filterWhistleblowerSnapshot(full, { searchQuery: 'jembatan' });
    expect(byQuery.reports).toHaveLength(1);
    expect(byQuery.reports[0].severity).toBe('HIGH');

    db.$client.close();
  });

  it('submits a community report, auto-links delivery context, and enforces triage permissions', () => {
    const db = createTestDatabase();
    seedDatabase(db);

    // Validation check on short title
    const invalidSubmit = submitCommunityReport(db, {
      role: 'PUBLIC_OBSERVER',
      category: 'SELISIH_KUANTITAS',
      severity: 'HIGH',
      reporterRoleLabel: 'Warga / Orang Tua Siswa',
      isAnonymous: true,
      title: 'Pend',
      description: 'Terlalu pendek judulnya.',
    });
    expect(invalidSubmit.success).toBe(false);

    // Valid anonymous submission linked to delivery #1
    const submitted = submitCommunityReport(db, {
      role: 'PUBLIC_OBSERVER',
      category: 'SELISIH_KUANTITAS',
      severity: 'HIGH',
      reporterRoleLabel: 'Warga / Orang Tua Siswa',
      reporterName: 'Bapak Dedi Kusuma',
      reporterContact: '0819-5555-1234',
      isAnonymous: true,
      deliveryId: 1,
      title: 'Selisih berat bersih beras di karung pengiriman Subang',
      description:
        'Saat ditimbang ulang di dapur SPPG Subang Kota, dua karung beras berkurang sekitar 3 kg dari label.',
      photoData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==',
    });

    expect(submitted.success).toBe(true);
    if (!submitted.success) return;

    expect(submitted.report.status).toBe('BARU');
    expect(submitted.report.reporterDisplayName).toBe('Pelapor Anonim');
    expect(submitted.report.cooperativeId).toBe(1);
    expect(submitted.report.kitchenId).toBe(1);
    expect(submitted.report.photoPath).toContain('/uploads/reports/');
    expect(JSON.stringify(submitted.report)).not.toContain('0819-5555-1234');
    expect(JSON.stringify(submitted.report)).not.toContain('Dedi Kusuma');

    // Public observer cannot triage reports
    const unauthorizedTriage = triageCommunityReport(db, {
      role: 'PUBLIC_OBSERVER',
      reportId: submitted.report.id,
      newStatus: 'DITINDAKLANJUTI',
      responseNote: 'Mencoba ubah status tanpa hak akses.',
      respondedBy: 'Anonim',
    });
    expect(unauthorizedTriage.success).toBe(false);

    // Koperasi Admin triages to DITINDAKLANJUTI
    const inProgressTriage = triageCommunityReport(db, {
      role: 'KOPERASI_ADMIN',
      reportId: submitted.report.id,
      newStatus: 'DITINDAKLANJUTI',
      responseNote: 'Tim gudang koperasi sedang melakukan timbang ulang karung cadangan.',
      respondedBy: 'Pak Tatang Ruhiyat (Koperasi Desa Merah Putih Cibogo)',
    });
    expect(inProgressTriage.success).toBe(true);
    if (!inProgressTriage.success) return;
    expect(inProgressTriage.report.status).toBe('DITINDAKLANJUTI');
    expect(inProgressTriage.report.resolvedAtIso).toBeNull();

    // SPPG Staff resolves report to SELESAI
    const resolvedTriage = triageCommunityReport(db, {
      role: 'SPPG_STAFF',
      reportId: submitted.report.id,
      newStatus: 'SELESAI',
      responseNote: 'Kekurangan 3 kg beras telah diganti dan diverifikasi ulang oleh kepala dapur.',
      respondedBy: 'Ibu Siti Aminah (SPPG Dapur Gizi Subang Kota)',
    });
    expect(resolvedTriage.success).toBe(true);
    if (!resolvedTriage.success) return;
    expect(resolvedTriage.report.status).toBe('SELESAI');
    expect(resolvedTriage.report.resolvedAtIso).not.toBeNull();

    db.$client.close();
  });
});
