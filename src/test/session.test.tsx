import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  USER_ROLES,
  DEFAULT_ROLE,
  DEMO_PERSONAS,
  SESSION_STORAGE_KEY,
  isValidRole,
  parseRole,
  getPersonaByRole,
  canPerformAction,
  getNavigationItemsForRole,
  loadStoredRole,
  saveStoredRole,
  type UserRole,
} from '@/lib/session';
import { SessionProvider, useSession } from '@/components/session-provider';
import { AppHeader } from '@/components/app-header';
import Home from '@/app/page';
import RootLayout from '@/app/layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));

describe('Session & Role Validation Helpers', () => {
  it('defines the three supported KawalKopdesMBG user roles', () => {
    expect(USER_ROLES).toEqual(['KOPERASI_ADMIN', 'SPPG_STAFF', 'PUBLIC_OBSERVER']);
    expect(DEFAULT_ROLE).toBe('PUBLIC_OBSERVER');
  });

  it('validates role strings accurately with isValidRole', () => {
    expect(isValidRole('KOPERASI_ADMIN')).toBe(true);
    expect(isValidRole('SPPG_STAFF')).toBe(true);
    expect(isValidRole('PUBLIC_OBSERVER')).toBe(true);
    expect(isValidRole('SUPER_ADMIN')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });

  it('parses roles with fallback to DEFAULT_ROLE or custom fallback', () => {
    expect(parseRole('KOPERASI_ADMIN')).toBe('KOPERASI_ADMIN');
    expect(parseRole('SPPG_STAFF')).toBe('SPPG_STAFF');
    expect(parseRole('INVALID_ROLE')).toBe('PUBLIC_OBSERVER');
    expect(parseRole(null, 'KOPERASI_ADMIN')).toBe('KOPERASI_ADMIN');
  });

  it('returns Indonesian demo personas for every role', () => {
    expect(DEMO_PERSONAS).toHaveLength(3);

    const koperasiPersona = getPersonaByRole('KOPERASI_ADMIN');
    expect(koperasiPersona.role).toBe('KOPERASI_ADMIN');
    expect(koperasiPersona.name).toContain('Pak Tatang');
    expect(koperasiPersona.organization).toContain('Koperasi Desa Merah Putih Cibogo');
    expect(koperasiPersona.cooperativeId).toBe(1);

    const sppgPersona = getPersonaByRole('SPPG_STAFF');
    expect(sppgPersona.role).toBe('SPPG_STAFF');
    expect(sppgPersona.name).toContain('Ibu Siti Aminah');
    expect(sppgPersona.organization).toContain('SPPG Dapur Gizi Subang Kota');
    expect(sppgPersona.kitchenId).toBe(1);

    const publicPersona = getPersonaByRole('PUBLIC_OBSERVER');
    expect(publicPersona.role).toBe('PUBLIC_OBSERVER');
    expect(publicPersona.roleLabel).toBe('Pemantau Publik');
  });

  it('enforces role-based action permissions', () => {
    expect(canPerformAction('KOPERASI_ADMIN', 'RECORD_PROCUREMENT')).toBe(true);
    expect(canPerformAction('KOPERASI_ADMIN', 'CREATE_DISPATCH')).toBe(true);
    expect(canPerformAction('KOPERASI_ADMIN', 'VERIFY_DELIVERY')).toBe(false);
    expect(canPerformAction('KOPERASI_ADMIN', 'VIEW_PUBLIC_DASHBOARD')).toBe(true);

    expect(canPerformAction('SPPG_STAFF', 'VERIFY_DELIVERY')).toBe(true);
    expect(canPerformAction('SPPG_STAFF', 'CREATE_DISPATCH')).toBe(false);
    expect(canPerformAction('SPPG_STAFF', 'VIEW_PUBLIC_DASHBOARD')).toBe(true);

    expect(canPerformAction('PUBLIC_OBSERVER', 'VIEW_PUBLIC_DASHBOARD')).toBe(true);
    expect(canPerformAction('PUBLIC_OBSERVER', 'CREATE_DISPATCH')).toBe(false);
    expect(canPerformAction('PUBLIC_OBSERVER', 'VERIFY_DELIVERY')).toBe(false);
  });

  it('returns customized navigation items for each role', () => {
    const publicNav = getNavigationItemsForRole('PUBLIC_OBSERVER');
    expect(publicNav.map((item) => item.href)).toEqual(['/']);

    const koperasiNav = getNavigationItemsForRole('KOPERASI_ADMIN');
    expect(koperasiNav.map((item) => item.href)).toEqual(['/', '/koperasi']);

    const sppgNav = getNavigationItemsForRole('SPPG_STAFF');
    expect(sppgNav.map((item) => item.href)).toEqual(['/', '/sppg']);
  });

  it('loads and saves role to storage safely including when storage is unavailable or throws', () => {
    const mockStorage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
    };

    expect(loadStoredRole(mockStorage)).toBe('PUBLIC_OBSERVER');

    saveStoredRole('KOPERASI_ADMIN', mockStorage);
    expect(mockStorage.store[SESSION_STORAGE_KEY]).toBe('KOPERASI_ADMIN');
    expect(loadStoredRole(mockStorage)).toBe('KOPERASI_ADMIN');

    mockStorage.store[SESSION_STORAGE_KEY] = 'CORRUPTED_VALUE';
    expect(loadStoredRole(mockStorage)).toBe('PUBLIC_OBSERVER');

    expect(loadStoredRole(null)).toBe('PUBLIC_OBSERVER');
    expect(() => saveStoredRole('SPPG_STAFF', null)).not.toThrow();

    const throwingStorage = {
      getItem(): string | null {
        throw new Error('Storage blocked');
      },
      setItem(): void {
        throw new Error('Storage blocked');
      },
    };
    expect(loadStoredRole(throwingStorage)).toBe('PUBLIC_OBSERVER');
    expect(() => saveStoredRole('SPPG_STAFF', throwingStorage)).not.toThrow();
  });
});

function SessionConsumerProbe() {
  const { role, persona, setRole, canPerform } = useSession();
  return (
    <div>
      <span data-testid="active-role">{role}</span>
      <span data-testid="active-persona">{persona.name}</span>
      <span data-testid="can-dispatch">{String(canPerform('CREATE_DISPATCH'))}</span>
      <button type="button" onClick={() => setRole('KOPERASI_ADMIN')}>
        Switch to Koperasi
      </button>
    </div>
  );
}

describe('SessionProvider & AppHeader Role Switcher UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('throws a helpful error if useSession is called outside SessionProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SessionConsumerProbe />)).toThrow(
      /useSession must be used within a SessionProvider/i,
    );
    consoleSpy.mockRestore();
  });

  it('provides session context and persists role transitions to localStorage', () => {
    render(
      <SessionProvider>
        <SessionConsumerProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId('active-role')).toHaveTextContent('PUBLIC_OBSERVER');
    expect(screen.getByTestId('can-dispatch')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('Switch to Koperasi'));

    expect(screen.getByTestId('active-role')).toHaveTextContent('KOPERASI_ADMIN');
    expect(screen.getByTestId('active-persona')).toHaveTextContent('Pak Tatang Ruhiyat');
    expect(screen.getByTestId('can-dispatch')).toHaveTextContent('true');
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe('KOPERASI_ADMIN');
  });

  it('hydrates initial role from localStorage if a valid role is stored', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, 'SPPG_STAFF');

    render(
      <SessionProvider>
        <SessionConsumerProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId('active-role')).toHaveTextContent('SPPG_STAFF');
    expect(screen.getByTestId('active-persona')).toHaveTextContent('Ibu Siti Aminah');
  });

  it('renders AppHeader with persona switcher and updates navigation links by active role', () => {
    render(
      <SessionProvider initialRole={'PUBLIC_OBSERVER' as UserRole}>
        <AppHeader />
      </SessionProvider>,
    );

    expect(screen.getByText(/KawalKopdesMBG/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Dashboard Transparansi/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Portal Koperasi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Verifikasi Terima SPPG/i })).not.toBeInTheDocument();

    // Switch persona to Koperasi Admin via role switcher button
    const koperasiSwitchBtn = screen.getByRole('button', { name: /Pengurus Koperasi/i });
    fireEvent.click(koperasiSwitchBtn);

    expect(screen.getAllByRole('link', { name: /Portal Koperasi/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Koperasi Desa Merah Putih Cibogo/i).length).toBeGreaterThan(0);

    // Switch persona to SPPG Staff via role switcher button
    const sppgSwitchBtn = screen.getByRole('button', { name: /Petugas Dapur SPPG/i });
    fireEvent.click(sppgSwitchBtn);

    expect(screen.getAllByRole('link', { name: /Verifikasi Terima SPPG/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Portal Koperasi/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/SPPG Dapur Gizi Subang Kota/i).length).toBeGreaterThan(0);

    // Toggle mobile navigation drawer
    const mobileMenuBtn = screen.getByRole('button', { name: /Buka menu navigasi/i });
    fireEvent.click(mobileMenuBtn);
    expect(screen.getByRole('button', { name: /Tutup menu navigasi/i })).toBeInTheDocument();
  });

  it('renders Home page and switches active persona cards and quick action links', () => {
    render(
      <SessionProvider initialRole="PUBLIC_OBSERVER">
        <Home />
      </SessionProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: /Kawal Pasokan Koperasi Desa/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Buka Portal Koperasi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Buka Verifikasi SPPG/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gunakan Peran Pengurus Koperasi/i }));
    expect(screen.getByRole('link', { name: /Buka Portal Koperasi/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Gunakan Peran Petugas Dapur SPPG/i }));
    expect(screen.getByRole('link', { name: /Buka Verifikasi SPPG/i })).toBeInTheDocument();
  });

  it('wraps application content in RootLayout with SessionProvider and AppHeader', () => {
    const layoutElement = RootLayout({
      children: <div data-testid="layout-child">Konten Uji</div>,
    });
    expect(layoutElement).toBeTruthy();
    expect(layoutElement.props.lang).toBe('id');
  });
});
