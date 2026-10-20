'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_ROLE,
  DEMO_PERSONAS,
  canPerformAction,
  getNavigationItemsForRole,
  getPersonaByRole,
  loadStoredRole,
  saveStoredRole,
  type DemoPersona,
  type NavItem,
  type RoleAction,
  type UserRole,
} from '@/lib/session';

/** Shape of the active demo session exposed by `SessionProvider`. */
export interface SessionContextValue {
  readonly role: UserRole;
  readonly persona: DemoPersona;
  readonly personas: readonly DemoPersona[];
  readonly navItems: readonly NavItem[];
  readonly setRole: (nextRole: UserRole) => void;
  readonly canPerform: (action: RoleAction) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Props accepted by `SessionProvider`. */
export interface SessionProviderProps {
  readonly children: React.ReactNode;
  readonly initialRole?: UserRole;
}

/**
 * Provides role-based persona state across the application and synchronizes
 * changes with `window.localStorage` for seamless field testing.
 */
export function SessionProvider({
  children,
  initialRole = DEFAULT_ROLE,
}: SessionProviderProps) {
  const [role, setRoleState] = useState<UserRole>(() =>
    typeof window !== 'undefined'
      ? loadStoredRole(window.localStorage, initialRole)
      : initialRole,
  );

  const setRole = useCallback((nextRole: UserRole) => {
    setRoleState(nextRole);
    if (typeof window !== 'undefined') {
      saveStoredRole(nextRole, window.localStorage);
    }
  }, []);

  const canPerform = useCallback(
    (action: RoleAction) => canPerformAction(role, action),
    [role],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      role,
      persona: getPersonaByRole(role),
      personas: DEMO_PERSONAS,
      navItems: getNavigationItemsForRole(role),
      setRole,
      canPerform,
    }),
    [role, setRole, canPerform],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Returns the active role, demo persona, navigation items, and role switcher callbacks. */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
