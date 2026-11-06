'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  QrCode,
  Send,
  Trash2,
  Truck,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { DeliveryPassCard } from '@/components/delivery-pass-card';
import type {
  CreateDeliveryDispatchRequest,
  CreateDeliveryDispatchResult,
  DeliveryPassView,
} from '@/lib/dispatch';
import { calculateLineTotal, formatRupiah } from '@/lib/procurement';
import type { Commodity, Cooperative, Farmer, Kitchen } from '@/db/schema';
import { cn } from '@/lib/utils';

/** Props for the DispatchOrderBuilder component. */
export interface DispatchOrderBuilderProps {
  readonly cooperative: Cooperative;
  readonly kitchens: readonly Kitchen[];
  readonly farmers: readonly Farmer[];
  readonly commodities: readonly Commodity[];
  readonly initialDispatches: readonly DeliveryPassView[];
  readonly onCreateDispatch?: (
    request: CreateDeliveryDispatchRequest,
  ) => Promise<CreateDeliveryDispatchResult>;
}

interface DraftDispatchRow {
  readonly key: string;
  readonly commodityId: number;
  readonly farmerId: number;
  readonly quantity: string;
  readonly unitPrice: string;
}

/**
 * Interactive Delivery Dispatch Order Creation & QR Delivery Pass (*Surat Jalan Digital*)
 * builder for Village Cooperative managers.
 */
export function DispatchOrderBuilder({
  cooperative,
  kitchens,
  farmers,
  commodities,
  initialDispatches,
  onCreateDispatch,
}: DispatchOrderBuilderProps) {
  const { role, canPerform } = useSession();

  const [dispatches, setDispatches] = useState<readonly DeliveryPassView[]>(
    initialDispatches,
  );
  const [selectedPassId, setSelectedPassId] = useState<number>(
    initialDispatches[0]?.id ?? 0,
  );
  const [kitchenId, setKitchenId] = useState<number>(kitchens[0]?.id ?? 1);
  const [scheduledDate, setScheduledDate] = useState<string>('2026-11-06');
  const [rows, setRows] = useState<readonly DraftDispatchRow[]>(() => {
    const firstCommodity = commodities[0];
    const firstFarmer = farmers[0];
    return [
      {
        key: 'row-1',
        commodityId: firstCommodity?.id ?? 1,
        farmerId: firstFarmer?.id ?? 1,
        quantity: '150',
        unitPrice: String(firstCommodity?.benchmarkPrice ?? 13500),
      },
    ];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    readonly type: 'success' | 'error';
    readonly message: string;
  } | null>(null);

  const activePass = useMemo(
    () => dispatches.find((d) => d.id === selectedPassId) ?? dispatches[0] ?? null,
    [dispatches, selectedPassId],
  );

  const estimatedTotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + calculateLineTotal(Number(row.quantity), Number(row.unitPrice)),
        0,
      ),
    [rows],
  );

  const handleAddRow = () => {
    const nextCommodity = commodities[rows.length % commodities.length] ?? commodities[0];
    const nextFarmer = farmers[rows.length % farmers.length] ?? farmers[0];
    setRows((prev) => [
      ...prev,
      {
        key: `row-${Date.now()}-${prev.length + 1}`,
        commodityId: nextCommodity?.id ?? 1,
        farmerId: nextFarmer?.id ?? 1,
        quantity: '100',
        unitPrice: String(nextCommodity?.benchmarkPrice ?? 13500),
      },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length <= 1) {
      return;
    }
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const handleRowCommodityChange = (key: string, newCommodityId: number) => {
    const found = commodities.find((c) => c.id === newCommodityId);
    setRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              commodityId: newCommodityId,
              unitPrice: found ? String(found.benchmarkPrice) : row.unitPrice,
            }
          : row,
      ),
    );
  };

  const handleRowChange = (
    key: string,
    field: 'farmerId' | 'quantity' | 'unitPrice',
    value: string | number,
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!onCreateDispatch) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await onCreateDispatch({
        role,
        cooperativeId: cooperative.id,
        kitchenId,
        scheduledDate,
        items: rows.map((row) => ({
          commodityId: row.commodityId,
          farmerId: row.farmerId,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
        })),
      });

      if (!response.success) {
        setFeedback({ type: 'error', message: response.error });
        return;
      }

      setDispatches((prev) => [response.dispatch, ...prev]);
      setSelectedPassId(response.dispatch.id);
      setFeedback({
        type: 'success',
        message: `Surat Jalan Digital berhasil diterbitkan dengan token ${response.dispatch.qrToken}!`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreateDispatch = canPerform('CREATE_DISPATCH');

  return (
    <section className="space-y-8" aria-labelledby="dispatch-section-heading">
      {canCreateDispatch ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="dispatch-section-heading"
                  className="text-lg font-bold text-stone-900"
                >
                  Buat Pesanan Pengiriman &amp; Terbitkan Surat Jalan QR
                </h2>
                <p className="text-xs text-stone-600">
                  Pilih Dapur SPPG tujuan, susun daftar komoditas, dan cetak Surat Jalan Digital
                  ber-QR.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="dispatch-kitchen"
                  className="block text-sm font-semibold text-stone-800"
                >
                  Dapur SPPG Tujuan
                </label>
                <select
                  id="dispatch-kitchen"
                  value={kitchenId}
                  onChange={(e) => setKitchenId(Number(e.target.value))}
                  className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  {kitchens.map((kitchen) => (
                    <option key={kitchen.id} value={kitchen.id}>
                      {kitchen.name} ({kitchen.regency} • Kapasitas {kitchen.dailyCapacity}{' '}
                      porsi/hari)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="dispatch-date"
                  className="block text-sm font-semibold text-stone-800"
                >
                  Tanggal Pengiriman Terjadwal
                </label>
                <input
                  id="dispatch-date"
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1.5 block min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            {/* Line Item Picker */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Daftar Muatan Komoditas Pengiriman
                </h3>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Tambah Baris Komoditas</span>
                </button>
              </div>

              <div className="space-y-3">
                {rows.map((row, index) => {
                  const commodityObj = commodities.find((c) => c.id === row.commodityId);
                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-4 sm:grid-cols-12 sm:items-end"
                    >
                      <div className="sm:col-span-4">
                        <label
                          htmlFor={`item-commodity-${index}`}
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Pilih Komoditas #{index + 1}
                        </label>
                        <select
                          id={`item-commodity-${index}`}
                          value={row.commodityId}
                          onChange={(e) =>
                            handleRowCommodityChange(row.key, Number(e.target.value))
                          }
                          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                        >
                          {commodities.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label
                          htmlFor={`item-farmer-${index}`}
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Petani Pemasok
                        </label>
                        <select
                          id={`item-farmer-${index}`}
                          value={row.farmerId}
                          onChange={(e) =>
                            handleRowChange(row.key, 'farmerId', Number(e.target.value))
                          }
                          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                        >
                          {farmers.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`item-qty-${index}`}
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Kuantitas ({commodityObj?.unit ?? 'kg'})
                        </label>
                        <input
                          id={`item-qty-${index}`}
                          type="number"
                          min="1"
                          step="any"
                          required
                          value={row.quantity}
                          onChange={(e) =>
                            handleRowChange(row.key, 'quantity', e.target.value)
                          }
                          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`item-price-${index}`}
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Harga Satuan (Rp)
                        </label>
                        <input
                          id={`item-price-${index}`}
                          type="number"
                          min="100"
                          step="100"
                          required
                          value={row.unitPrice}
                          onChange={(e) =>
                            handleRowChange(row.key, 'unitPrice', e.target.value)
                          }
                          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                        />
                      </div>

                      <div className="flex items-center justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.key)}
                          disabled={rows.length <= 1}
                          aria-label={`Hapus baris komoditas ${index + 1}`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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

            <div className="flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-700">
                Estimasi Total Surat Jalan:{' '}
                <span className="text-base font-bold text-emerald-800">
                  {formatRupiah(estimatedTotal)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-stone-950 shadow-xs transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? 'Menerbitkan QR...'
                    : 'Terbitkan Surat Jalan Digital & Kirim'}
                </span>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Digital Delivery Pass Selector & Active Surat Jalan Digital View */}
      {dispatches.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-lg font-bold text-stone-900">
                Daftar Surat Jalan Digital Ber-QR ({dispatches.length})
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {dispatches.map((pass) => {
                const isSelected = activePass?.id === pass.id;
                return (
                  <button
                    key={pass.id}
                    type="button"
                    onClick={() => setSelectedPassId(pass.id)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors',
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100',
                    )}
                  >
                    <span>#{pass.id}</span>
                    <span>•</span>
                    <span>{pass.scheduledDate}</span>
                    <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px]">
                      {pass.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activePass ? <DeliveryPassCard pass={activePass} /> : null}
        </div>
      ) : null}
    </section>
  );
}
