'use server';

import { getDatabase } from '@/db/client';
import { ensureInitializedDatabase } from '@/lib/procurement-service';
import {
  getPublicTransparencySnapshot,
  type PublicTransparencyFilter,
  type PublicTransparencySnapshot,
} from '@/lib/transparency';

/**
 * Server Action to initialize (auto-migrate and auto-seed) the SQLite database
 * and return the current Public Transparency Dashboard snapshot.
 */
export async function loadPublicTransparencySnapshotAction(
  filter?: PublicTransparencyFilter,
): Promise<PublicTransparencySnapshot> {
  const db = getDatabase();
  ensureInitializedDatabase(db);
  return getPublicTransparencySnapshot(db, filter);
}
