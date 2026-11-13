'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChefHat,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  Lock,
  MapPin,
  MessageSquareWarning,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { formatRupiah } from '@/lib/procurement';
import {
  DEFAULT_PUBLIC_TRANSPARENCY_SNAPSHOT,
  filterPublicTransparencySnapshot,
  type PublicDeliveryRecord,
  type PublicTransparencyFilter,
  type PublicTransparencySnapshot,
} from '@/lib/transparency';
import { cn } from '@/lib/utils';

/** Props for the PublicTransparencyDashboard component. */
export interface PublicTransparencyDashboardProps {
  readonly initialSnapshot?: PublicTransparencySnapshot;
  readonly onRefreshSnapshot?: () => Promise<PublicTransparencySnapshot>;
}

/**
 * Formats an ISO-8601 timestamp into a readable Bahasa Indonesia date/time label.
 */
function formatIndonesianTimestamp(iso: string | null): string {
  if (!iso) {
    return 'Menunggu konfirmasi';
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

/**
 * Phase 5 Public Transparency Dashboard displaying real-time aggregated KPI cards,
 * regional & entity filter controls, commodity absorption & fair-price compliance
 * breakdown, and a verified delivery timeline with immutable Proof-of-Delivery receipts.
 */
export function PublicTransparencyDashboard({
  initialSnapshot = DEFAULT_PUBLIC_TRANSPARENCY_SNAPSHOT,
  onRefreshSnapshot,
}: PublicTransparencyDashboardProps) {
  const [baseSnapshot, setBaseSnapshot] =
    useState<PublicTransparencySnapshot>(initialSnapshot);
  const [selectedCooperativeId, setSelectedCooperativeId] = useState<number | null>(
    null,
  );
  const [selectedKitchenId, setSelectedKitchenId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<
    'ALL' | 'VERIFIED' | 'DISPATCHED'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedDelivery, setInspectedDelivery] =
    useState<PublicDeliveryRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const activeFilter: PublicTransparencyFilter = useMemo(
    () => ({
      cooperativeId: selectedCooperativeId,
      kitchenId: selectedKitchenId,
      status: selectedStatus,
      searchQuery,
    }),
    [selectedCooperativeId, selectedKitchenId, selectedStatus, searchQuery],
  );

  const filteredView = useMemo(
    () => filterPublicTransparencySnapshot(baseSnapshot, activeFilter),
    [baseSnapshot, activeFilter],
  );

  const hasActiveFilter =
    selectedCooperativeId !== null ||
    selectedKitchenId !== null ||
    selectedStatus !== 'ALL' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCooperativeId(null);
    setSelectedKitchenId(null);
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  const handleRefresh = async () => {
    if (!onRefreshSnapshot) {
      return;
    }
    setIsRefreshing(true);
    try {
      const fresh = await onRefreshSnapshot();
      setBaseSnapshot(fresh);
    } finally {
      setIsRefreshing(false);
    }
  };

  const { kpis, commodityBreakdown, deliveries, cooperatives, kitchens } =
    filteredView;

  return (
    <section
      aria-labelledby="public-transparency-heading"
      className="space-y-8"
    >
      {/* Section Header & Refresh Action */}
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Audit Publik Terbuka</span>
            <span aria-hidden="true">·</span>
            <span>Data Terlindung Privasi</span>
            <span aria-hidden="true">·</span>
            <span>Bukti Terima Permanen</span>
          </div>
          <h2
            id="public-transparency-heading"
            className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl"
          >
            Dashboard Transparansi Publik Pasokan Pangan MBG
          </h2>
          <p className="max-w-3xl text-sm text-stone-600">
            Pantau serapan hasil panen petani lokal, aliran dana koperasi desa, kepatuhan harga
            acuan pemerintah daerah, serta bukti fisik penerimaan di Dapur SPPG secara langsung.
          </p>
        </div>

        {onRefreshSnapshot ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-100 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              aria-hidden="true"
            />
            <span>{isRefreshing ? 'Memuat Data...' : 'Segarkan Data'}</span>
          </button>
        ) : null}
      </div>

      {/* 1. Live KPI Summary Ribbon */}
      <div
        role="region"
        aria-label="Ringkasan Indikator Kinerja Transparansi"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* KPI 1: Total Funds Channeled */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-stone-600">
              Total Dana Terserap Koperasi
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <p
              data-testid="kpi-total-funds"
              className="font-mono text-2xl font-bold tracking-tight text-stone-900 tabular-nums"
            >
              {formatRupiah(kpis.totalFundsChanneledIdr)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 tabular-nums">
              <span className="font-semibold text-emerald-800">
                Terverifikasi: {formatRupiah(kpis.verifiedFundsChanneledIdr)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Transit: {formatRupiah(kpis.inTransitFundsIdr)}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Local Produce Volume Absorbed */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-stone-600">
              Volume Pangan Lokal Terserap
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <PackageCheck className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <p
              data-testid="kpi-total-volume"
              className="font-mono text-2xl font-bold tracking-tight text-stone-900 tabular-nums"
            >
              {kpis.totalWeightKg.toLocaleString('id-ID')} kg
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 tabular-nums">
              <span>
                Total {kpis.totalProduceVolume.toLocaleString('id-ID')} unit lintas komoditas
              </span>
              <span aria-hidden="true">·</span>
              <span>{commodityBreakdown.length} jenis pangan</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Cooperatives, Farmers & Fair Price Compliance */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-stone-600">
              Koperasi Desa &amp; Petani Lokal
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <p
              data-testid="kpi-cooperatives-farmers"
              className="font-mono text-2xl font-bold tracking-tight text-stone-900 tabular-nums"
            >
              {kpis.participatingCooperativesCount} Koperasi · {kpis.participatingFarmersCount}{' '}
              Petani
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 tabular-nums">
              <span className="font-semibold text-emerald-800">
                {kpis.overallFairPriceCompliancePercent}% transaksi harga wajar
              </span>
              <span aria-hidden="true">·</span>
              <span>Sesuai acuan pemda</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Verified Deliveries & SPPG Kitchen Capacity */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-stone-600">
              Verifikasi PoD &amp; Dapur SPPG
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <p
              data-testid="kpi-verified-deliveries"
              className="font-mono text-2xl font-bold tracking-tight text-stone-900 tabular-nums"
            >
              {kpis.verifiedDeliveriesCount}/{kpis.totalDeliveriesCount} Terverifikasi (
              {kpis.verificationRatePercent}%)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 tabular-nums">
              <span>{kpis.supportedKitchensCount} Dapur SPPG</span>
              <span aria-hidden="true">·</span>
              <span>
                Kapasitas {kpis.totalDailyMealCapacity.toLocaleString('id-ID')} porsi/hari
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Regional & Entity Filter Controls */}
      <div
        role="region"
        aria-label="Filter Wilayah dan Pengiriman Publik"
        className="rounded-2xl border border-stone-200 bg-white p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Cooperative Selector */}
            <div>
              <label
                htmlFor="filter-cooperative-select"
                className="block text-xs font-semibold text-stone-700"
              >
                Filter Koperasi Desa / Wilayah Asal
              </label>
              <select
                id="filter-cooperative-select"
                value={selectedCooperativeId ?? ''}
                onChange={(e) =>
                  setSelectedCooperativeId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">Semua Koperasi Desa ({cooperatives.length})</option>
                {cooperatives.map((coop) => (
                  <option key={coop.id} value={coop.id}>
                    {coop.name} — {coop.regency}
                  </option>
                ))}
              </select>
            </div>

            {/* SPPG Kitchen Selector */}
            <div>
              <label
                htmlFor="filter-kitchen-select"
                className="block text-xs font-semibold text-stone-700"
              >
                Filter Dapur Gizi SPPG Tujuan
              </label>
              <select
                id="filter-kitchen-select"
                value={selectedKitchenId ?? ''}
                onChange={(e) =>
                  setSelectedKitchenId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="">Semua Dapur SPPG ({kitchens.length})</option>
                {kitchens.map((kitchen) => (
                  <option key={kitchen.id} value={kitchen.id}>
                    {kitchen.name} ({kitchen.regency})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label
                htmlFor="filter-public-search"
                className="block text-xs font-semibold text-stone-700"
              >
                Cari Komoditas, Desa, atau Token QR
              </label>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  id="filter-public-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Contoh: Beras, Cibogo, Banyumas..."
                  className="block min-h-11 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>
          </div>

          {/* Segmented Status Filter + Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <div
              role="group"
              aria-label="Filter Status Pengiriman"
              className="inline-flex items-center gap-1 rounded-xl bg-stone-100 p-1"
            >
              {(
                [
                  { id: 'ALL', label: 'Semua Status' },
                  { id: 'VERIFIED', label: 'Terverifikasi PoD' },
                  { id: 'DISPATCHED', label: 'Dalam Pengiriman' },
                ] as const
              ).map((tab) => {
                const isActive = selectedStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedStatus(tab.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                      isActive
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900',
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {hasActiveFilter ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Filter</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 3. Commodity Absorption & Fair-Price Compliance Breakdown */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-col gap-2 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 sm:text-lg">
                Serapan Komoditas Pangan Lokal &amp; Kepatuhan Harga Wajar Petani
              </h3>
              <p className="text-xs text-stone-600">
                Perbandingan harga beli rata-rata koperasi desa terhadap Harga Acuan Pemerintah
                Daerah (Pemda).
              </p>
            </div>
          </div>
          <div className="text-xs font-medium text-stone-600 tabular-nums">
            <span>Kepatuhan Harga Wajar: </span>
            <span className="font-mono font-bold text-emerald-800">
              {kpis.overallFairPriceCompliancePercent}%
            </span>
          </div>
        </div>

        {commodityBreakdown.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-stone-800">
              Tidak ada data komoditas yang cocok dengan filter saat ini.
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Silakan ubah pilihan koperasi desa, dapur SPPG, atau kata kunci pencarian.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500">
                  <th className="py-3 pr-4">Komoditas Pangan</th>
                  <th className="px-3 py-3 text-right">Volume Diserap</th>
                  <th className="px-3 py-3 text-right">Terverifikasi SPPG</th>
                  <th className="px-3 py-3 text-right">Rata-rata Harga Beli</th>
                  <th className="px-3 py-3 text-right">Harga Acuan Pemda</th>
                  <th className="px-3 py-3 text-right">Nilai Terserap</th>
                  <th className="pl-3 py-3 text-right">Status Keadilan Harga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {commodityBreakdown.map((item) => {
                  const sharePercent =
                    kpis.totalFundsChanneledIdr > 0
                      ? Math.round(
                          (item.totalValueIdr / kpis.totalFundsChanneledIdr) * 100,
                        )
                      : 0;

                  return (
                    <tr
                      key={item.commodityId}
                      className="transition-colors hover:bg-stone-50/80"
                    >
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-stone-900">
                          {item.commodityName}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-stone-500 tabular-nums">
                          <span>{item.transactionCount} transaksi petani</span>
                          <span aria-hidden="true">·</span>
                          <span>{sharePercent}% porsi anggaran</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm font-semibold text-stone-900 tabular-nums">
                        {item.totalQuantity.toLocaleString('id-ID')} {item.unit}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm text-emerald-800 tabular-nums">
                        {item.verifiedQuantity.toLocaleString('id-ID')} {item.unit}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm font-semibold text-stone-900 tabular-nums">
                        {formatRupiah(item.averageUnitPriceIdr)}/{item.unit}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm text-stone-600 tabular-nums">
                        {formatRupiah(item.benchmarkPrice)}/{item.unit}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm font-bold text-stone-900 tabular-nums">
                        {formatRupiah(item.totalValueIdr)}
                      </td>
                      <td className="pl-3 py-3.5 text-right">
                        <div
                          className={cn(
                            'inline-flex items-center justify-end gap-1.5 text-xs font-semibold',
                            item.fairEvaluation.status === 'BELOW_BENCHMARK'
                              ? 'text-red-700'
                              : item.fairEvaluation.status === 'ABOVE_BENCHMARK'
                                ? 'text-amber-800'
                                : 'text-emerald-800',
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.fairEvaluation.label}</span>
                        </div>
                        <div className="text-[11px] text-stone-500 tabular-nums">
                          {item.fairCompliancePercent}% patuh acuan
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Verified Delivery Feed & Immutable Proof-of-Delivery Receipts */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              Linimasa Pengiriman Koperasi Desa &amp; Bukti Terima (PoD) SPPG
            </h3>
            <p className="text-xs text-stone-600">
              Menampilkan {deliveries.length} pengiriman publik (data kontak pribadi petani
              disamarkan demi perlindungan privasi).
            </p>
          </div>
        </div>

        {deliveries.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
            <Filter
              className="mx-auto h-8 w-8 text-stone-400"
              aria-hidden="true"
            />
            <h4 className="mt-3 text-base font-bold text-stone-900">
              Belum Ada Pengiriman yang Sesuai Filter
            </h4>
            <p className="mt-1 text-xs text-stone-600">
              Coba pilih semua koperasi atau tekan tombol Reset Filter untuk menampilkan seluruh
              riwayat pengiriman.
            </p>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Tampilkan Semua Pengiriman</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => {
              const isVerified = delivery.status === 'VERIFIED';

              return (
                <article
                  key={delivery.id}
                  data-testid={`public-delivery-card-${delivery.id}`}
                  className="rounded-2xl border border-stone-200 bg-white p-6 transition-colors hover:border-stone-300"
                >
                  {/* Top Metadata Row */}
                  <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 tabular-nums">
                        <span className="font-mono font-bold text-stone-900">
                          Pengiriman #{delivery.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                          Jadwal: {delivery.scheduledDate}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] text-stone-500">
                          Token QR: {delivery.qrToken}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-stone-900">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2
                            className="h-4 w-4 text-emerald-700"
                            aria-hidden="true"
                          />
                          {delivery.cooperativeName}
                        </span>
                        <span className="text-stone-400" aria-hidden="true">
                          →
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ChefHat className="h-4 w-4 text-amber-700" aria-hidden="true" />
                          {delivery.kitchenName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {delivery.cooperativeVillage}, {delivery.cooperativeRegency},{' '}
                          {delivery.cooperativeProvince}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Kapasitas Dapur:{' '}
                          {delivery.kitchenDailyCapacity.toLocaleString('id-ID')} porsi/hari
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                            <span>TERVERIFIKASI SPPG (PoD)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-800">
                            <Truck className="h-4 w-4 text-amber-600" aria-hidden="true" />
                            <span>DALAM PENGIRIMAN (DISPATCHED)</span>
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-lg font-bold text-stone-900 tabular-nums">
                        {formatRupiah(delivery.totalValueIdr)}
                      </p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-stone-500">
                          <th className="pb-2 font-semibold">Komoditas</th>
                          <th className="pb-2 font-semibold">Asal Petani Lokal</th>
                          <th className="pb-2 text-right font-semibold">Kuantitas</th>
                          <th className="pb-2 text-right font-semibold">Harga Beli Petani</th>
                          <th className="pb-2 text-right font-semibold">Acuan Pemda</th>
                          <th className="pb-2 text-right font-semibold">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {delivery.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 font-semibold text-stone-900">
                              {item.commodityName}
                            </td>
                            <td className="py-2 text-stone-600">{item.farmerLabel}</td>
                            <td className="py-2 text-right font-mono font-semibold text-stone-900 tabular-nums">
                              {item.quantity.toLocaleString('id-ID')} {item.unit}
                            </td>
                            <td className="py-2 text-right font-mono text-stone-800 tabular-nums">
                              {formatRupiah(item.unitPrice)}/{item.unit}
                            </td>
                            <td className="py-2 text-right font-mono text-stone-500 tabular-nums">
                              {formatRupiah(item.benchmarkPrice)}/{item.unit}
                            </td>
                            <td className="py-2 text-right font-mono font-semibold text-stone-900 tabular-nums">
                              {formatRupiah(item.totalValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Immutable Proof of Delivery Summary Strip */}
                  {delivery.proofOfDelivery ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-emerald-950">
                          <Lock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                          <span>Bukti Terima Permanen (Immutable PoD)</span>
                          <span aria-hidden="true">·</span>
                          <span>Diterima oleh: {delivery.proofOfDelivery.receiverName}</span>
                        </div>
                        <p className="text-stone-700">
                          Catatan Pemeriksaan:{' '}
                          <span className="font-medium">
                            {delivery.proofOfDelivery.signOffNote ??
                              'Komoditas diterima sesuai surat jalan.'}
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            Waktu Verifikasi:{' '}
                            {formatIndonesianTimestamp(delivery.proofOfDelivery.verifiedAtIso)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            Bukti Foto: {delivery.proofOfDelivery.photoPath}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                          href={`/laporan?deliveryId=${delivery.id}`}
                          data-testid={`report-delivery-link-${delivery.id}`}
                          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 whitespace-nowrap"
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                          <span>Laporkan Kendala</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setInspectedDelivery(delivery)}
                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Lihat Bukti Terima (PoD)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-amber-600" aria-hidden="true" />
                        <span>
                          Sedang dalam perjalanan menuju{' '}
                          <strong className="text-stone-900">{delivery.kitchenName}</strong>.
                          Menunggu pemindaian QR &amp; foto bukti terima oleh petugas SPPG.
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-[11px] text-stone-500 tabular-nums">
                          Total Muatan: {delivery.totalQuantity.toLocaleString('id-ID')} unit
                        </span>
                        <Link
                          href={`/laporan?deliveryId=${delivery.id}`}
                          data-testid={`report-delivery-link-${delivery.id}`}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 whitespace-nowrap"
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                          <span>Laporkan Kendala</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Immutable Proof-of-Delivery (PoD) Receipt Inspector Modal */}
      {inspectedDelivery && inspectedDelivery.proofOfDelivery ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pod-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  <span>BERITA ACARA SERAH TERIMA DIGITAL (IMMUTABLE PoD)</span>
                </div>
                <h3 id="pod-modal-title" className="text-lg font-bold text-stone-900">
                  Bukti Terima Pengiriman #{inspectedDelivery.id} —{' '}
                  {inspectedDelivery.cooperativeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedDelivery(null)}
                aria-label="Tutup rincian bukti terima"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                  <p className="text-xs text-stone-500">Asal Koperasi Desa</p>
                  <p className="mt-0.5 font-bold text-stone-900">
                    {inspectedDelivery.cooperativeName}
                  </p>
                  <p className="text-xs text-stone-600">
                    {inspectedDelivery.cooperativeVillage},{' '}
                    {inspectedDelivery.cooperativeRegency}
                  </p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                  <p className="text-xs text-stone-500">Dapur SPPG Penerima</p>
                  <p className="mt-0.5 font-bold text-stone-900">
                    {inspectedDelivery.kitchenName}
                  </p>
                  <p className="text-xs text-stone-600">
                    {inspectedDelivery.kitchenRegency} • Kapasitas{' '}
                    {inspectedDelivery.kitchenDailyCapacity.toLocaleString('id-ID')} porsi/hari
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-950">
                    Petugas Pemeriksa &amp; Penerima SPPG
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Terkunci Permanen di Database
                  </span>
                </div>
                <p className="font-bold text-stone-900">
                  {inspectedDelivery.proofOfDelivery.receiverName}
                </p>
                <p className="text-xs text-stone-700">
                  Catatan Pemeriksaan:{' '}
                  <span className="font-medium">
                    {inspectedDelivery.proofOfDelivery.signOffNote}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-stone-600 tabular-nums">
                  <span>
                    Waktu Pengesahan:{' '}
                    {formatIndonesianTimestamp(
                      inspectedDelivery.proofOfDelivery.verifiedAtIso,
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">
                    Token QR: {inspectedDelivery.qrToken}
                  </span>
                </div>
              </div>

              {/* Photo Evidence Preview Container */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    Arsip Foto Fisik Komoditas Terverifikasi
                  </span>
                  <span className="font-mono text-xs text-emerald-800">
                    {inspectedDelivery.proofOfDelivery.photoPath}
                  </span>
                </div>
                <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-600/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 p-6 text-center text-white">
                  <ShieldCheck
                    className="h-10 w-10 text-amber-400"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-bold">
                    Bukti Foto Komoditas Pangan Terverifikasi SPPG
                  </p>
                  <p className="mt-1 max-w-md text-xs text-emerald-200">
                    Arsip gambar terkompresi ({inspectedDelivery.proofOfDelivery.photoPath})
                    telah divalidasi bersama tanda tangan digital penerima dan tidak dapat diubah
                    (immutable SQLite trigger).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                <div>
                  <span className="text-xs text-stone-500">Total Nilai Pengiriman</span>
                  <p className="font-mono text-lg font-bold text-emerald-800 tabular-nums">
                    {formatRupiah(inspectedDelivery.totalValueIdr)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedDelivery(null)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-stone-800"
                >
                  Tutup Bukti Terima
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
