import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { AppDatabase } from "./client";

/** Folder where Drizzle Kit writes generated SQL migrations. */
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Applies all pending Drizzle Kit migrations to the given database. */
export function runMigrations(db: AppDatabase, migrationsFolder: string = MIGRATIONS_FOLDER): void {
  migrate(db, { migrationsFolder });
}
