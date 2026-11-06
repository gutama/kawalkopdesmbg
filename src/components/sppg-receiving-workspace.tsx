'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  QrCode,
  Search,
  Truck,
  UserCheck,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import type { DeliveryPassView } from '@/lib/dispatch';
import { formatRupiah } from '@/lib/procurement';
import {
  evaluateItemInspection,
  type DeliveryLookupResult,
  type ItemInspectionInput,
} from '@/lib/receiving';
import { cn } from '@/lib/utils';

/** Props for the SppgReceivingWorkspace component. */
export interface SppgReceivingWorkspaceProps {
  readonly initialDeliveries: readonly DeliveryPassView[];
  readonly onLookupToken?: (rawInput: string) => Promise<DeliveryLookupResult>;
}

/**
 * Mobile-first SPPG Central Kitchen receiving screen featuring an in-browser
 * camera QR code scanner, manual token fallback, quick incoming dispatch selector,
 * and interactive item quantity/quality inspection checklist.
 */
export function SppgReceivingWorkspace({
  initialDeliveries,
  onLookupToken,
}: SppgReceivingWorkspaceProps) {
  const { role, setRole, canPerform } = useSession();

  const defaultActive =
    initialDeliveries.find((d) => d.status === 'DISPATCHED') ??
    initialDeliveries[0] ??
    null;

  const [activeDelivery, setActiveDelivery] = useState<DeliveryPassView | null>(
    defaultActive,
  );
  const [tokenInput, setTokenInput] = useState<string>(defaultActive?.qrToken ?? '');
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const scannerRegionId = 'sppg-qr-reader-region';
  const scannerRef = useRef<{ stop?: () => Promise<void> } | null>(null);

  const [inspectionMap, setInspectionMap] = useState<
    Record<number, { readonly checked: boolean; readonly receivedQuantity: string }>
  >(() => {
    const initial: Record<
      number,
      { readonly checked: boolean; readonly receivedQuantity: string }
    > = {};
    if (defaultActive) {
      for (const item of defaultActive.items) {
        initial[item.id] = {
          checked: defaultActive.status === 'VERIFIED',
          receivedQuantity: String(item.quantity),
        };
      }
    }
    return initial;
  });

  const resetChecklistForDelivery = (delivery: DeliveryPassView) => {
    const nextMap: Record<
      number,
      { readonly checked: boolean; readonly receivedQuantity: string }
    > = {};
    for (const item of delivery.items) {
      nextMap[item.id] = {
        checked: delivery.status === 'VERIFIED',
        receivedQuantity: String(item.quantity),
      };
    }
    setInspectionMap(nextMap);
  };

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }

    let cancelled = false;
    async function startScanner() {
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          setCameraNotice(
            'Kamera perangkat tidak terdeteksi di peramban ini. Gunakan kolom input token manual di bawah.',
          );
          return;
        }

        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(scannerRegionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            setTokenInput(decodedText);
            setCameraOpen(false);
            if (onLookupToken) {
              const res = await onLookupToken(decodedText);
              if (res.success) {
                setActiveDelivery(res.delivery);
                resetChecklistForDelivery(res.delivery);
              }
            }
          },
          () => {
            // Ignore frame scan misses
          },
        );
      } catch {
        if (!cancelled) {
          setCameraNotice(
            'Izin kamera belum tersedia. Gunakan kolom input token manual di bawah untuk memuat Surat Jalan.',
          );
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current?.stop) {
        void scannerRef.current.stop().catch(() => {});
      }
    };
  }, [cameraOpen, onLookupToken]);

  const handleManualLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError(null);

    if (!onLookupToken) {
      return;
    }

    setIsSearching(true);
    try {
      const response = await onLookupToken(tokenInput);
      if (!response.success) {
        setLookupError(response.error);
        return;
      }
      setActiveDelivery(response.delivery);
      setTokenInput(response.delivery.qrToken);
      resetChecklistForDelivery(response.delivery);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectDelivery = (delivery: DeliveryPassView) => {
    setLookupError(null);
    setActiveDelivery(delivery);
    setTokenInput(delivery.qrToken);
    resetChecklistForDelivery(delivery);
  };

  const handleToggleItemCheck = (itemId: number, checked: boolean) => {
    setInspectionMap((prev) => ({
      ...prev,
      [itemId]: {
        checked,
        receivedQuantity: prev[itemId]?.receivedQuantity ?? '0',
      },
    }));
  };

  const handleQuantityChange = (itemId: number, receivedQuantity: string) => {
    setInspectionMap((prev) => ({
      ...prev,
      [itemId]: {
        checked: prev[itemId]?.checked ?? false,
        receivedQuantity,
      },
    }));
  };

  const checklistItems: readonly ItemInspectionInput[] = useMemo(() => {
    if (!activeDelivery) return [];
    return activeDelivery.items.map((item) => {
      const state = inspectionMap[item.id];
      return {
        itemId: item.id,
        commodityName: item.commodityName,
        unit: item.unit,
        dispatchedQuantity: item.quantity,
        receivedQuantity: Number(state?.receivedQuantity ?? item.quantity),
        checked: Boolean(state?.checked),
      };
    });
  }, [activeDelivery, inspectionMap]);

  const checkedCount = checklistItems.filter((item) => item.checked).length;
  const canVerify = canPerform('VERIFY_DELIVERY');

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-700/70 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30">
            <ChefHat className="h-4 w-4" aria-hidden="true" />
            Portal Penerimaan &amp; Verifikasi Dua Arah Dapur SPPG
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Pindai QR Surat Jalan &amp; Periksa Pasokan Pangan Desa
          </h1>
          <p className="max-w-2xl text-sm text-emerald-100">
            Pastikan setiap komoditas yang tiba di Dapur SPPG dipindai kode QR-nya, diperiksa
            timbangan serta kesegarannya, lalu dikonfirmasi secara transparan.
          </p>
        </div>
      </section>

      {/* Role Guard */}
      {!canVerify ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-stone-900 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-900">
                <UserCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-bold">
                  Aktifkan Peran Petugas Dapur SPPG untuk Verifikasi Penerimaan
                </h2>
              </div>
              <p className="text-sm text-stone-700">
                Saat ini Anda menggunakan peran <span className="font-semibold">{role}</span>.
                Beralihlah ke peran Petugas Dapur SPPG untuk memindai QR Surat Jalan dan
                memeriksa barang masuk.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRole('SPPG_STAFF')}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
            >
              Beralih ke Peran Petugas Dapur SPPG
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* QR Camera Scanner & Manual Token Fallback Section */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <QrCode className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">
                      Pemindai QR &amp; Pencarian Surat Jalan
                    </h2>
                    <p className="text-xs text-stone-600">
                      Gunakan kamera ponsel atau masukkan token keamanan Surat Jalan secara
                      manual.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCameraNotice(null);
                    setCameraOpen((prev) => !prev);
                  }}
                  className={cn(
                    'inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors',
                    cameraOpen
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800',
                  )}
                >
                  {cameraOpen ? (
                    <>
                      <CameraOff className="h-4 w-4" aria-hidden="true" />
                      <span>Tutup Kamera QR</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span>Buka Kamera Pemindai QR</span>
                    </>
                  )}
                </button>
              </div>

              {cameraOpen ? (
                <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-500/50 bg-stone-950 p-4 text-center text-white">
                  <div id={scannerRegionId} className="mx-auto max-w-xs overflow-hidden rounded-xl" />
                  {cameraNotice ? (
                    <p className="mt-2 text-xs text-amber-300">{cameraNotice}</p>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-200">
                      Arahkan kamera ke kode QR pada Surat Jalan Digital pengemudi koperasi...
                    </p>
                  )}
                </div>
              ) : null}

              <form onSubmit={handleManualLookup} className="mt-5 space-y-3">
                <label
                  htmlFor="sppg-token-input"
                  className="block text-sm font-semibold text-stone-800"
                >
                  Kode Token QR Surat Jalan (Input Manual / Pemindai)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="sppg-token-input"
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Contoh: mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e"
                    className="block min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 font-mono text-xs text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-xs transition-colors hover:bg-amber-400 disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <span>{isSearching ? 'Mencari...' : 'Cari Surat Jalan'}</span>
                  </button>
                </div>

                {lookupError ? (
                  <p role="alert" className="text-xs font-semibold text-red-700">
                    {lookupError}
                  </p>
                ) : null}
              </form>
            </div>

            {/* Quick Queue of Incoming Deliveries */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <h3 className="text-base font-bold text-stone-900">
                  Antrean Pengiriman Masuk
                </h3>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                Ketuk salah satu pengiriman untuk langsung memuat pemeriksaan:
              </p>

              <div className="mt-4 space-y-2.5">
                {initialDeliveries.map((delivery) => {
                  const isSelected = activeDelivery?.id === delivery.id;
                  return (
                    <button
                      key={delivery.id}
                      type="button"
                      onClick={() => handleSelectDelivery(delivery)}
                      className={cn(
                        'flex min-h-12 w-full flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all',
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600/30'
                          : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100',
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900">
                          #{delivery.id} • {delivery.scheduledDate}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                            delivery.status === 'DISPATCHED'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900',
                          )}
                        >
                          {delivery.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-stone-700">
                        {delivery.cooperativeName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                        {delivery.qrToken}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Item Inspection Checklist & Quantity Verification */}
          {activeDelivery ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">
                      Checklist Pemeriksaan Fisik &amp; Kuantitas Komoditas
                    </h2>
                    <p className="text-xs text-stone-600">
                      Pengirim: <span className="font-semibold">{activeDelivery.cooperativeName}</span>{' '}
                      • Tujuan: <span className="font-semibold">{activeDelivery.kitchenName}</span>
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 ring-1 ring-inset ring-emerald-600/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>
                    {checkedCount} dari {checklistItems.length} komoditas telah diperiksa
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {activeDelivery.items.map((item) => {
                  const state = inspectionMap[item.id] ?? {
                    checked: false,
                    receivedQuantity: String(item.quantity),
                  };
                  const numericReceived = Number(state.receivedQuantity);
                  const inspectionEval = evaluateItemInspection(
                    item.quantity,
                    Number.isFinite(numericReceived) ? numericReceived : 0,
                  );

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'grid grid-cols-1 gap-4 rounded-2xl border p-4 transition-colors sm:grid-cols-12 sm:items-center',
                        state.checked
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-stone-200 bg-stone-50/50',
                      )}
                    >
                      <div className="flex items-start gap-3 sm:col-span-5">
                        <input
                          id={`inspect-check-${item.id}`}
                          type="checkbox"
                          checked={state.checked}
                          onChange={(e) =>
                            handleToggleItemCheck(item.id, e.target.checked)
                          }
                          aria-label={`Periksa ${item.commodityName}`}
                          className="mt-1 h-5 w-5 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <label
                          htmlFor={`inspect-check-${item.id}`}
                          className="cursor-pointer space-y-0.5"
                        >
                          <p className="text-sm font-bold text-stone-900">
                            {item.commodityName}
                          </p>
                          <p className="text-xs text-stone-600">
                            Petani: {item.farmerName} • Nilai:{' '}
                            {formatRupiah(item.totalValue)}
                          </p>
                          <p className="text-xs font-semibold text-emerald-800">
                            Muatan Surat Jalan: {item.quantity} {item.unit}
                          </p>
                        </label>
                      </div>

                      <div className="sm:col-span-4">
                        <label
                          htmlFor={`inspect-qty-${item.id}`}
                          className="block text-xs font-semibold text-stone-700"
                        >
                          Jumlah Diterima ({item.unit})
                        </label>
                        <input
                          id={`inspect-qty-${item.id}`}
                          type="number"
                          min="0"
                          step="any"
                          value={state.receivedQuantity}
                          onChange={(e) =>
                            handleQuantityChange(item.id, e.target.value)
                          }
                          className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold text-stone-900"
                        />
                      </div>

                      <div className="flex items-center justify-end sm:col-span-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                            inspectionEval.hasDiscrepancy
                              ? 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-500/30'
                              : 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-500/30',
                          )}
                        >
                          {inspectionEval.hasDiscrepancy ? (
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {inspectionEval.status === 'MATCH'
                              ? 'Sesuai Surat Jalan'
                              : `${
                                  inspectionEval.status === 'SHORTAGE'
                                    ? 'Selisih Kurang'
                                    : 'Selisih Lebih'
                                } (${
                                  inspectionEval.deviation > 0
                                    ? `+${inspectionEval.deviation}`
                                    : inspectionEval.deviation
                                } ${item.unit})`}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
