import React from 'react';
import { getDatabase } from '@/db/client';
import {
  ensureInitializedDatabase,
  getCooperativeProcurementWorkspace,
} from '@/lib/procurement-service';
import { ProcurementWorkspace } from '@/components/procurement-workspace';
import { recordFarmerProcurementAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Cooperative Portal page (`/koperasi`) for recording local farmer produce
 * procurement and comparing cooperative purchase prices with regional benchmarks.
 */
export default function KoperasiPage() {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const workspace = getCooperativeProcurementWorkspace(db, 1);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <ProcurementWorkspace
        initialWorkspace={workspace}
        onSubmitProcurement={recordFarmerProcurementAction}
      />
    </main>
  );
}
