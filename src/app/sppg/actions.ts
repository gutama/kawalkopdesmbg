'use server';

import { revalidatePath } from 'next/cache';
import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import {
  completeDeliveryVerification,
  listKitchenDeliveries,
  lookupDeliveryByQrToken,
  type CompleteDeliveryVerificationRequest,
  type CompleteDeliveryVerificationResult,
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

/** Server Action to complete two-way Proof-of-Delivery verification and transition to VERIFIED. */
export async function completeDeliveryVerificationAction(
  request: CompleteDeliveryVerificationRequest,
): Promise<CompleteDeliveryVerificationResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const result = await completeDeliveryVerification(db, request);
  if (result.success) {
    revalidatePath('/sppg');
    revalidatePath('/koperasi');
    revalidatePath('/');
  }
  return result;
}
