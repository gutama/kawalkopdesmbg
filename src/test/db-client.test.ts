// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, createDatabase, getDatabase } from "@/db/client";

describe("createDatabase", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enables foreign key enforcement", () => {
    const db = createDatabase(":memory:");
    expect(db.$client.pragma("foreign_keys", { simple: true })).toBe(1);
    db.$client.close();
  });

  it("configures a busy timeout so concurrent writers wait instead of failing", () => {
    const db = createDatabase(":memory:");
    expect(db.$client.pragma("busy_timeout", { simple: true })).toBe(5000);
    db.$client.close();
  });

  it("uses WAL journaling for file-backed databases", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kawal-db-"));
    tempDirs.push(dir);
    const db = createDatabase(path.join(dir, "test.db"));
    expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
    db.$client.close();
  });
});

describe("getDatabase", () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    closeDatabase();
    process.env.DATABASE_URL = originalUrl;
  });

  it("returns the same shared connection on repeated calls", () => {
    process.env.DATABASE_URL = ":memory:";
    expect(getDatabase()).toBe(getDatabase());
  });

  it("opens a fresh connection after closeDatabase", () => {
    process.env.DATABASE_URL = ":memory:";
    const first = getDatabase();
    closeDatabase();
    const second = getDatabase();
    expect(second).not.toBe(first);
    expect(first.$client.open).toBe(false);
  });

  it("treats closeDatabase as a no-op when nothing is open", () => {
    expect(() => closeDatabase()).not.toThrow();
  });
});
