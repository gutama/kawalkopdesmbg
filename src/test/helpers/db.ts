import { createDatabase, type AppDatabase } from "@/db/client";
import { runMigrations } from "@/db/migrate";

/**
 * Creates an isolated in-memory SQLite database with every Drizzle Kit
 * migration applied. Tests therefore run against the exact schema that
 * production will see, triggers and CHECK constraints included.
 */
export function createTestDatabase(): AppDatabase {
  const db = createDatabase(":memory:");
  runMigrations(db);
  return db;
}
