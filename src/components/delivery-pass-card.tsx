'use client';

import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChefHat,
  Copy,
  Printer,
  QrCode,
  Share2,
  Truck,
} from 'lucide-react';
import type { DeliveryPassView } from '@/lib/dispatch';
import { formatRupiah } from '@/lib/procurement';
import type { DeliveryStatus } from '@/db/schema';
import { cn } from '@/lib/utils';

/** Props for the printable/shareable DeliveryPassCard component. */
export interface DeliveryPassCardProps {
  readonly pass: DeliveryPassView;
}

const STATUS_BADGE: Record<
  DeliveryStatus,
  { readonly label: string; readonly className: string }
> = {
  DRAFT: {
    label: 'DRAFT — Persiapan Gudang',
    className: 'bg-stone-100 text-stone-800 ring-stone-400/30',
  },
  DISPATCHED: {
    label: 'DISPATCHED — Dalam Pengiriman',
    className: 'bg-amber-100 text-amber-900 ring-amber-500/30',
  },
  VERIFIED: {
    label: 'VERIFIED — Diterima & Terverifikasi SPPG',
    className: 'bg-emerald-100 text-emerald-900 ring-emerald-500/30',
  },
  REJECTED: {
    label: 'REJECTED — Ditolak / Revisi',
    className: 'bg-red-100 text-red-900 ring-red-500/30',
  },
};

/**
 * Renders an official *Surat Jalan Digital* (Digital Delivery Pass) containing
 * the delivery QR security code, cooperative sender info, SPPG kitchen destination,
 * itemized produce table, and one-tap Print & Copy/Share actions.
 */
export function DeliveryPassCard({ pass }: DeliveryPassCardProps) {
  const [copied, setCopied] = useState(false);
  const badge = STATUS_BADGE[pass.status];

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleCopyOrShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pass.qrToken);
      }
    } catch {
      // Ignore clipboard permission errors in restricted browsers
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <article
      aria-label={`Surat Jalan Digital ${pass.qrToken}`}
      className="rounded-2xl border-2 border-emerald-700/30 bg-white p-6 shadow-sm print:border-stone-400 print:shadow-none sm:p-8"
    >
      {/* Header Banner */}
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Surat Jalan Digital MBG
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                badge.className,
              )}
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              {badge.label}
            </span>
          </div>
          <h3 className="text-xl font-bold text-stone-900">
            Dokumen Pengiriman Pangan Desa #{pass.id}
          </h3>
          <p className="flex items-center gap-1.5 text-xs text-stone-600">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            <span>Jadwal Pengiriman: {pass.scheduledDate}</span>
          </p>
        </div>

        {/* Print & Copy/Share Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleCopyOrShare}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-800 transition-colors hover:bg-stone-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Token QR Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Salin Token QR</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Cetak Surat Jalan</span>
          </button>
        </div>
      </div>

      {/* Sender, Receiver & QR Pass Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Pengirim (Koperasi Desa)
              </div>
              <p className="mt-1.5 text-base font-bold text-stone-900">
                {pass.cooperativeName}
              </p>
              <p className="mt-0.5 text-xs text-stone-600">{pass.cooperativeLocation}</p>
              {pass.cooperativeContact ? (
                <p className="mt-1 text-xs font-medium text-stone-700">
                  Kontak: {pass.cooperativeContact}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                <ChefHat className="h-4 w-4" aria-hidden="true" />
                Penerima (Dapur SPPG)
              </div>
              <p className="mt-1.5 text-base font-bold text-stone-900">
                {pass.kitchenName}
              </p>
              <p className="mt-0.5 text-xs text-stone-600">{pass.kitchenAddress}</p>
              {pass.receiverName ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Diterima oleh: {pass.receiverName}
                </p>
              ) : null}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-100/80 text-xs font-semibold uppercase text-stone-600">
                  <th className="px-3.5 py-2.5">Komoditas &amp; Petani</th>
                  <th className="px-3.5 py-2.5">Kuantitas</th>
                  <th className="px-3.5 py-2.5">Harga Satuan</th>
                  <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pass.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3.5 py-3">
                      <p className="font-bold text-stone-900">{item.commodityName}</p>
                      <p className="text-xs text-stone-500">Petani: {item.farmerName}</p>
                    </td>
                    <td className="px-3.5 py-3 font-semibold text-stone-800">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-3.5 py-3 text-stone-700">
                      {formatRupiah(item.unitPrice)}/{item.unit}
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-stone-900">
                      {formatRupiah(item.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200 bg-emerald-50/70 font-bold text-emerald-950">
                  <td colSpan={3} className="px-3.5 py-3 text-right">
                    Total Nilai Pengiriman Pangan Desa
                  </td>
                  <td className="px-3.5 py-3 text-right text-base">
                    {formatRupiah(pass.totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* QR Code Security Pass Box */}
        <div className="flex flex-col items-center justify-between rounded-2xl border-2 border-dashed border-emerald-600/40 bg-emerald-50/40 p-5 text-center">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-900">
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              Pindai Saat Serah Terima SPPG
            </span>
            <p className="text-xs text-stone-600">
              Tunjukkan QR ini kepada petugas penerima di Dapur SPPG untuk verifikasi dua arah.
            </p>
          </div>

          <div className="my-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pass.qrCodeDataUrl}
              alt={`Kode QR Surat Jalan ${pass.qrToken}`}
              width={200}
              height={200}
              className="h-44 w-44 object-contain"
            />
          </div>

          <div className="w-full rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Token Keamanan Manual
            </p>
            <p className="mt-1 break-all font-mono text-xs font-bold text-emerald-900 select-all">
              {pass.qrToken}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
