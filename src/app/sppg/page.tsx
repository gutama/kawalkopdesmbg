import React from 'react';
import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import { listKitchenDeliveries } from '@/lib/receiving';
import { SppgReceivingWorkspace } from '@/components/sppg-receiving-workspace';
import { lookupDeliveryByQrTokenAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * SPPG Central Kitchen Receiving page (`/sppg`) for scanning delivery QR passes
 * and inspecting incoming local food commodities.
 */
export default async function SppgReceivingPage() {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const deliveries = await listKitchenDeliveries(db, 1);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <SppgReceivingWorkspace
        initialDeliveries={deliveries}
        onLookupToken={lookupDeliveryByQrTokenAction}
      />
    </main>
  );
}
