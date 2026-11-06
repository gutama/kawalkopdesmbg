'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  PackagePlus,
  Scale,
  Sprout,
  UserCheck,
  Users,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { FairPriceChecker } from '@/components/fair-price-checker';
import {
  formatRupiah,
  summarizeProcurementItems,
  type FairPriceStatus,
} from '@/lib/procurement';
import type {
  CooperativeProcurementWorkspace,
  ProcurementLedgerItem,
  RecordFarmerProcurementRequest,
  RecordFarmerProcurementResult,
} from '@/lib/procurement-service';
import { cn } from '@/lib/utils';

/** Props for the ProcurementWorkspace component. */
export interface ProcurementWorkspaceProps {
  readonly initialWorkspace: CooperativeProcurementWorkspace;
  readonly onSubmitProcurement?: (
    request: RecordFarmerProcurementRequest,
  ) => Promise<RecordFarmerProcurementResult>;
}

const BADGE_STYLE: Record<FairPriceStatus, string> = {
  FAIR: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  BELOW_BENCHMARK: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/20',
  ABOVE_BENCHMARK: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20',
};

/**
 * Interactive Cooperative Procurement & Fair Price Checker workspace allowing
 * Koperasi managers to record local farmer produce, compare purchase prices
 * against regional government benchmarks, and inspect the procurement ledger.
 */
export function ProcurementWorkspace({
  initialWorkspace,
  onSubmitProcurement,
}: ProcurementWorkspaceProps) {
  const { role, setRole, canPerform } = useSession();

  const [items, setItems] = useState<readonly ProcurementLedgerItem[]>(
    initialWorkspace.items,
  );
  const [selectedFarmerId, setSelectedFarmerId] = useState<number>(
    initialWorkspace.farmers[0]?.id ?? 1,
  );
  const [selectedCommodityId, setSelectedCommodityId] = useState<number>(
    initialWorkspace.commodities[0]?.id ?? 1,
  );
  const [quantity, setQuantity] = useState<string>('100');
  const [unitPrice, setUnitPrice] = useState<string>(
    String(initialWorkspace.commodities[0]?.benchmarkPrice ?? 13500),
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    readonly type: 'success' | 'error';
    readonly message: string;
  } | null>(null);

  const selectedCommodity = useMemo(
    () =>
      initialWorkspace.commodities.find((c) => c.id === selectedCommodityId) ??
      initialWorkspace.commodities[0],
    [initialWorkspace.commodities, selectedCommodityId],
  );

  const liveSummary = useMemo(
    () =>
      summarizeProcurementItems(
        items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          benchmarkPrice: item.benchmarkPrice,
        })),
      ),
    [items],
  );

  const handleCommodityChange = (newCommodityId: number) => {
    setSelectedCommodityId(newCommodityId);
    const found = initialWorkspace.commodities.find((c) => c.id === newCommodityId);
    if (found) {
      setUnitPrice(String(found.benchmarkPrice));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!onSubmitProcurement) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await onSubmitProcurement({
        role,
        cooperativeId: initialWorkspace.cooperative.id,
        farmerId: selectedFarmerId,
        commodityId: selectedCommodityId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
      });

      if (!response.success) {
        setFeedback({ type: 'error', message: response.error });
        return;
      }

      setItems((prev) => [response.item, ...prev]);
      setFeedback({
        type: 'success',
        message: `Pengadaan hasil tani berhasil dicatat: ${response.item.quantity} ${response.item.unit} ${response.item.commodityName} dari ${response.item.farmerName}.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canRecordProcurement = canPerform('RECORD_PROCUREMENT');

  return (
    <div className="space-y-8">
      {/* Cooperative Banner & Summary KPIs */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-700/70 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Portal Pengadaan &amp; Harga Wajar Koperasi Desa
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {initialWorkspace.cooperative.name}
            </h1>
            <p className="text-sm text-emerald-100">
              {initialWorkspace.cooperative.village}, {initialWorkspace.cooperative.district},{' '}
              {initialWorkspace.cooperative.regency} • Penanggung Jawab:{' '}
              {initialWorkspace.cooperative.contactName}
            </p>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-700/80 bg-emerald-950/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Coins className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Total Nilai Pembelian Petani
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {formatRupiah(liveSummary.totalValue)}
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              Dari {liveSummary.totalItems} transaksi pasokan petani desa
            </p>
          </div>

          <div className="rounded-xl border border-emerald-700/80 bg-emerald-950/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Scale className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Kepatuhan Harga Wajar
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {liveSummary.overallFairnessRatio}%
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              {liveSummary.fairItemsCount} sesuai acuan • {liveSummary.belowBenchmarkCount} di
              bawah acuan
            </p>
          </div>

          <div className="rounded-xl border border-emerald-700/80 bg-emerald-950/70 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Users className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Petani Mitra Terdaftar
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {initialWorkspace.farmers.length} Petani
            </p>
            <p className="mt-1 text-xs text-emerald-200">
              Pemasok aktif komoditas segar MBG
            </p>
          </div>
        </div>
      </section>

      {/* Role Guard or Procurement Form */}
      {!canRecordProcurement ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-stone-900 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-900">
                <UserCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-bold">
                  Aktifkan Peran Pengurus Koperasi untuk Mencatat Pengadaan
                </h2>
              </div>
              <p className="text-sm text-stone-700">
                Anda sedang mengakses halaman ini dalam mode{' '}
                <span className="font-semibold">{role}</span>. Beralihlah ke peran Pengurus
                Koperasi untuk mencatat pembelian hasil panen petani lokal.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRole('KOPERASI_ADMIN')}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
            >
              Beralih ke Peran Pengurus Koperasi
            </button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Procurement Recording Form */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  Catat Serapan Hasil Petani Lokal
                </h2>
                <p className="text-xs text-stone-600">
                  Pastikan harga beli koperasi memenuhi standar Harga Acuan Pemerintah Daerah.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="procurement-farmer"
                    className="block text-sm font-semibold text-stone-800"
                  >
                    Petani Lokal Pemasok
                  </label>
                  <select
                    id="procurement-farmer"
                    value={selectedFarmerId}
                    onChange={(e) => setSelectedFarmerId(Number(e.target.value))}
                    className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {initialWorkspace.farmers.map((farmer) => (
                      <option key={farmer.id} value={farmer.id}>
                        {farmer.name} ({farmer.village})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="procurement-commodity"
                    className="block text-sm font-semibold text-stone-800"
                  >
                    Komoditas Pangan MBG
                  </label>
                  <select
                    id="procurement-commodity"
                    value={selectedCommodityId}
                    onChange={(e) => handleCommodityChange(Number(e.target.value))}
                    className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {initialWorkspace.commodities.map((commodity) => (
                      <option key={commodity.id} value={commodity.id}>
                        {commodity.name} — Acuan {formatRupiah(commodity.benchmarkPrice)}/
                        {commodity.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="procurement-quantity"
                    className="block text-sm font-semibold text-stone-800"
                  >
                    Jumlah Pasokan ({selectedCommodity?.unit ?? 'kg'})
                  </label>
                  <input
                    id="procurement-quantity"
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="procurement-unit-price"
                    className="block text-sm font-semibold text-stone-800"
                  >
                    Harga Beli Koperasi per {selectedCommodity?.unit ?? 'kg'} (Rp)
                  </label>
                  <input
                    id="procurement-unit-price"
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              {selectedCommodity ? (
                <FairPriceChecker
                  commodityName={selectedCommodity.name}
                  unit={selectedCommodity.unit}
                  benchmarkPrice={selectedCommodity.benchmarkPrice}
                  unitPrice={Number(unitPrice)}
                  quantity={Number(quantity)}
                />
              ) : null}

              {feedback ? (
                <div
                  role="status"
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-4 text-sm font-medium',
                    feedback.type === 'success'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-red-300 bg-red-50 text-red-900',
                  )}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-700" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
                >
                  <Sprout className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Catatan Pengadaan'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Regional Benchmark Price Reference Card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-600" aria-hidden="true" />
              <h3 className="text-base font-bold text-stone-900">
                Daftar Harga Acuan Daerah
              </h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Patokan harga komoditas pangan segar MBG agar petani lokal terlindungi dari
              praktik tengkulak.
            </p>

            <ul className="mt-4 divide-y divide-stone-100">
              {initialWorkspace.commodities.map((commodity) => (
                <li
                  key={commodity.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-stone-900">{commodity.name}</p>
                    <p className="text-xs text-stone-500">Satuan: {commodity.unit}</p>
                  </div>
                  <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-bold text-stone-800">
                    {formatRupiah(commodity.benchmarkPrice)}/{commodity.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Recorded Farmer Produce Ledger */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              Riwayat Serapan Komoditas Petani Lokal
            </h2>
            <p className="text-xs text-stone-600">
              Transparansi harga beli koperasi dibandingkan terhadap harga acuan pemerintah
              daerah.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <th className="py-3 pr-4">Komoditas &amp; Petani</th>
                <th className="px-4 py-3">Jumlah</th>
                <th className="px-4 py-3">Harga Beli vs Acuan</th>
                <th className="px-4 py-3">Total Nilai</th>
                <th className="py-3 pl-4">Status Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/80">
                  <td className="py-3.5 pr-4">
                    <p className="font-bold text-stone-900">{item.commodityName}</p>
                    <p className="text-xs text-stone-600">
                      {item.farmerName} • {item.farmerVillage}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-stone-800">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-stone-900">
                      {formatRupiah(item.unitPrice)}/{item.unit}
                    </p>
                    <p className="text-xs text-stone-500">
                      Acuan: {formatRupiah(item.benchmarkPrice)}/{item.unit}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-emerald-800">
                    {formatRupiah(item.totalValue)}
                  </td>
                  <td className="py-3.5 pl-4">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold',
                        BADGE_STYLE[item.evaluation.status],
                      )}
                    >
                      {item.evaluation.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
