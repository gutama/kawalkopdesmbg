// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "@/db/client";
import {
  commodities,
  cooperatives,
  deliveries,
  deliveryItems,
  farmers,
  kitchens,
  proofOfDelivery,
} from "@/db/schema";
import { runSeedCli, seedDatabase } from "@/db/seed";
import { createTestDatabase } from "./helpers/db";

let db: AppDatabase;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  db.$client.close();
});

describe("seedDatabase", () => {
  it("creates the Subang and Banyumas village cooperatives", () => {
    seedDatabase(db);
    const rows = db.select().from(cooperatives).all();
    const regencies = rows.map((row) => row.regency);
    expect(regencies).toEqual(expect.arrayContaining(["Kabupaten Subang", "Kabupaten Banyumas"]));
  });

  it("creates SPPG kitchens and farmers for every cooperative", () => {
    seedDatabase(db);
    const coopRows = db.select().from(cooperatives).all();
    const farmerRows = db.select().from(farmers).all();

    expect(db.select().from(kitchens).all().length).toBeGreaterThanOrEqual(2);
    for (const cooperative of coopRows) {
      expect(farmerRows.some((farmer) => farmer.cooperativeId === cooperative.id)).toBe(true);
    }
  });

  it("creates staple commodities priced in whole Rupiah", () => {
    seedDatabase(db);
    const rows = db.select().from(commodities).all();
    expect(rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(["Beras Medium", "Telur Ayam Ras", "Daging Ayam Ras"]),
    );
    for (const row of rows) {
      expect(Number.isInteger(row.benchmarkPrice)).toBe(true);
    }
  });

  it("creates deliveries covering the DRAFT, DISPATCHED and VERIFIED states", () => {
    seedDatabase(db);
    const statuses = new Set(db.select().from(deliveries).all().map((row) => row.status));
    expect([...statuses]).toEqual(expect.arrayContaining(["DRAFT", "DISPATCHED", "VERIFIED"]));
  });

  it("attaches proof of delivery to exactly the verified deliveries", () => {
    seedDatabase(db);
    const verifiedIds = db
      .select()
      .from(deliveries)
      .all()
      .filter((row) => row.status === "VERIFIED")
      .map((row) => row.id)
      .sort();
    const proofIds = db
      .select()
      .from(proofOfDelivery)
      .all()
      .map((row) => row.deliveryId)
      .sort();
    expect(proofIds).toEqual(verifiedIds);
  });

  it("only sets dispatchedAt on deliveries that have left the cooperative", () => {
    seedDatabase(db);
    for (const row of db.select().from(deliveries).all()) {
      if (row.status === "DRAFT") {
        expect(row.dispatchedAt).toBeNull();
      } else {
        expect(row.dispatchedAt).toBeInstanceOf(Date);
      }
    }
  });

  it("stores line totals that equal quantity multiplied by unit price", () => {
    seedDatabase(db);
    const items = db.select().from(deliveryItems).all();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.totalValue).toBe(Math.round(item.quantity * item.unitPrice));
    }
  });

  it("generates unique, unguessable QR tokens", () => {
    seedDatabase(db);
    const tokens = db.select().from(deliveries).all().map((row) => row.qrToken);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    }
  });

  it("returns a summary of inserted row counts", () => {
    const summary = seedDatabase(db);
    expect(summary).toEqual({
      cooperatives: db.select().from(cooperatives).all().length,
      kitchens: db.select().from(kitchens).all().length,
      farmers: db.select().from(farmers).all().length,
      commodities: db.select().from(commodities).all().length,
      deliveries: db.select().from(deliveries).all().length,
      deliveryItems: db.select().from(deliveryItems).all().length,
      proofOfDelivery: db.select().from(proofOfDelivery).all().length,
    });
  });

  it("is idempotent when run repeatedly", () => {
    const first = seedDatabase(db);
    const second = seedDatabase(db);
    expect(second).toEqual(first);
    expect(db.select().from(cooperatives).all()).toHaveLength(first.cooperatives);
  });

  it("runs migrations and seeds via runSeedCli", () => {
    const originalUrl = process.env.DATABASE_URL;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kawal-seed-"));
    try {
      process.env.DATABASE_URL = path.join(tempDir, "seed.db");
      const summary = runSeedCli();
      expect(summary.cooperatives).toBeGreaterThanOrEqual(2);
      expect(summary.deliveries).toBeGreaterThanOrEqual(3);
    } finally {
      process.env.DATABASE_URL = originalUrl;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
