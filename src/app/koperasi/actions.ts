'use server';

import { revalidatePath } from 'next/cache';
import { getDatabase } from '@/db/client';
import {
  createDeliveryDispatch,
  type CreateDeliveryDispatchRequest,
  type CreateDeliveryDispatchResult,
} from '@/lib/dispatch';
import {
  ensureInitializedDatabase,
  getCooperativeProcurementWorkspace,
  recordFarmerProcurement,
  type CooperativeProcurementWorkspace,
  type RecordFarmerProcurementRequest,
  type RecordFarmerProcurementResult,
} from '@/lib/procurement-service';

/** Server Action to fetch the cooperative procurement workspace from SQLite. */
export async function loadCooperativeWorkspaceAction(
  cooperativeId: number = 1,
): Promise<CooperativeProcurementWorkspace> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  return getCooperativeProcurementWorkspace(db, cooperativeId);
}

/** Server Action to record a local farmer produce procurement entry and revalidate `/koperasi`. */
export async function recordFarmerProcurementAction(
  request: RecordFarmerProcurementRequest,
): Promise<RecordFarmerProcurementResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const result = recordFarmerProcurement(db, request);
  if (result.success) {
    revalidatePath('/koperasi');
    revalidatePath('/');
  }
  return result;
}

/** Server Action to create a cooperative delivery dispatch order and generate its QR pass. */
export async function createDeliveryDispatchAction(
  request: CreateDeliveryDispatchRequest,
): Promise<CreateDeliveryDispatchResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const result = await createDeliveryDispatch(db, request);
  if (result.success) {
    revalidatePath('/koperasi');
    revalidatePath('/sppg');
    revalidatePath('/');
  }
  return result;
}
