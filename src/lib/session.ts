/**
 * Lightweight role-based session and demo persona definitions for KawalKopdesMBG.
 *
 * Designed for frictionless demo switching between Village Cooperative Admins
 * (Koperasi Desa), Central Kitchen Operators (SPPG), and Public Observers.
 */

/** Supported user roles across the KawalKopdesMBG platform. */
export const USER_ROLES = ['KOPERASI_ADMIN', 'SPPG_STAFF', 'PUBLIC_OBSERVER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Default role when a visitor first opens the platform without an active session. */
export const DEFAULT_ROLE: UserRole = 'PUBLIC_OBSERVER';

/** LocalStorage key used to persist the active demo role across page reloads. */
export const SESSION_STORAGE_KEY = 'kawalkopdes_active_role';

/** Actions guarded by role-based access checks in UI and Server Actions. */
export const ROLE_ACTIONS = [
  'RECORD_PROCUREMENT',
  'CREATE_DISPATCH',
  'VERIFY_DELIVERY',
  'VIEW_PUBLIC_DASHBOARD',
] as const;
export type RoleAction = (typeof ROLE_ACTIONS)[number];

/** Pre-configured demo persona representing a realistic Indonesian stakeholder. */
export interface DemoPersona {
  readonly id: string;
  readonly role: UserRole;
  readonly name: string;
  readonly roleLabel: string;
  readonly organization: string;
  readonly location: string;
  readonly description: string;
  readonly cooperativeId?: number;
  readonly kitchenId?: number;
}

/** Navigation item rendered in the responsive header for a specific role. */
export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly badge?: string;
}

/** Pre-populated demo personas aligned with the seeded Subang cooperative and SPPG data. */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: 'persona-koperasi-subang',
    role: 'KOPERASI_ADMIN',
    name: 'Pak Tatang Ruhiyat',
    roleLabel: 'Pengurus Koperasi',
    organization: 'Koperasi Desa Merah Putih Cibogo',
    location: 'Kabupaten Subang, Jawa Barat',
    description:
      'Catat serapan hasil tani lokal, cek harga acuan wajar, dan terbitkan Surat Jalan Digital ber-QR.',
    cooperativeId: 1,
  },
  {
    id: 'persona-sppg-subang',
    role: 'SPPG_STAFF',
    name: 'Ibu Siti Aminah',
    roleLabel: 'Petugas Dapur SPPG',
    organization: 'SPPG Dapur Gizi Subang Kota',
    location: 'Kabupaten Subang, Jawa Barat',
    description:
      'Pindai QR Surat Jalan, periksa kualitas & kuantitas bahan pangan, dan unggah bukti foto penerimaan.',
    kitchenId: 1,
  },
  {
    id: 'persona-public-observer',
    role: 'PUBLIC_OBSERVER',
    name: 'Warga & Orang Tua Siswa',
    roleLabel: 'Pemantau Publik',
    organization: 'Masyarakat & Komite Sekolah MBG',
    location: 'Seluruh Indonesia',
    description:
      'Pantau transparansi pasokan pangan desa, serapan hasil petani lokal, dan riwayat pengiriman terverifikasi.',
  },
] as const;

const ROLE_PERMISSIONS: Record<UserRole, readonly RoleAction[]> = {
  KOPERASI_ADMIN: ['RECORD_PROCUREMENT', 'CREATE_DISPATCH', 'VIEW_PUBLIC_DASHBOARD'],
  SPPG_STAFF: ['VERIFY_DELIVERY', 'VIEW_PUBLIC_DASHBOARD'],
  PUBLIC_OBSERVER: ['VIEW_PUBLIC_DASHBOARD'],
};

const ROLE_NAVIGATION: Record<UserRole, readonly NavItem[]> = {
  PUBLIC_OBSERVER: [
    {
      href: '/',
      label: 'Dashboard Transparansi',
      description: 'Statistik publik & riwayat pengiriman MBG',
    },
  ],
  KOPERASI_ADMIN: [
    {
      href: '/',
      label: 'Dashboard Transparansi',
      description: 'Statistik publik & riwayat pengiriman MBG',
    },
    {
      href: '/koperasi',
      label: 'Portal Koperasi & Dispatch',
      description: 'Pengadaan petani & cetak Surat Jalan QR',
      badge: 'Koperasi',
    },
  ],
  SPPG_STAFF: [
    {
      href: '/',
      label: 'Dashboard Transparansi',
      description: 'Statistik publik & riwayat pengiriman MBG',
    },
    {
      href: '/sppg',
      label: 'Verifikasi Terima SPPG',
      description: 'Pindai QR & konfirmasi bukti foto',
      badge: 'SPPG',
    },
  ],
};

/** Checks whether an arbitrary value is a valid KawalKopdesMBG `UserRole`. */
export function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** Parses an arbitrary value into a `UserRole`, falling back to `fallback` when invalid. */
export function parseRole(value: unknown, fallback: UserRole = DEFAULT_ROLE): UserRole {
  return isValidRole(value) ? value : fallback;
}

/** Looks up the pre-configured demo persona for a given `UserRole`. */
export function getPersonaByRole(role: UserRole): DemoPersona {
  const match = DEMO_PERSONAS.find((persona) => persona.role === role);
  return match ?? DEMO_PERSONAS[2];
}

/** Checks whether the specified role is permitted to perform `action`. */
export function canPerformAction(role: UserRole, action: RoleAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

/** Returns the list of navigation links visible for the given `UserRole`. */
export function getNavigationItemsForRole(role: UserRole): readonly NavItem[] {
  return ROLE_NAVIGATION[role];
}

/** Reads and validates the persisted role from a Web Storage-compatible object. */
export function loadStoredRole(
  storage?: Pick<Storage, 'getItem'> | null,
  fallback: UserRole = DEFAULT_ROLE,
): UserRole {
  if (!storage) {
    return fallback;
  }
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    return parseRole(raw, fallback);
  } catch {
    return fallback;
  }
}

/** Persists the selected role to a Web Storage-compatible object, ignoring storage errors. */
export function saveStoredRole(
  role: UserRole,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SESSION_STORAGE_KEY, role);
  } catch {
    // Ignore quota or privacy-mode storage errors on mobile browsers.
  }
}
