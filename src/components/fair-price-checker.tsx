'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Scale } from 'lucide-react';
import {
  calculateLineTotal,
  evaluateFairPrice,
  formatRupiah,
  type FairPriceStatus,
} from '@/lib/procurement';
import { cn } from '@/lib/utils';

/** Props for the interactive FairPriceChecker component. */
export interface FairPriceCheckerProps {
  readonly commodityName: string;
  readonly unit: string;
  readonly benchmarkPrice: number;
  readonly unitPrice: number;
  readonly quantity: number;
}

const STATUS_STYLES: Record<
  FairPriceStatus,
  {
    readonly container: string;
    readonly badge: string;
    readonly icon: React.ComponentType<{ className?: string }>;
  }
> = {
  FAIR: {
    container: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icon: CheckCircle2,
  },
  BELOW_BENCHMARK: {
    container: 'border-red-200 bg-red-50/80 text-red-950',
    badge: 'bg-red-600 text-white',
    icon: AlertTriangle,
  },
  ABOVE_BENCHMARK: {
    container: 'border-amber-200 bg-amber-50/80 text-amber-950',
    badge: 'bg-amber-600 text-white',
    icon: Info,
  },
};

/**
 * Displays a live comparison between the cooperative's farmer purchase price
 * and the regional government benchmark price (`Harga Acuan Pemerintah Daerah`),
 * highlighting fairness status and computed line total.
 */
export function FairPriceChecker({
  commodityName,
  unit,
  benchmarkPrice,
  unitPrice,
  quantity,
}: FairPriceCheckerProps) {
  const validUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
  const validBenchmark =
    Number.isFinite(benchmarkPrice) && benchmarkPrice > 0 ? benchmarkPrice : 0;
  const lineTotal = calculateLineTotal(quantity, validUnitPrice);

  if (validUnitPrice === 0 || validBenchmark === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        Masukkan jumlah pasokan dan harga beli koperasi untuk memeriksa kesesuaian harga acuan
        daerah.
      </div>
    );
  }

  const evaluation = evaluateFairPrice(validUnitPrice, validBenchmark);
  const style = STATUS_STYLES[evaluation.status];
  const StatusIcon = style.icon;
  const formattedPercent =
    evaluation.percentageDiff > 0
      ? `+${evaluation.percentageDiff}%`
      : `${evaluation.percentageDiff}%`;

  return (
    <div
      role="region"
      aria-label={`Pemeriksaan Harga Wajar ${commodityName}`}
      className={cn('rounded-2xl border p-4 transition-colors sm:p-5', style.container)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold">
            Cek Keadilan Harga Petani: {commodityName}
          </span>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-xs',
            style.badge,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {evaluation.label} ({formattedPercent})
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed opacity-90">{evaluation.message}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/90 p-3 shadow-2xs ring-1 ring-black/5">
          <p className="text-xs font-medium text-stone-500">
            Harga Acuan Daerah / {unit}
          </p>
          <p className="mt-0.5 text-base font-bold text-stone-900">
            {formatRupiah(validBenchmark)}
          </p>
        </div>

        <div className="rounded-xl bg-white/90 p-3 shadow-2xs ring-1 ring-black/5">
          <p className="text-xs font-medium text-stone-500">
            Harga Beli Koperasi / {unit}
          </p>
          <p className="mt-0.5 text-base font-bold text-stone-900">
            {formatRupiah(validUnitPrice)}
          </p>
          <p className="text-[11px] font-medium text-stone-500">
            Selisih: {formatRupiah(evaluation.difference)} ({formattedPercent})
          </p>
        </div>

        <div className="rounded-xl bg-white/90 p-3 shadow-2xs ring-1 ring-black/5">
          <p className="text-xs font-medium text-stone-500">
            Total Diterima Petani ({quantity > 0 ? quantity : 0} {unit})
          </p>
          <p className="mt-0.5 text-base font-bold text-emerald-800">
            {formatRupiah(lineTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
