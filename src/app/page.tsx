'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  ChefHat,
  CheckCircle2,
  Eye,
  QrCode,
  Scale,
  Sprout,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';

/**
 * Role-aware home page displaying the active persona workspace banner,
 * quick navigation cards tailored to the selected role, and core MBG transparency pillars.
 */
export default function Home() {
  const { role, persona, personas, setRole, canPerform } = useSession();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero & Active Persona Banner */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-700/70 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30">
              <Sprout className="h-4 w-4" aria-hidden="true" />
              Ekosistem Gotong Royong Pangan Desa MBG
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Kawal Pasokan Koperasi Desa &amp; Dapur Gizi Secara Transparan
            </h1>
            <p className="text-sm leading-relaxed text-emerald-100 sm:text-base">
              Memastikan hasil panen petani lokal terserap dengan harga wajar oleh Koperasi Desa,
              dikirim tepat waktu dengan Surat Jalan QR Digital, dan diverifikasi langsung oleh
              Dapur SPPG dengan bukti foto nyata.
            </p>
          </div>

          {/* Active Session Summary Card */}
          <div className="w-full rounded-xl border border-emerald-700/80 bg-emerald-950/80 p-5 lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Sesi Peran Aktif Saat Ini
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">{persona.name}</h2>
            <p className="text-sm font-medium text-emerald-200">{persona.roleLabel}</p>
            <p className="mt-1 text-xs text-emerald-300">
              {persona.organization} • {persona.location}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-stone-200">
              {persona.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {canPerform('CREATE_DISPATCH') ? (
                <Link
                  href="/koperasi"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 shadow-sm transition-colors hover:bg-amber-400"
                >
                  <span>Buka Portal Koperasi</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}

              {canPerform('VERIFY_DELIVERY') ? (
                <Link
                  href="/sppg"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 shadow-sm transition-colors hover:bg-amber-400"
                >
                  <span>Buka Verifikasi SPPG</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Persona Cards */}
      <section aria-labelledby="persona-section-heading" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="persona-section-heading"
              className="text-lg font-bold text-stone-900 sm:text-xl"
            >
              Simulasi Peran Pemangku Kepentingan
            </h2>
            <p className="text-sm text-stone-600">
              Pilih peran di bawah ini atau melalui bilah atas untuk menguji alur kerja tanpa
              kendala SMS/OTP.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {personas.map((item) => {
            const isSelected = item.role === role;
            const RoleIcon =
              item.role === 'KOPERASI_ADMIN'
                ? Building2
                : item.role === 'SPPG_STAFF'
                  ? ChefHat
                  : Eye;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-600/20'
                    : 'border-stone-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                      <RoleIcon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      {item.roleLabel}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Aktif
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                    <p className="text-xs font-medium text-stone-600">
                      {item.organization}
                    </p>
                  </div>

                  <p className="text-xs leading-relaxed text-stone-600">
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRole(item.role)}
                  className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isSelected
                      ? 'bg-emerald-700 text-white'
                      : 'border border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  {isSelected ? `Peran Aktif: ${item.roleLabel}` : `Gunakan Peran ${item.roleLabel}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Transparency Pillars */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Scale className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Keadilan Harga Petani Desa</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            Membandingkan harga beli koperasi terhadap harga acuan pemerintah daerah agar petani
            lokal memperoleh pembayaran yang adil.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Surat Jalan Digital Ber-QR</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            Setiap pengiriman dilengkapi token QR unik yang siap dipindai oleh petugas dapur SPPG
            saat serah terima bahan pangan.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Bukti Terima Dua Arah (PoD)</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            Verifikasi kuantitas, foto komoditas terkompresi, dan catatan tanda terima yang tidak
            dapat diubah setelah terverifikasi.
          </p>
        </div>
      </section>
    </main>
  );
}
