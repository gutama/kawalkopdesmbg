'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  ChefHat,
  Clock,
  FileCheck2,
  Filter,
  Lock,
  MessageSquarePlus,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@/db/schema';
import { useSession } from '@/components/session-provider';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT,
  REPORT_CATEGORY_LABELS,
  REPORT_SEVERITY_LABELS,
  REPORT_STATUS_LABELS,
  REPORTER_ROLE_OPTIONS,
  buildWhistleblowerKpis,
  compressAndStoreReportPhoto,
  filterWhistleblowerSnapshot,
  maskReporterIdentity,
  type PublicCommunityReport,
  type PublicWhistleblowerSnapshot,
  type SubmitCommunityReportInput,
  type TriageCommunityReportInput,
  type WhistleblowerFilter,
  type WhistleblowerMutationResult,
} from '@/lib/whistleblower';

/** Props for the Community Whistleblower Portal component. */
export interface WhistleblowerPortalProps {
  readonly initialSnapshot?: PublicWhistleblowerSnapshot;
  readonly initialDeliveryId?: number | null;
  readonly onSubmitReport?: (
    input: SubmitCommunityReportInput,
  ) => Promise<WhistleblowerMutationResult>;
  readonly onTriageReport?: (
    input: TriageCommunityReportInput,
  ) => Promise<WhistleblowerMutationResult>;
  readonly onRefreshSnapshot?: (
    filter?: WhistleblowerFilter,
  ) => Promise<PublicWhistleblowerSnapshot>;
}

/** Formats an ISO-8601 timestamp into a readable Bahasa Indonesia WIB label. */
function formatWibTimestamp(iso: string | null): string {
  if (!iso) {
    return 'Baru saja';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const wibDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibDate.getUTCFullYear();
  const mm = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibDate.getUTCDate()).padStart(2, '0');
  const hh = String(wibDate.getUTCHours()).padStart(2, '0');
  const min = String(wibDate.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} WIB`;
}

const STATUS_BADGE_CLASSES: Record<ReportStatus, string> = {
  BARU: 'border-amber-300 bg-amber-100 text-amber-950',
  DITINDAKLANJUTI: 'border-sky-300 bg-sky-100 text-sky-950',
  SELESAI: 'border-emerald-300 bg-emerald-100 text-emerald-950',
};

const SEVERITY_BADGE_CLASSES: Record<ReportSeverity, string> = {
  HIGH: 'border-rose-300 bg-rose-100 text-rose-950',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-900',
  LOW: 'border-stone-200 bg-stone-100 text-stone-700',
};

/** Builds an updated snapshot after prepending or replacing a public report record. */
function upsertReportInSnapshot(
  snapshot: PublicWhistleblowerSnapshot,
  report: PublicCommunityReport,
): PublicWhistleblowerSnapshot {
  const existingIndex = snapshot.reports.findIndex((item) => item.id === report.id);
  const nextReports =
    existingIndex >= 0
      ? snapshot.reports.map((item) => (item.id === report.id ? report : item))
      : [report, ...snapshot.reports];

  return {
    ...snapshot,
    kpis: buildWhistleblowerKpis(nextReports),
    reports: nextReports,
  };
}

/**
 * Community Whistleblower & Feedback Loop Portal (`/laporan`) enabling anonymous-by-default
 * reporting, evidence attachment, privacy-safe public report monitoring, and role-gated triage
 * by Koperasi Desa admins and SPPG kitchen staff.
 */
export function WhistleblowerPortal({
  initialSnapshot = DEFAULT_PUBLIC_WHISTLEBLOWER_SNAPSHOT,
  initialDeliveryId = null,
  onSubmitReport,
  onTriageReport,
  onRefreshSnapshot,
}: WhistleblowerPortalProps) {
  const { role, persona, canPerform } = useSession();
  const canTriage = canPerform('TRIAGE_REPORT');

  const initialLinkedDelivery = useMemo(
    () =>
      initialDeliveryId
        ? initialSnapshot.deliveries.find((d) => d.id === initialDeliveryId) ?? null
        : null,
    [initialDeliveryId, initialSnapshot.deliveries],
  );

  const [baseSnapshot, setBaseSnapshot] =
    useState<PublicWhistleblowerSnapshot>(initialSnapshot);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(Boolean(initialDeliveryId));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Submission Form State
  const [category, setCategory] = useState<ReportCategory>('KUALITAS_PANGAN');
  const [severity, setSeverity] = useState<ReportSeverity>('MEDIUM');
  const [reporterRoleLabel, setReporterRoleLabel] = useState<string>(
    REPORTER_ROLE_OPTIONS[0],
  );
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [reporterName, setReporterName] = useState<string>('');
  const [reporterContact, setReporterContact] = useState<string>('');
  const [linkedDeliveryId, setLinkedDeliveryId] = useState<number | null>(
    initialLinkedDelivery?.id ?? null,
  );
  const [linkedCooperativeId, setLinkedCooperativeId] = useState<number | null>(
    initialLinkedDelivery?.cooperativeId ?? null,
  );
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formFeedback, setFormFeedback] = useState<{
    readonly type: 'success' | 'error';
    readonly message: string;
  } | null>(null);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'ALL'>('ALL');
  const [cooperativeFilter, setCooperativeFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Triage Modal State
  const [triagingReport, setTriagingReport] = useState<PublicCommunityReport | null>(
    null,
  );
  const [triageStatus, setTriageStatus] = useState<'DITINDAKLANJUTI' | 'SELESAI'>(
    'DITINDAKLANJUTI',
  );
  const [triageNote, setTriageNote] = useState<string>('');
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  const activeFilter: WhistleblowerFilter = useMemo(
    () => ({
      status: statusFilter,
      category: categoryFilter,
      cooperativeId: cooperativeFilter,
      searchQuery,
    }),
    [statusFilter, categoryFilter, cooperativeFilter, searchQuery],
  );

  const filteredView = useMemo(
    () => filterWhistleblowerSnapshot(baseSnapshot, activeFilter),
    [baseSnapshot, activeFilter],
  );

  const hasActiveFilter =
    statusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    cooperativeFilter !== null ||
    searchQuery.trim().length > 0;

  function handleResetFilters() {
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setCooperativeFilter(null);
    setSearchQuery('');
  }

  function handleDeliverySelection(rawValue: string) {
    const parsed = rawValue ? Number(rawValue) : null;
    setLinkedDeliveryId(parsed);
    if (parsed !== null) {
      const matched = baseSnapshot.deliveries.find((d) => d.id === parsed);
      if (matched) {
        setLinkedCooperativeId(matched.cooperativeId);
      }
    }
  }

  function handlePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoData(null);
      setPhotoFileName(null);
      return;
    }

    setPhotoFileName(file.name);
    if (typeof FileReader === 'undefined') {
      setPhotoData(`data:image/jpeg;base64,${file.name}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRefresh() {
    if (!onRefreshSnapshot) {
      return;
    }
    setIsRefreshing(true);
    try {
      const latest = await onRefreshSnapshot();
      setBaseSnapshot(latest);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSubmitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormFeedback(null);

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedTitle.length < 5) {
      setFormFeedback({
        type: 'error',
        message: 'Judul laporan minimal 5 karakter agar kendala mudah dipahami.',
      });
      return;
    }
    if (trimmedDescription.length < 10) {
      setFormFeedback({
        type: 'error',
        message: 'Uraian laporan minimal 10 karakter agar petugas dapat menindaklanjuti.',
      });
      return;
    }

    const selectedDelivery = linkedDeliveryId
      ? baseSnapshot.deliveries.find((d) => d.id === linkedDeliveryId) ?? null
      : null;

    const payload: SubmitCommunityReportInput = {
      role,
      category,
      severity,
      reporterRoleLabel,
      reporterName: isAnonymous ? null : reporterName.trim() || null,
      reporterContact: reporterContact.trim() || null,
      isAnonymous,
      deliveryId: linkedDeliveryId,
      cooperativeId: selectedDelivery?.cooperativeId ?? linkedCooperativeId,
      kitchenId: selectedDelivery?.kitchenId ?? null,
      title: trimmedTitle,
      description: trimmedDescription,
      photoData,
    };

    setIsSubmitting(true);
    try {
      if (onSubmitReport) {
        const result = await onSubmitReport(payload);
        if (!result.success) {
          setFormFeedback({ type: 'error', message: result.error });
          return;
        }
        if (onRefreshSnapshot) {
          const latest = await onRefreshSnapshot();
          setBaseSnapshot(latest);
        } else {
          setBaseSnapshot((prev) => upsertReportInSnapshot(prev, result.report));
        }
      } else {
        const selectedCoop = payload.cooperativeId
          ? baseSnapshot.cooperatives.find((c) => c.id === payload.cooperativeId) ?? null
          : null;
        const selectedKitchen = payload.kitchenId
          ? baseSnapshot.kitchens.find((k) => k.id === payload.kitchenId) ?? null
          : null;
        const nextId =
          baseSnapshot.reports.reduce((max, item) => Math.max(max, item.id), 0) + 1;
        const localReport: PublicCommunityReport = {
          id: nextId,
          category: payload.category,
          categoryLabel: REPORT_CATEGORY_LABELS[payload.category],
          severity: payload.severity,
          severityLabel: REPORT_SEVERITY_LABELS[payload.severity],
          status: 'BARU',
          statusLabel: REPORT_STATUS_LABELS.BARU,
          reporterRoleLabel: payload.reporterRoleLabel,
          reporterDisplayName: maskReporterIdentity(
            payload.reporterName,
            payload.isAnonymous,
          ),
          isAnonymous: payload.isAnonymous,
          deliveryId: selectedDelivery?.id ?? null,
          deliveryQrToken: selectedDelivery?.qrToken ?? null,
          cooperativeId: selectedCoop?.id ?? null,
          cooperativeName: selectedCoop?.name ?? null,
          cooperativeRegency: selectedCoop?.regency ?? null,
          kitchenId: selectedKitchen?.id ?? null,
          kitchenName: selectedKitchen?.name ?? null,
          kitchenRegency: selectedKitchen?.regency ?? null,
          title: trimmedTitle,
          description: trimmedDescription,
          photoPath: compressAndStoreReportPhoto(
            payload.category.toLowerCase(),
            payload.photoData,
          ),
          responseNote: null,
          respondedBy: null,
          resolvedAtIso: null,
          createdAtIso: new Date().toISOString(),
        };
        setBaseSnapshot((prev) => upsertReportInSnapshot(prev, localReport));
      }

      setTitle('');
      setDescription('');
      setReporterName('');
      setReporterContact('');
      setPhotoData(null);
      setPhotoFileName(null);
      setFormFeedback({
        type: 'success',
        message:
          'Laporan warga berhasil dikirim! Identitas dan nomor kontak Anda dilindungi dari tampilan publik.',
      });
    } catch {
      setFormFeedback({
        type: 'error',
        message: 'Terjadi kesalahan saat mengirim laporan. Silakan coba kembali.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openTriageModal(report: PublicCommunityReport) {
    setTriagingReport(report);
    setTriageStatus(report.status === 'BARU' ? 'DITINDAKLANJUTI' : 'SELESAI');
    setTriageNote(report.responseNote ?? '');
    setTriageError(null);
  }

  async function handleConfirmTriage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!triagingReport) {
      return;
    }

    const trimmedNote = triageNote.trim();
    if (trimmedNote.length < 5) {
      setTriageError(
        'Catatan tindak lanjut minimal 5 karakter sebagai bukti pertanggungjawaban publik.',
      );
      return;
    }

    const actorLabel = `${persona.name} (${persona.organization})`;
    const input: TriageCommunityReportInput = {
      role,
      reportId: triagingReport.id,
      newStatus: triageStatus,
      responseNote: trimmedNote,
      respondedBy: actorLabel,
    };

    setIsTriaging(true);
    setTriageError(null);
    try {
      if (onTriageReport) {
        const result = await onTriageReport(input);
        if (!result.success) {
          setTriageError(result.error);
          return;
        }
        if (onRefreshSnapshot) {
          const latest = await onRefreshSnapshot();
          setBaseSnapshot(latest);
        } else {
          setBaseSnapshot((prev) => upsertReportInSnapshot(prev, result.report));
        }
      } else {
        const updatedReport: PublicCommunityReport = {
          ...triagingReport,
          status: triageStatus,
          statusLabel: REPORT_STATUS_LABELS[triageStatus],
          responseNote: trimmedNote,
          respondedBy: actorLabel,
          resolvedAtIso:
            triageStatus === 'SELESAI' ? new Date().toISOString() : null,
        };
        setBaseSnapshot((prev) => upsertReportInSnapshot(prev, updatedReport));
      }

      setTriagingReport(null);
      setTriageNote('');
    } catch {
      setTriageError('Gagal menyimpan tindak lanjut laporan.');
    } finally {
      setIsTriaging(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header & Privacy Assurance Banner */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-900/80 px-3 py-1 text-xs font-semibold text-amber-300">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Identitas Dilindungi &amp; Nomor Kontak Dirahasiakan</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Portal Pengaduan &amp; Umpan Balik Warga
            </h1>
            <p className="text-sm leading-relaxed text-emerald-100">
              Saluran pengawasan partisipatif bagi orang tua siswa, petani desa, dan
              petugas lapangan untuk melaporkan kendala kualitas pangan, keadilan harga
              petani, atau keterlambatan distribusi secara aman dan terpantau.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onRefreshSnapshot ? (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-900/70 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                <RefreshCw
                  className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                  aria-hidden="true"
                />
                <span>{isRefreshing ? 'Memuat...' : 'Muat Ulang'}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsFormOpen((prev) => !prev)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-sm transition-colors hover:bg-amber-400"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              <span>{isFormOpen ? 'Tutup Formulir Laporan' : 'Buat Laporan Warga'}</span>
            </button>
          </div>
        </div>

        {initialLinkedDelivery ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-xs text-amber-100">
            <Truck className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>
              Formulir ditautkan otomatis ke pengiriman{' '}
              <strong className="text-white">
                {initialLinkedDelivery.cooperativeName} → {initialLinkedDelivery.kitchenName}
              </strong>{' '}
              (Tanggal {initialLinkedDelivery.scheduledDate}).
            </span>
          </div>
        ) : null}
      </section>

      {/* KPI Metrics Summary Strip */}
      <section aria-label="Ringkasan Statistik Pengaduan Warga">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div
            data-testid="wb-kpi-total"
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Total Laporan</span>
              <MessageSquareWarning className="h-4 w-4 text-stone-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-stone-900 tabular-nums">
              {filteredView.kpis.totalReportsCount}
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {filteredView.kpis.highSeverityCount} laporan prioritas tinggi
            </p>
          </div>

          <div
            data-testid="wb-kpi-open"
            className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">Laporan Baru</span>
              <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-950 tabular-nums">
              {filteredView.kpis.openReportsCount}
            </p>
            <p className="mt-1 text-xs text-amber-800">Menunggu respon pengurus</p>
          </div>

          <div
            data-testid="wb-kpi-in-progress"
            className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-900">Ditindaklanjuti</span>
              <Clock className="h-4 w-4 text-sky-700" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-sky-950 tabular-nums">
              {filteredView.kpis.inProgressReportsCount}
            </p>
            <p className="mt-1 text-xs text-sky-800">Sedang dalam pemeriksaan</p>
          </div>

          <div
            data-testid="wb-kpi-resolved"
            className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900">Selesai</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">
              {filteredView.kpis.resolvedReportsCount}
            </p>
            <p className="mt-1 text-xs text-emerald-800 tabular-nums">
              Tingkat penyelesaian {filteredView.kpis.resolutionRatePercent}%
            </p>
          </div>
        </div>
      </section>

      {/* Submission Form Feedback Banner */}
      {formFeedback ? (
        <div
          role={formFeedback.type === 'success' ? 'status' : 'alert'}
          className={cn(
            'flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm',
            formFeedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950',
          )}
        >
          <div className="flex items-start gap-2.5">
            {formFeedback.type === 'success' ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
            )}
            <p className="font-medium">{formFeedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFormFeedback(null)}
            aria-label="Tutup notifikasi laporan"
            className="rounded-lg p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Interactive Community Report Submission Form */}
      {isFormOpen ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Formulir Pengaduan &amp; Umpan Balik Masyarakat
              </h2>
              <p className="text-xs text-stone-600">
                Laporkan temuan di lapangan. Nomor kontak hanya disimpan untuk verifikasi
                internal dan tidak pernah ditampilkan di papan publik.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Anonim Secara Bawaan
            </span>
          </div>

          <form
            aria-label="Formulir Pengaduan Warga"
            onSubmit={handleSubmitReport}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  htmlFor="report-category"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Kategori Laporan
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  {REPORT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {REPORT_CATEGORY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-severity"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Tingkat Urgensi
                </label>
                <select
                  id="report-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as ReportSeverity)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  {REPORT_SEVERITIES.map((item) => (
                    <option key={item} value={item}>
                      {REPORT_SEVERITY_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-role-label"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Peran Pelapor
                </label>
                <select
                  id="report-role-label"
                  value={reporterRoleLabel}
                  onChange={(e) => setReporterRoleLabel(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  {REPORTER_ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="report-delivery"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Tautkan Pengiriman (Opsional)
                </label>
                <select
                  id="report-delivery"
                  value={linkedDeliveryId ?? ''}
                  onChange={(e) => handleDeliverySelection(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  <option value="">-- Tidak ditautkan ke pengiriman tertentu --</option>
                  {baseSnapshot.deliveries.map((del) => (
                    <option key={del.id} value={del.id}>
                      #{del.id} • {del.scheduledDate} • {del.cooperativeName} →{' '}
                      {del.kitchenName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="report-cooperative"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Koperasi Desa Terkait (Opsional)
                </label>
                <select
                  id="report-cooperative"
                  value={linkedCooperativeId ?? ''}
                  onChange={(e) =>
                    setLinkedCooperativeId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  <option value="">-- Pilih Koperasi Desa --</option>
                  {baseSnapshot.cooperatives.map((coop) => (
                    <option key={coop.id} value={coop.id}>
                      {coop.name} ({coop.regency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="report-title"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Judul Ringkas Kendala / Masukan
              </label>
              <input
                id="report-title"
                type="text"
                required
                minLength={5}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kualitas sayur layu di pengiriman pagi atau selisih harga gabah"
                className="min-h-12 w-full rounded-xl border border-stone-300 px-3.5 text-sm text-stone-900 placeholder:text-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="report-description"
                className="mb-1.5 block text-xs font-semibold text-stone-700"
              >
                Kronologi &amp; Detail Lapangan
              </label>
              <textarea
                id="report-description"
                required
                minLength={10}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan lokasi dapur/koperasi, waktu kejadian, komoditas terdampak, dan saran perbaikan..."
                className="w-full rounded-xl border border-stone-300 p-3.5 text-sm text-stone-900 placeholder:text-stone-400"
              />
            </div>

            {/* Privacy Controls & Optional Contact */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700"
                />
                <div className="text-xs">
                  <span className="font-bold text-stone-900">
                    Sembunyikan nama lengkap saya (Tampilkan sebagai Pelapor Anonim)
                  </span>
                  <p className="mt-0.5 text-stone-600">
                    Jika tidak dicentang, nama Anda tetap disamarkan otomatis di papan
                    publik (misal: &ldquo;Ibu R*** M***&rdquo;).
                  </p>
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="report-name"
                    className="mb-1.5 block text-xs font-semibold text-stone-700"
                  >
                    Nama Pelapor (Opsional)
                  </label>
                  <input
                    id="report-name"
                    type="text"
                    disabled={isAnonymous}
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder={
                      isAnonymous
                        ? 'Disembunyikan (Mode Anonim aktif)'
                        : 'Contoh: Ibu Ratna Maulida'
                    }
                    className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-900 disabled:bg-stone-100 disabled:text-stone-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="report-contact"
                    className="mb-1.5 block text-xs font-semibold text-stone-700"
                  >
                    Nomor WhatsApp / Kontak Internal (Opsional &amp; Rahasia)
                  </label>
                  <input
                    id="report-contact"
                    type="tel"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    placeholder="Hanya untuk verifikasi internal, tidak pernah ditampilkan ke publik"
                    className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-photo"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-700"
                >
                  <Camera className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Unggah Foto Bukti Lapangan (Opsional)</span>
                </label>
                <input
                  id="report-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-900 hover:file:bg-emerald-200"
                />
                {photoFileName ? (
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Foto siap dilampirkan: {photoFileName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>{isSubmitting ? 'Mengirim Laporan...' : 'Kirim Laporan Aman'}</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Filter & Search Bar */}
      <section
        aria-label="Filter Daftar Laporan Warga"
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
            <Filter className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Papan Pantau Laporan &amp; Tindak Lanjut ({filteredView.reports.length})</span>
          </div>

          {hasActiveFilter ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          ) : null}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Status Laporan">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'min-h-10 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              statusFilter === 'ALL'
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100',
            )}
          >
            Semua Status ({baseSnapshot.kpis.totalReportsCount})
          </button>
          {REPORT_STATUSES.map((statusOption) => (
            <button
              key={statusOption}
              type="button"
              onClick={() => setStatusFilter(statusOption)}
              className={cn(
                'min-h-10 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                statusFilter === statusOption
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100',
              )}
            >
              {REPORT_STATUS_LABELS[statusOption]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              htmlFor="filter-category"
              className="mb-1 block text-xs font-semibold text-stone-600"
            >
              Kategori
            </label>
            <select
              id="filter-category"
              aria-label="Filter Kategori Laporan"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as ReportCategory | 'ALL')
              }
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
            >
              <option value="ALL">Semua Kategori</option>
              {REPORT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {REPORT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-cooperative"
              className="mb-1 block text-xs font-semibold text-stone-600"
            >
              Koperasi Desa
            </label>
            <select
              id="filter-cooperative"
              aria-label="Filter Koperasi Desa"
              value={cooperativeFilter ?? ''}
              onChange={(e) =>
                setCooperativeFilter(e.target.value ? Number(e.target.value) : null)
              }
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
            >
              <option value="">Semua Koperasi</option>
              {baseSnapshot.cooperatives.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-search"
              className="mb-1 block text-xs font-semibold text-stone-600"
            >
              Kata Kunci
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                id="filter-search"
                aria-label="Cari Laporan Warga"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari komoditas, koperasi, atau isi laporan..."
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Public Report Cards Feed */}
      <section aria-label="Daftar Laporan Masyarakat" className="space-y-4">
        {filteredView.reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-stone-700">
              Tidak ada laporan warga yang cocok dengan filter saat ini.
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Ubah kata kunci pencarian atau reset filter untuk melihat seluruh laporan.
            </p>
          </div>
        ) : (
          filteredView.reports.map((report) => (
            <article
              key={report.id}
              data-testid="wb-report-card"
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition-colors hover:border-emerald-300 sm:p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold',
                        STATUS_BADGE_CLASSES[report.status],
                      )}
                    >
                      {report.statusLabel}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold',
                        SEVERITY_BADGE_CLASSES[report.severity],
                      )}
                    >
                      {report.severityLabel}
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                      {report.categoryLabel}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-stone-900 sm:text-lg">
                    {report.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-700">
                    {report.description}
                  </p>
                </div>

                {canTriage && report.status !== 'SELESAI' ? (
                  <button
                    type="button"
                    data-testid={`triage-btn-${report.id}`}
                    onClick={() => openTriageModal(report)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap"
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Tindak Lanjuti Laporan</span>
                  </button>
                ) : null}
              </div>

              {/* Metadata & Entity Context Strip */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 pt-3 text-xs text-stone-600">
                <span className="inline-flex items-center gap-1.5 font-semibold text-stone-800">
                  <Lock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>{report.reporterDisplayName}</span>
                  <span className="font-normal text-stone-500">
                    ({report.reporterRoleLabel})
                  </span>
                </span>

                {report.cooperativeName ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                    <span>{report.cooperativeName}</span>
                  </span>
                ) : null}

                {report.kitchenName ? (
                  <span className="inline-flex items-center gap-1">
                    <ChefHat className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                    <span>{report.kitchenName}</span>
                  </span>
                ) : null}

                {report.deliveryId ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-stone-500">
                    <Truck className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                    <span>Pengiriman #{report.deliveryId}</span>
                  </span>
                ) : null}

                {report.photoPath ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800">
                    <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Bukti Foto: {report.photoPath}</span>
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 tabular-nums">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>{formatWibTimestamp(report.createdAtIso)}</span>
                </span>
              </div>

              {/* Official Response / Triage Note */}
              {report.responseNote ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-emerald-950">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <span>Tindak Lanjut Resmi</span>
                    {report.respondedBy ? (
                      <span className="font-medium text-emerald-800">
                        • Oleh {report.respondedBy}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 leading-relaxed text-stone-800">
                    {report.responseNote}
                  </p>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      {/* Role-Gated Triage Modal */}
      {triagingReport ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="triage-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700">
                  Tindak Lanjut Laporan #{triagingReport.id}
                </p>
                <h2
                  id="triage-modal-title"
                  className="mt-0.5 text-lg font-bold text-stone-900"
                >
                  {triagingReport.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTriagingReport(null)}
                aria-label="Tutup modal tindak lanjut"
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmTriage} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="triage-status"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Perbarui Status Penanganan
                </label>
                <select
                  id="triage-status"
                  value={triageStatus}
                  onChange={(e) =>
                    setTriageStatus(
                      e.target.value as 'DITINDAKLANJUTI' | 'SELESAI',
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900"
                >
                  <option value="DITINDAKLANJUTI">Sedang Ditindaklanjuti</option>
                  <option value="SELESAI">Selesai Ditangani</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="triage-note"
                  className="mb-1.5 block text-xs font-semibold text-stone-700"
                >
                  Catatan Penanganan Resmi (Tampil di Papan Publik)
                </label>
                <textarea
                  id="triage-note"
                  required
                  minLength={5}
                  rows={4}
                  value={triageNote}
                  onChange={(e) => setTriageNote(e.target.value)}
                  placeholder="Tuliskan langkah verifikasi, penggantian komoditas, atau penyelesaian di lapangan..."
                  className="w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <div className="rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs text-stone-600">
                Penanggung jawab tercatat:{' '}
                <strong className="text-stone-900">
                  {persona.name} ({persona.organization})
                </strong>
              </div>

              {triageError ? (
                <p role="alert" className="text-xs font-semibold text-rose-700">
                  {triageError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTriagingReport(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isTriaging}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isTriaging ? 'Menyimpan...' : 'Simpan Tindak Lanjut'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
