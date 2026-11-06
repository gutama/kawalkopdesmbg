import React from 'react';
import { getDatabase } from '@/db/client';
import { getCooperativeDispatches } from '@/lib/dispatch';
import {
  ensureInitializedDatabase,
  getCooperativeProcurementWorkspace,
} from '@/lib/procurement-service';
import { DispatchOrderBuilder } from '@/components/dispatch-order-builder';
import { ProcurementWorkspace } from '@/components/procurement-workspace';
import {
  createDeliveryDispatchAction,
  recordFarmerProcurementAction,
} from './actions';

export const dynamic = 'force-dynamic';

/**
 * Cooperative Portal page (`/koperasi`) for recording local farmer produce
 * procurement, checking fair prices, creating delivery dispatch orders, and
 * printing/sharing *Surat Jalan Digital* QR passes.
 */
export default async function KoperasiPage() {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const workspace = getCooperativeProcurementWorkspace(db, 1);
  const dispatches = await getCooperativeDispatches(db, 1);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <ProcurementWorkspace
        initialWorkspace={workspace}
        onSubmitProcurement={recordFarmerProcurementAction}
      />

      <DispatchOrderBuilder
        cooperative={workspace.cooperative}
        kitchens={workspace.kitchens}
        farmers={workspace.farmers}
        commodities={workspace.commodities}
        initialDispatches={dispatches}
        onCreateDispatch={createDeliveryDispatchAction}
      />
    </main>
  );
}
