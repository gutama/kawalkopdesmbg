import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** Drizzle database handle typed with the full application schema. */
export type AppDatabase = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

/** Default database file used when `DATABASE_URL` is not set. */
export const DEFAULT_DATABASE_URL = "sqlite.db";

/**
 * Opens a SQLite connection and wraps it with Drizzle.
 *
 * SQLite leaves foreign keys off by default, so they are enabled on every
 * connection. File databases use WAL so the public dashboard can read while
 * the cooperative or kitchen is writing, and the busy timeout makes
 * concurrent writers wait instead of failing with `SQLITE_BUSY`.
 */
export function createDatabase(url: string = DEFAULT_DATABASE_URL): AppDatabase {
  const sqlite = new Database(url);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  if (url !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  return drizzle(sqlite, { schema });
}

// better-sqlite3 is synchronous and in-process, so a connection pool adds
// nothing. One shared connection per server process is the recommended
// pattern. It lives on globalThis so Next.js dev hot reloads reuse it
// instead of leaking file handles.
const globalForDb = globalThis as typeof globalThis & { kawalDb?: AppDatabase };

/** Returns the process-wide shared connection, opening it on first use. */
export function getDatabase(): AppDatabase {
  if (!globalForDb.kawalDb) {
    globalForDb.kawalDb = createDatabase(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  }
  return globalForDb.kawalDb;
}

/** Closes the shared connection, if any, so the next `getDatabase` call reopens it. */
export function closeDatabase(): void {
  globalForDb.kawalDb?.$client.close();
  globalForDb.kawalDb = undefined;
}
