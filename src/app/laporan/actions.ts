'use server';

import { revalidatePath } from 'next/cache';
import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import {
  getPublicWhistleblowerSnapshot,
  submitCommunityReport,
  triageCommunityReport,
  type PublicWhistleblowerSnapshot,
  type SubmitCommunityReportInput,
  type TriageCommunityReportInput,
  type WhistleblowerFilter,
  type WhistleblowerMutationResult,
} from '@/lib/whistleblower';

/**
 * Server Action to initialize the SQLite database (auto-migrate and auto-seed)
 * and return the privacy-safe Public Whistleblower Snapshot.
 */
export async function loadPublicWhistleblowerSnapshotAction(
  filter?: WhistleblowerFilter,
): Promise<PublicWhistleblowerSnapshot> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  return getPublicWhistleblowerSnapshot(db, filter);
}

/**
 * Server Action to submit a new community whistleblower or feedback report
 * and revalidate affected routes.
 */
export async function submitCommunityReportAction(
  input: SubmitCommunityReportInput,
): Promise<WhistleblowerMutationResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const result = submitCommunityReport(db, input);
  if (result.success) {
    revalidatePath('/laporan');
    revalidatePath('/');
  }
  return result;
}

/**
 * Server Action for Koperasi Admin or SPPG Staff to triage a community report
 * (`DITINDAKLANJUTI` or `SELESAI`) and record an official response note.
 */
export async function triageCommunityReportAction(
  input: TriageCommunityReportInput,
): Promise<WhistleblowerMutationResult> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  const result = triageCommunityReport(db, input);
  if (result.success) {
    revalidatePath('/laporan');
    revalidatePath('/');
  }
  return result;
}
