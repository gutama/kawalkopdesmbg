import { desc, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import {
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  communityReports,
  cooperatives,
  deliveries,
  kitchens,
  type DeliveryStatus,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@/db/schema';
import { canPerformAction, type UserRole } from '@/lib/session';

/** Human-readable Bahasa Indonesia labels for whistleblower report categories. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  KUALITAS_PANGAN: 'Kualitas & Kesegaran Pangan',
  HARGA_PETANI: 'Keadilan Harga Petani Lokal',
  KENDALA_DISTRIBUSI: 'Kendala & Keterlambatan Distribusi',
  SELISIH_KUANTITAS: 'Selisih Timbangan & Kuantitas',
};

/** Human-readable Bahasa Indonesia labels for whistleblower severity levels. */
export const REPORT_SEVERITY_LABELS: Record<ReportSeverity, string> = {
  HIGH: 'Prioritas Tinggi',
  MEDIUM: 'Prioritas Sedang',
  LOW: 'Aspirasi & Masukan',
};

/** Human-readable Bahasa Indonesia labels for report lifecycle statuses. */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  BARU: 'Laporan Baru',
  DITINDAKLANJUTI: 'Sedang Ditindaklanjuti',
  SELESAI: 'Selesai Ditangani',
};

/** Supported reporter role labels for community whistleblower submissions. */
export const REPORTER_ROLE_OPTIONS = [
  'Warga / Orang Tua Siswa',
  'Petani Lokal',
  'Petugas Lapangan',
  'Pelapor Anonim',
] as const;

/** Filter options for slicing the public community whistleblower feed. */
export interface WhistleblowerFilter {
  readonly category?: ReportCategory | 'ALL';
  readonly status?: ReportStatus | 'ALL';
  readonly cooperativeId?: number | null;
  readonly kitchenId?: number | null;
  readonly deliveryId?: number | null;
  readonly searchQuery?: string;
}

/** Public-safe cooperative option for context linking and filtering. */
export interface WhistleblowerCooperativeOption {
  readonly id: number;
  readonly name: string;
  readonly regency: string;
}

/** Public-safe SPPG kitchen option for context linking and filtering. */
export interface WhistleblowerKitchenOption {
  readonly id: number;
  readonly name: string;
  readonly regency: string;
}

/** Public-safe delivery option so reporters can link reports to a specific dispatch. */
export interface WhistleblowerDeliveryOption {
  readonly id: number;
  readonly qrToken: string;
  readonly scheduledDate: string;
  readonly status: 'DISPATCHED' | 'VERIFIED';
  readonly cooperativeId: number;
  readonly cooperativeName: string;
  readonly kitchenId: number;
  readonly kitchenName: string;
}

/** Aggregated KPI summary displayed on the Community Whistleblower Portal. */
export interface WhistleblowerKpiMetrics {
  readonly totalReportsCount: number;
  readonly openReportsCount: number;
  readonly inProgressReportsCount: number;
  readonly resolvedReportsCount: number;
  readonly highSeverityCount: number;
  readonly resolutionRatePercent: number;
}

/** Privacy-safe public projection of a community report (never includes contact numbers). */
export interface PublicCommunityReport {
  readonly id: number;
  readonly category: ReportCategory;
  readonly categoryLabel: string;
  readonly severity: ReportSeverity;
  readonly severityLabel: string;
  readonly status: ReportStatus;
  readonly statusLabel: string;
  readonly reporterRoleLabel: string;
  /** Masked reporter identity (e.g. "Ibu R*** M***" or "Pelapor Anonim"). */
  readonly reporterDisplayName: string;
  readonly isAnonymous: boolean;
  readonly deliveryId: number | null;
  readonly deliveryQrToken: string | null;
  readonly cooperativeId: number | null;
  readonly cooperativeName: string | null;
  readonly cooperativeRegency: string | null;
  readonly kitchenId: number | null;
  readonly kitchenName: string | null;
  readonly kitchenRegency: string | null;
  readonly title: string;
  readonly description: string;
  readonly photoPath: string | null;
  readonly responseNote: string | null;
  readonly respondedBy: string | null;
  readonly resolvedAtIso: string | null;
  readonly createdAtIso: string;
}

/** Complete snapshot payload for rendering and filtering `/laporan`. */
export interface PublicWhistleblowerSnapshot {
  readonly kpis: WhistleblowerKpiMetrics;
  readonly reports: readonly PublicCommunityReport[];
  readonly cooperatives: readonly WhistleblowerCooperativeOption[];
  readonly kitchens: readonly WhistleblowerKitchenOption[];
  readonly deliveries: readonly WhistleblowerDeliveryOption[];
}

/** Input payload for submitting a new community whistleblower or feedback report. */
export interface SubmitCommunityReportInput {
  readonly role: UserRole;
  readonly category: ReportCategory;
  readonly severity: ReportSeverity;
  readonly reporterRoleLabel: string;
  readonly reporterName?: string | null;
  readonly reporterContact?: string | null;
  readonly isAnonymous: boolean;
  readonly deliveryId?: number | null;
  readonly cooperativeId?: number | null;
  readonly kitchenId?: number | null;
  readonly title: string;
  readonly description: string;
  readonly photoData?: string | null;
}

/** Input payload for Koperasi Admin or SPPG Staff triaging a report. */
export interface TriageCommunityReportInput {
  readonly role: UserRole;
  readonly reportId: number;
  readonly newStatus: 'DITINDAKLANJUTI' | 'SELESAI';
  readonly responseNote: string;
  readonly respondedBy: string;
}

/** Result returned by `submitCommunityReport` and `triageCommunityReport`. */
export type WhistleblowerMutationResult =
  | { readonly success: true; readonly report: PublicCommunityReport }
  | { readonly success: false; readonly error: string };

/**
 * Masks reporter identity for public display.
 * Always returns "Pelapor Anonim" when `isAnonymous` is true or name is empty,
 * and otherwise preserves honorifics while masking personal name tokens.
 */
export function maskReporterIdentity(
  reporterName: string | null | undefined,
  isAnonymous: boolean,
): string {
  if (isAnonymous || !reporterName || !reporterName.trim()) {
    return 'Pelapor Anonim';
  }

  const tokens = reporterName.trim().split(/\s+/);
  const honorifics = new Set(['pak', 'ibu', 'bu', 'bapak', 'kang', 'mas', 'mbak']);

  const maskedTokens = tokens.map((token, index) => {
    if (index === 0 && tokens.length > 1 && honorifics.has(token.toLowerCase())) {
      return token;
    }
    const firstChar = token.slice(0, 1);
    return `${firstChar}***`;
  });

  return maskedTokens.join(' ');
}

/**
 * Computes a deterministic, browser- and Node-compatible storage path for
 * compressed community report photo evidence under `/uploads/reports/`.
 */
export function compressAndStoreReportPhoto(
  contextTag: string,
  rawPhotoData?: string | null,
): string | null {
  if (!rawPhotoData || !rawPhotoData.trim()) {
    return null;
  }

  const trimmed = rawPhotoData.trim();
  if (trimmed.startsWith('/uploads/reports/')) {
    return trimmed;
  }

  const cleanTag =
    contextTag
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'warga';

  const input = `${cleanTag}:${trimmed}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hashSuffix = (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  ).slice(0, 10);

  return `/uploads/reports/report-${cleanTag}-${hashSuffix}.jpg`;
}

/** Converts a Drizzle timestamp column value (Date or epoch seconds) into an ISO-8601 string. */
function toIsoString(value: Date | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const millis = num < 10_000_000_000 ? num * 1000 : num;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Computes aggregated KPI counts and resolution rate from a list of public reports. */
export function buildWhistleblowerKpis(
  reportsList: readonly PublicCommunityReport[],
): WhistleblowerKpiMetrics {
  let openReportsCount = 0;
  let inProgressReportsCount = 0;
  let resolvedReportsCount = 0;
  let highSeverityCount = 0;

  for (const report of reportsList) {
    if (report.status === 'BARU') {
      openReportsCount += 1;
    } else if (report.status === 'DITINDAKLANJUTI') {
      inProgressReportsCount += 1;
    } else if (report.status === 'SELESAI') {
      resolvedReportsCount += 1;
    }

    if (report.severity === 'HIGH') {
      highSeverityCount += 1;
    }
  }

  const totalReportsCount = reportsList.length;
  const resolutionRatePercent =
    totalReportsCount > 0
      ? Math.round((resolvedReportsCount / totalReportsCount) * 100)
      : 0;

  return {
    totalReportsCount,
    openReportsCount,
    inProgressReportsCount,
    resolvedReportsCount,
    highSeverityCount,
    resolutionRatePercent,
  };
}

/**
 * Filters a `PublicWhistleblowerSnapshot` in-memory and recomputes KPI metrics
 * for the filtered subset while preserving full reference lists.
 */
export function filterWhistleblowerSnapshot(
  snapshot: PublicWhistleblowerSnapshot,
  filter?: WhistleblowerFilter,
): PublicWhistleblowerSnapshot {
  if (!filter) {
    return snapshot;
  }

  const categoryFilter =
    filter.category && filter.category !== 'ALL' ? filter.category : null;
  const statusFilter =
    filter.status && filter.status !== 'ALL' ? filter.status : null;
  const coopId =
    filter.cooperativeId && Number.isInteger(filter.cooperativeId) && filter.cooperativeId > 0
      ? filter.cooperativeId
      : null;
  const kitchenId =
    filter.kitchenId && Number.isInteger(filter.kitchenId) && filter.kitchenId > 0
      ? filter.kitchenId
      : null;
  const deliveryId =
    filter.deliveryId && Number.isInteger(filter.deliveryId) && filter.deliveryId > 0
      ? filter.deliveryId
      : null;
  const query = (filter.searchQuery ?? '').trim().toLowerCase();

  const filteredReports = snapshot.reports.filter((report) => {
    if (categoryFilter && report.category !== categoryFilter) {
      return false;
    }
    if (statusFilter && report.status !== statusFilter) {
      return false;
    }
    if (coopId !== null && report.cooperativeId !== coopId) {
      return false;
    }
    if (kitchenId !== null && report.kitchenId !== kitchenId) {
      return false;
    }
    if (deliveryId !== null && report.deliveryId !== deliveryId) {
      return false;
    }
    if (query.length > 0) {
      const searchable = [
        report.title,
        report.description,
        report.categoryLabel,
        report.reporterRoleLabel,
        report.reporterDisplayName,
        report.cooperativeName ?? '',
        report.cooperativeRegency ?? '',
        report.kitchenName ?? '',
        report.deliveryQrToken ?? '',
        report.responseNote ?? '',
      ]
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return {
    kpis: buildWhistleblowerKpis(filteredReports),
    reports: filteredReports,
    cooperatives: snapshot.cooperatives,
    kitchens: snapshot.kitchens,
    deliveries: snapshot.deliveries,
  };
}

/** Projects a raw `communityReports` row with lookup maps into a privacy-safe public view. */
function projectPublicReport(
  row: typeof communityReports.$inferSelect,
  coopMap: ReadonlyMap<number, WhistleblowerCooperativeOption>,
  kitchenMap: ReadonlyMap<number, WhistleblowerKitchenOption>,
  deliveryQrMap: ReadonlyMap<number, string>,
): PublicCommunityReport {
  const coop = row.cooperativeId ? coopMap.get(row.cooperativeId) : undefined;
  const kitchen = row.kitchenId ? kitchenMap.get(row.kitchenId) : undefined;
  const deliveryQr = row.deliveryId ? deliveryQrMap.get(row.deliveryId) ?? null : null;

  return {
    id: row.id,
    category: row.category,
    categoryLabel: REPORT_CATEGORY_LABELS[row.category],
    severity: row.severity,
    severityLabel: REPORT_SEVERITY_LABELS[row.severity],
    status: row.status,
    statusLabel: REPORT_STATUS_LABELS[row.status],
    reporterRoleLabel: row.reporterRoleLabel,
    reporterDisplayName: maskReporterIdentity(row.reporterName, row.isAnonymous),
    isAnonymous: row.isAnonymous,
    deliveryId: row.deliveryId ?? null,
    deliveryQrToken: deliveryQr,
    cooperativeId: row.cooperativeId ?? null,
    cooperativeName: coop?.name ?? null,
    cooperativeRegency: coop?.regency ?? null,
    kitchenId: row.kitchenId ?? null,
    kitchenName: kitchen?.name ?? null,
    kitchenRegency: kitchen?.regency ?? null,
    title: row.title,
    description: row.description,
    photoPath: row.photoPath ?? null,
    responseNote: row.responseNote ?? null,
    respondedBy: row.respondedBy ?? null,
    resolvedAtIso: toIsoString(row.resolvedAt),
    createdAtIso: toIsoString(row.createdAt) ?? new Date().toISOString(),
  };
}

/**
 * Queries SQLite via Drizzle ORM to build the privacy-safe Public Whistleblower Snapshot.
 * Strips all `reporterContact` phone numbers and masks reporter names before returning.
 */
export function getPublicWhistleblowerSnapshot(
  db: AppDatabase,
  filter?: WhistleblowerFilter,
): PublicWhistleblowerSnapshot {
  const coopRows = db
    .select({
      id: cooperatives.id,
      name: cooperatives.name,
      regency: cooperatives.regency,
    })
    .from(cooperatives)
    .all();

  const kitchenRows = db
    .select({
      id: kitchens.id,
      name: kitchens.name,
      regency: kitchens.regency,
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

  const deliveryOptions: WhistleblowerDeliveryOption[] = [];
  const deliveryQrMap = new Map<number, string>();

  for (const d of deliveryRows) {
    deliveryQrMap.set(d.id, d.qrToken);
    if (d.status !== 'VERIFIED' && d.status !== 'DISPATCHED') {
      continue;
    }
    const coop = coopMap.get(d.cooperativeId);
    const kitchen = kitchenMap.get(d.kitchenId);
    if (!coop || !kitchen) {
      continue;
    }
    deliveryOptions.push({
      id: d.id,
      qrToken: d.qrToken,
      scheduledDate: d.scheduledDate,
      status: d.status,
      cooperativeId: coop.id,
      cooperativeName: coop.name,
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
    });
  }

  const reportRows = db
    .select()
    .from(communityReports)
    .orderBy(desc(communityReports.createdAt), desc(communityReports.id))
    .all();

  const publicReports = reportRows.map((row) =>
    projectPublicReport(row, coopMap, kitchenMap, deliveryQrMap),
  );

  const baseSnapshot: PublicWhistleblowerSnapshot = {
    kpis: buildWhistleblowerKpis(publicReports),
    reports: publicReports,
    cooperatives: coopRows,
    kitchens: kitchenRows,
    deliveries: deliveryOptions,
  };

  return filterWhistleblowerSnapshot(baseSnapshot, filter);
}

/**
 * Validates and persists a new community whistleblower or feedback report.
 * Auto-populates cooperative and kitchen context when linked to an existing delivery.
 */
export function submitCommunityReport(
  db: AppDatabase,
  input: SubmitCommunityReportInput,
): WhistleblowerMutationResult {
  if (!canPerformAction(input.role, 'SUBMIT_REPORT')) {
    return {
      success: false,
      error: 'Peran pengguna tidak memiliki izin mengirim laporan masyarakat.',
    };
  }

  if (!REPORT_CATEGORIES.includes(input.category)) {
    return { success: false, error: 'Kategori laporan tidak valid.' };
  }

  if (!REPORT_SEVERITIES.includes(input.severity)) {
    return { success: false, error: 'Tingkat urgensi laporan tidak valid.' };
  }

  const title = input.title.trim();
  const description = input.description.trim();
  const reporterRoleLabel = input.reporterRoleLabel.trim() || 'Warga / Orang Tua Siswa';

  if (title.length < 5) {
    return {
      success: false,
      error: 'Judul laporan minimal 5 karakter agar kendala mudah dipahami.',
    };
  }

  if (description.length < 10) {
    return {
      success: false,
      error: 'Uraian laporan minimal 10 karakter agar petugas dapat menindaklanjuti.',
    };
  }

  const resolvedDeliveryId: number | null =
    input.deliveryId && Number.isInteger(input.deliveryId) && input.deliveryId > 0
      ? input.deliveryId
      : null;
  let resolvedCooperativeId: number | null =
    input.cooperativeId && Number.isInteger(input.cooperativeId) && input.cooperativeId > 0
      ? input.cooperativeId
      : null;
  let resolvedKitchenId: number | null =
    input.kitchenId && Number.isInteger(input.kitchenId) && input.kitchenId > 0
      ? input.kitchenId
      : null;

  if (resolvedDeliveryId !== null) {
    const linkedDelivery = db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, resolvedDeliveryId))
      .get();

    if (!linkedDelivery) {
      return {
        success: false,
        error: `Pengiriman #${resolvedDeliveryId} tidak ditemukan di database.`,
      };
    }

    if (resolvedCooperativeId === null) {
      resolvedCooperativeId = linkedDelivery.cooperativeId;
    }
    if (resolvedKitchenId === null) {
      resolvedKitchenId = linkedDelivery.kitchenId;
    }
  }

  if (resolvedCooperativeId !== null) {
    const coop = db
      .select({ id: cooperatives.id })
      .from(cooperatives)
      .where(eq(cooperatives.id, resolvedCooperativeId))
      .get();
    if (!coop) {
      return {
        success: false,
        error: `Koperasi Desa #${resolvedCooperativeId} tidak ditemukan.`,
      };
    }
  }

  if (resolvedKitchenId !== null) {
    const kitchen = db
      .select({ id: kitchens.id })
      .from(kitchens)
      .where(eq(kitchens.id, resolvedKitchenId))
      .get();
    if (!kitchen) {
      return {
        success: false,
        error: `Dapur SPPG #${resolvedKitchenId} tidak ditemukan.`,
      };
    }
  }

  const storedPhotoPath = compressAndStoreReportPhoto(
    input.category.toLowerCase(),
    input.photoData,
  );

  const inserted = db
    .insert(communityReports)
    .values({
      category: input.category,
      severity: input.severity,
      status: 'BARU',
      reporterRoleLabel,
      reporterName: input.isAnonymous ? null : input.reporterName?.trim() || null,
      reporterContact: input.reporterContact?.trim() || null,
      isAnonymous: input.isAnonymous,
      deliveryId: resolvedDeliveryId,
      cooperativeId: resolvedCooperativeId,
      kitchenId: resolvedKitchenId,
      title,
      description,
      photoPath: storedPhotoPath,
      responseNote: null,
      respondedBy: null,
      resolvedAt: null,
    })
    .returning()
    .all()[0];

  const snapshot = getPublicWhistleblowerSnapshot(db);
  const projected = snapshot.reports.find((r) => r.id === inserted.id);
  if (!projected) {
    return { success: false, error: 'Gagal memuat ulang laporan yang baru disimpan.' };
  }

  return { success: true, report: projected };
}

/**
 * Updates the triage status and official response note on an existing community report.
 * Strictly restricted to roles with `TRIAGE_REPORT` permission (`KOPERASI_ADMIN`, `SPPG_STAFF`).
 */
export function triageCommunityReport(
  db: AppDatabase,
  input: TriageCommunityReportInput,
): WhistleblowerMutationResult {
  if (!canPerformAction(input.role, 'TRIAGE_REPORT')) {
    return {
      success: false,
      error:
        'Akses ditolak: Hanya Pengurus Koperasi atau Petugas SPPG yang dapat menindaklanjuti laporan.',
    };
  }

  if (input.newStatus !== 'DITINDAKLANJUTI' && input.newStatus !== 'SELESAI') {
    return {
      success: false,
      error: 'Status tindak lanjut harus berupa DITINDAKLANJUTI atau SELESAI.',
    };
  }

  const responseNote = input.responseNote.trim();
  if (responseNote.length < 5) {
    return {
      success: false,
      error: 'Catatan tindak lanjut minimal 5 karakter sebagai bukti pertanggungjawaban publik.',
    };
  }

  const respondedBy = input.respondedBy.trim();
  if (respondedBy.length < 3) {
    return {
      success: false,
      error: 'Nama penanggung jawab tindak lanjut wajib diisi.',
    };
  }

  const existing = db
    .select()
    .from(communityReports)
    .where(eq(communityReports.id, input.reportId))
    .get();

  if (!existing) {
    return {
      success: false,
      error: `Laporan #${input.reportId} tidak ditemukan.`,
    };
  }

  db.update(communityReports)
    .set({
      status: input.newStatus,
      responseNote,
      respondedBy,
      resolvedAt: input.newStatus === 'SELESAI' ? new Date() : null,
    })
    .where(eq(communityReports.id, input.reportId))
    .run();

  const snapshot = getPublicWhistleblowerSnapshot(db);
  const updated = snapshot.reports.find((r) => r.id === input.reportId);
  if (!updated) {
    return { success: false, error: 'Gagal memuat laporan setelah pembaruan status.' };
  }

  return { success: true, report: updated };
}

const DEFAULT_WHISTLEBLOWER_COOPS: readonly WhistleblowerCooperativeOption[] = [
  { id: 1, name: 'Koperasi Desa Merah Putih Cibogo', regency: 'Kabupaten Subang' },
  { id: 2, name: 'BUMDes Maju Bersama Sokaraja', regency: 'Kabupaten Banyumas' },
];

const DEFAULT_WHISTLEBLOWER_KITCHENS: readonly WhistleblowerKitchenOption[] = [
  { id: 1, name: 'SPPG Dapur Gizi Subang Kota', regency: 'Kabupaten Subang' },
  { id: 2, name: 'SPPG Satuan Gizi Purwokerto Timur', regency: 'Kabupaten Banyumas' },
];

const DEFAULT_WHISTLEBLOWER_DELIVERIES: readonly WhistleblowerDeliveryOption[] = [
  {
    id: 3,
    qrToken: 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e',
    scheduledDate: '2026-10-16',
    status: 'DISPATCHED',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
  },
  {
    id: 2,
    qrToken: 'mbg_bms_20261015_verified_1a2b3c4d5e6f7a8b9c0d1e',
    scheduledDate: '2026-10-15',
    status: 'VERIFIED',
    cooperativeId: 2,
    cooperativeName: 'BUMDes Maju Bersama Sokaraja',
    kitchenId: 2,
    kitchenName: 'SPPG Satuan Gizi Purwokerto Timur',
  },
  {
    id: 1,
    qrToken: 'mbg_sbg_20261014_verified_8f9a2b3c4d5e6f7a8b9c0d',
    scheduledDate: '2026-10-14',
    status: 'VERIFIED',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
  },
];

const DEFAULT_WHISTLEBLOWER_REPORTS: readonly PublicCommunityReport[] = [
  {
    id: 3,
    category: 'HARGA_PETANI',
    categoryLabel: REPORT_CATEGORY_LABELS.HARGA_PETANI,
    severity: 'LOW',
    severityLabel: REPORT_SEVERITY_LABELS.LOW,
    status: 'BARU',
    statusLabel: REPORT_STATUS_LABELS.BARU,
    reporterRoleLabel: 'Petani Lokal',
    reporterDisplayName: 'Pak S*** R***',
    isAnonymous: false,
    deliveryId: null,
    deliveryQrToken: null,
    cooperativeId: 2,
    cooperativeName: 'BUMDes Maju Bersama Sokaraja',
    cooperativeRegency: 'Kabupaten Banyumas',
    kitchenId: 2,
    kitchenName: 'SPPG Satuan Gizi Purwokerto Timur',
    kitchenRegency: 'Kabupaten Banyumas',
    title: 'Usulan penyesuaian harga acuan daging ayam ras minggu depan',
    description:
      'Harga pakan ternak di tingkat peternak Banyumas naik tipis pekan ini. Mohon peninjauan harga serapan koperasi agar tetap sejalan dengan acuan pemda.',
    photoPath: null,
    responseNote: null,
    respondedBy: null,
    resolvedAtIso: null,
    createdAtIso: '2026-10-16T02:00:00.000Z',
  },
  {
    id: 2,
    category: 'KENDALA_DISTRIBUSI',
    categoryLabel: REPORT_CATEGORY_LABELS.KENDALA_DISTRIBUSI,
    severity: 'HIGH',
    severityLabel: REPORT_SEVERITY_LABELS.HIGH,
    status: 'DITINDAKLANJUTI',
    statusLabel: REPORT_STATUS_LABELS.DITINDAKLANJUTI,
    reporterRoleLabel: 'Petugas Lapangan',
    reporterDisplayName: 'Pelapor Anonim',
    isAnonymous: true,
    deliveryId: 3,
    deliveryQrToken: 'mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    cooperativeRegency: 'Kabupaten Subang',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
    kitchenRegency: 'Kabupaten Subang',
    title: 'Keterlambatan armada pengangkut akibat perbaikan jembatan desa',
    description:
      'Akses jalan utama Desa Cibogo menuju jalur pantura dialihkan sementara sehingga waktu tiba di SPPG Subang Kota mundur sekitar 45 menit.',
    photoPath: null,
    responseNote:
      'Armada dialihkan lewat jalur alternatif Padaasih dan berkoordinasi dengan koordinator dapur SPPG agar jadwal masak tetap aman.',
    respondedBy: 'Ibu Siti Aminah (SPPG Dapur Gizi Subang Kota)',
    resolvedAtIso: null,
    createdAtIso: '2026-10-16T00:30:00.000Z',
  },
  {
    id: 1,
    category: 'KUALITAS_PANGAN',
    categoryLabel: REPORT_CATEGORY_LABELS.KUALITAS_PANGAN,
    severity: 'MEDIUM',
    severityLabel: REPORT_SEVERITY_LABELS.MEDIUM,
    status: 'SELESAI',
    statusLabel: REPORT_STATUS_LABELS.SELESAI,
    reporterRoleLabel: 'Warga / Orang Tua Siswa',
    reporterDisplayName: 'Ibu R*** M***',
    isAnonymous: false,
    deliveryId: 1,
    deliveryQrToken: 'mbg_sbg_20261014_verified_8f9a2b3c4d5e6f7a8b9c0d',
    cooperativeId: 1,
    cooperativeName: 'Koperasi Desa Merah Putih Cibogo',
    cooperativeRegency: 'Kabupaten Subang',
    kitchenId: 1,
    kitchenName: 'SPPG Dapur Gizi Subang Kota',
    kitchenRegency: 'Kabupaten Subang',
    title: 'Sebagian ikatan bayam perlu penyortiran ulang sebelum dimasak',
    description:
      'Saat pembongkaran pagi di dapur Subang Kota, sekitar 10 ikat sayur bayam tampak agak layu di bagian bawah keranjang. Perlu sirkulasi keranjang lebih baik.',
    photoPath: '/uploads/reports/demo-bayam-subang-01.jpg',
    responseNote:
      'Terima kasih masukannya. Tim koperasi sudah mengganti 15 ikat bayam segar tambahan dan beralih ke keranjang berlubang untuk pengiriman berikutnya.',
    respondedBy: 'Pak Tatang Ruhiyat (Koperasi Desa Merah Putih Cibogo)',
    resolvedAtIso: '2026-10-14T04:30:00.000Z',
    createdAtIso: '2026-10-14T02:15:00.000Z',
  },
];

/**
 * Deterministic default snapshot matching the seeded Subang & Banyumas community
 * whistleblower reports for instant initial rendering.
 */
export const DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT: PublicWhistleblowerSnapshot = {
  kpis: buildWhistleblowerKpis(DEFAULT_WHISTLEBLOWER_REPORTS),
  reports: DEFAULT_WHISTLEBLOWER_REPORTS,
  cooperatives: DEFAULT_WHISTLEBLOWER_COOPS,
  kitchens: DEFAULT_WHISTLEBLOWER_KITCHENS,
  deliveries: DEFAULT_WHISTLEBLOWER_DELIVERIES,
};
