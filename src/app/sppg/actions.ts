'use server';

import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import {
  listKitchenDeliveries,
  lookupDeliveryByQrToken,
  type DeliveryLookupResult,
} from '@/lib/receiving';
import type { DeliveryPassView } from '@/lib/dispatch';

/** Server Action to look up a delivery dispatch by its QR token or verification URL. */
export async function lookupDeliveryByQrTokenAction(
  rawInput: string,
): Promise<DeliveryLookupResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  return lookupDeliveryByQrToken(db, rawInput);
}

/** Server Action to list incoming deliveries for an SPPG kitchen. */
export async function listKitchenDeliveriesAction(
  kitchenId: number = 1,
): Promise<DeliveryPassView[]> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  return listKitchenDeliveries(db, kitchenId);
}
