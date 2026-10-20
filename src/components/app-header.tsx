'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChefHat,
  Eye,
  Menu,
  ShieldCheck,
  Sprout,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-provider';
import type { UserRole } from '@/lib/session';

const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  KOPERASI_ADMIN: Building2,
  SPPG_STAFF: ChefHat,
  PUBLIC_OBSERVER: Eye,
};

/**
 * Responsive application header containing the KawalKopdesMBG brand identity,
 * role-customized navigation links, and an interactive demo persona switcher.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { role, persona, personas, navItems, setRole } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {/* Top Demo Persona Switcher Bar */}
      <div className="bg-emerald-950 text-stone-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/40">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mode Simulasi Peran
            </span>
            <span className="font-medium text-white">{persona.name}</span>
            <span className="hidden text-emerald-200 md:inline">•</span>
            <span className="hidden text-emerald-200 md:inline">
              {persona.organization}
            </span>
          </div>

          <div
            role="group"
            aria-label="Pilih Peran Pengguna"
            className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center"
          >
            {personas.map((item) => {
              const Icon = ROLE_ICON[item.role];
              const isActive = item.role === role;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.role)}
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:min-h-10 sm:text-xs',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                      : 'bg-emerald-900/70 text-emerald-100 hover:bg-emerald-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.roleLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Brand & Role-Based Navigation Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex min-h-12 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-transform group-hover:scale-105">
              <Sprout className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-stone-900">
                  KawalKopdesMBG
                </span>
                <span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 sm:inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Transparan
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Gotong Royong Pangan Desa untuk Makan Bergizi Gratis
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex md:items-center md:gap-2"
        >
          {navItems.map((item) => {
            const isCurrent = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                  isCurrent
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/30'
                    : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Menu Toggle Button */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Active Persona Banner for Mobile / Tablet Clarity */}
      <div className="border-t border-stone-100 bg-stone-50 px-4 py-2 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-800">{persona.roleLabel}:</span>
            <span className="font-medium text-stone-800">{persona.organization}</span>
            <span className="hidden text-stone-400 sm:inline">({persona.location})</span>
          </div>
          <p className="text-stone-600">{persona.description}</p>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen ? (
        <nav
          aria-label="Navigasi Seluler"
          className="border-t border-stone-200 bg-white px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isCurrent = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 flex-col justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
                    isCurrent
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/30'
                      : 'text-stone-700 hover:bg-stone-100',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-normal text-stone-500">
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
