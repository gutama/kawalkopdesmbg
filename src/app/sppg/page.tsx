import React from 'react';
import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import { listKitchenDeliveries } from '@/lib/receiving';
import { SppgReceivingWorkspace } from '@/components/sppg-receiving-workspace';
import {
  completeDeliveryVerificationAction,
  lookupDeliveryByQrTokenAction,
} from './actions';

export const dynamic = 'force-dynamic';

/**
 * SPPG Central Kitchen Receiving page (`/sppg`) for scanning delivery QR passes,
 * inspecting incoming local food commodities, uploading Proof-of-Delivery photos,
 * and issuing immutable digital verification receipts.
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
        onVerifyDelivery={completeDeliveryVerificationAction}
      />
    </main>
  );
}
