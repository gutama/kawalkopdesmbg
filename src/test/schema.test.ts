// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import {
  DELIVERY_STATUSES,
  COMMODITY_UNITS,
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  commodities,
  communityReports,
  cooperatives,
  deliveries,
  deliveryItems,
  farmers,
  kitchens,
  proofOfDelivery,
} from "@/db/schema";
import { createTestDatabase } from "./helpers/db";

let db: AppDatabase;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  db.$client.close();
});

/** Inserts one row per parent entity so child tables can reference them. */
function insertParents(database: AppDatabase) {
  const [cooperative] = database
    .insert(cooperatives)
    .values({
      name: "Koperasi Desa Merah Putih Cibogo",
      village: "Cibogo",
      district: "Cibogo",
      regency: "Kabupaten Subang",
      province: "Jawa Barat",
    })
    .returning()
    .all();
  const [kitchen] = database
    .insert(kitchens)
    .values({
      name: "SPPG Subang Kota",
      address: "Jl. Otto Iskandardinata No. 10, Subang",
      regency: "Kabupaten Subang",
      province: "Jawa Barat",
      dailyCapacity: 3000,
      serviceArea: "Kecamatan Subang",
    })
    .returning()
    .all();
  const [farmer] = database
    .insert(farmers)
    .values({ cooperativeId: cooperative.id, name: "Pak Asep", village: "Cibogo" })
    .returning()
    .all();
  const [commodity] = database
    .insert(commodities)
    .values({ name: "Beras Medium", unit: "kg", benchmarkPrice: 13500 })
    .returning()
    .all();
  return { cooperative, kitchen, farmer, commodity };
}

/** Inserts a delivery for the given parents and returns it. */
function insertDelivery(
  database: AppDatabase,
  parents: ReturnType<typeof insertParents>,
  qrToken = "token-0001-abcdefghijklmnopqrstuv",
) {
  const [delivery] = database
    .insert(deliveries)
    .values({
      cooperativeId: parents.cooperative.id,
      kitchenId: parents.kitchen.id,
      scheduledDate: "2026-10-15",
      qrToken,
    })
    .returning()
    .all();
  return delivery;
}

describe("schema constants", () => {
  it("exposes the delivery lifecycle statuses in order", () => {
    expect(DELIVERY_STATUSES).toEqual(["DRAFT", "DISPATCHED", "VERIFIED", "REJECTED"]);
  });

  it("exposes the supported commodity units", () => {
    expect(COMMODITY_UNITS).toEqual(["kg", "liter", "ikat", "butir"]);
  });

  it("exposes community report categories, severities, and lifecycle statuses", () => {
    expect(REPORT_CATEGORIES).toEqual([
      "KUALITAS_PANGAN",
      "HARGA_PETANI",
      "KENDALA_DISTRIBUSI",
      "SELISIH_KUANTITAS",
    ]);
    expect(REPORT_SEVERITIES).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect(REPORT_STATUSES).toEqual(["BARU", "DITINDAKLANJUTI", "SELESAI"]);
  });
});

describe("migrations", () => {
  it("create all domain tables including community_reports", () => {
    const rows = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = rows.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "cooperatives",
        "kitchens",
        "farmers",
        "commodities",
        "deliveries",
        "delivery_items",
        "proof_of_delivery",
        "community_reports",
      ]),
    );
  });
});

describe("cooperatives, kitchens and farmers", () => {
  it("persists a cooperative with an automatic creation timestamp", () => {
    const { cooperative } = insertParents(db);
    expect(cooperative.id).toBeGreaterThan(0);
    expect(cooperative.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a kitchen with non-positive daily capacity", () => {
    expect(() =>
      db
        .insert(kitchens)
        .values({
          name: "SPPG Invalid",
          address: "-",
          regency: "Kabupaten Subang",
          province: "Jawa Barat",
          dailyCapacity: 0,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects a farmer that references a missing cooperative", () => {
    expect(() =>
      db.insert(farmers).values({ cooperativeId: 999, name: "Ghost", village: "Nowhere" }).run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("prevents deleting a cooperative that still has farmers", () => {
    const { cooperative } = insertParents(db);
    expect(() => db.delete(cooperatives).where(eq(cooperatives.id, cooperative.id)).run()).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});

describe("commodities", () => {
  it("enforces unique commodity names", () => {
    insertParents(db);
    expect(() =>
      db.insert(commodities).values({ name: "Beras Medium", unit: "kg", benchmarkPrice: 14000 }).run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("rejects non-positive benchmark prices", () => {
    expect(() =>
      db.insert(commodities).values({ name: "Telur Ayam Ras", unit: "kg", benchmarkPrice: 0 }).run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects units outside the supported list at the database level", () => {
    expect(() =>
      db.$client
        .prepare("INSERT INTO commodities (name, unit, benchmark_price) VALUES (?, ?, ?)")
        .run("Gula Pasir", "karung", 17000),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe("deliveries", () => {
  it("defaults new deliveries to DRAFT status", () => {
    const delivery = insertDelivery(db, insertParents(db));
    expect(delivery.status).toBe("DRAFT");
    expect(delivery.dispatchedAt).toBeNull();
  });

  it("enforces unique QR security tokens", () => {
    const parents = insertParents(db);
    insertDelivery(db, parents, "duplicate-token-abcdefghijklmnop");
    expect(() => insertDelivery(db, parents, "duplicate-token-abcdefghijklmnop")).toThrow(
      /UNIQUE constraint failed/,
    );
  });

  it("rejects statuses outside the lifecycle at the database level", () => {
    const parents = insertParents(db);
    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO deliveries (cooperative_id, kitchen_id, scheduled_date, qr_token, status) VALUES (?, ?, ?, ?, ?)",
        )
        .run(parents.cooperative.id, parents.kitchen.id, "2026-10-15", "token-x", "LOST"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects a delivery that references a missing kitchen", () => {
    const parents = insertParents(db);
    expect(() =>
      db
        .insert(deliveries)
        .values({
          cooperativeId: parents.cooperative.id,
          kitchenId: 999,
          scheduledDate: "2026-10-15",
          qrToken: "token-missing-kitchen",
        })
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("refreshes updatedAt when a delivery status is updated", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    const [updated] = db
      .update(deliveries)
      .set({ status: "DISPATCHED", dispatchedAt: new Date() })
      .where(eq(deliveries.id, delivery.id))
      .returning()
      .all();
    expect(updated.status).toBe("DISPATCHED");
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });
});

describe("delivery items", () => {
  it("rejects non-positive quantities", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    expect(() =>
      db
        .insert(deliveryItems)
        .values({
          deliveryId: delivery.id,
          commodityId: parents.commodity.id,
          farmerId: parents.farmer.id,
          quantity: 0,
          unitPrice: 13000,
          totalValue: 0,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("rejects non-positive unit prices", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    expect(() =>
      db
        .insert(deliveryItems)
        .values({
          deliveryId: delivery.id,
          commodityId: parents.commodity.id,
          quantity: 10,
          unitPrice: 0,
          totalValue: 0,
        })
        .run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("are removed when their parent delivery is deleted", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    db.insert(deliveryItems)
      .values({
        deliveryId: delivery.id,
        commodityId: parents.commodity.id,
        quantity: 50,
        unitPrice: 13000,
        totalValue: 650000,
      })
      .run();

    db.delete(deliveries).where(eq(deliveries.id, delivery.id)).run();

    expect(db.select().from(deliveryItems).all()).toHaveLength(0);
  });

  it("prevent deleting a commodity that has been delivered", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    db.insert(deliveryItems)
      .values({
        deliveryId: delivery.id,
        commodityId: parents.commodity.id,
        quantity: 50,
        unitPrice: 13000,
        totalValue: 650000,
      })
      .run();

    expect(() =>
      db.delete(commodities).where(eq(commodities.id, parents.commodity.id)).run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });
});

describe("proof of delivery", () => {
  function insertProof(database: AppDatabase, deliveryId: number) {
    return database
      .insert(proofOfDelivery)
      .values({
        deliveryId,
        receiverName: "Ibu Siti Aminah",
        signOffNote: "Barang diterima lengkap dan segar.",
        photoPath: "uploads/pod/delivery-1.jpg",
      })
      .returning()
      .all()[0];
  }

  it("records a verification timestamp automatically", () => {
    const delivery = insertDelivery(db, insertParents(db));
    const proof = insertProof(db, delivery.id);
    expect(proof.verifiedAt).toBeInstanceOf(Date);
  });

  it("allows only one proof per delivery", () => {
    const delivery = insertDelivery(db, insertParents(db));
    insertProof(db, delivery.id);
    expect(() => insertProof(db, delivery.id)).toThrow(/UNIQUE constraint failed/);
  });

  it("is immutable once recorded", () => {
    const delivery = insertDelivery(db, insertParents(db));
    const proof = insertProof(db, delivery.id);
    expect(() =>
      db
        .update(proofOfDelivery)
        .set({ receiverName: "Tampered" })
        .where(eq(proofOfDelivery.id, proof.id))
        .run(),
    ).toThrow(/proof_of_delivery records are immutable/);
  });
});

describe("relations", () => {
  it("load a delivery with its cooperative, kitchen, items, commodities and proof", async () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    db.insert(deliveryItems)
      .values({
        deliveryId: delivery.id,
        commodityId: parents.commodity.id,
        farmerId: parents.farmer.id,
        quantity: 50,
        unitPrice: 13000,
        totalValue: 650000,
      })
      .run();
    db.insert(proofOfDelivery)
      .values({ deliveryId: delivery.id, receiverName: "Ibu Siti", photoPath: "uploads/pod/1.jpg" })
      .run();

    const loaded = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, delivery.id),
      with: {
        cooperative: true,
        kitchen: true,
        items: { with: { commodity: true, farmer: true } },
        proofOfDelivery: true,
      },
    });

    expect(loaded?.cooperative.name).toBe("Koperasi Desa Merah Putih Cibogo");
    expect(loaded?.kitchen.name).toBe("SPPG Subang Kota");
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0].commodity.name).toBe("Beras Medium");
    expect(loaded?.items[0].farmer?.name).toBe("Pak Asep");
    expect(loaded?.proofOfDelivery?.receiverName).toBe("Ibu Siti");
  });

  it("load a cooperative with its affiliated farmers", async () => {
    const { cooperative } = insertParents(db);
    const loaded = await db.query.cooperatives.findFirst({
      where: eq(cooperatives.id, cooperative.id),
      with: { farmers: true },
    });
    expect(loaded?.farmers.map((farmer) => farmer.name)).toEqual(["Pak Asep"]);
  });
});

describe("community reports", () => {
  it("defaults status to BARU, severity to MEDIUM, and isAnonymous to true", () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    const [report] = db
      .insert(communityReports)
      .values({
        category: "KUALITAS_PANGAN",
        reporterRoleLabel: "Warga / Orang Tua Siswa",
        deliveryId: delivery.id,
        cooperativeId: parents.cooperative.id,
        kitchenId: parents.kitchen.id,
        title: "Sayuran kurang segar saat diterima",
        description: "Beberapa ikat bayam tampak layu di bagian bawah keranjang.",
      })
      .returning()
      .all();

    expect(report.status).toBe("BARU");
    expect(report.severity).toBe("MEDIUM");
    expect(report.isAnonymous).toBe(true);
    expect(report.createdAt).toBeInstanceOf(Date);
  });

  it("enforces CHECK constraints on category, severity, and status", () => {
    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO community_reports (category, reporter_role_label, title, description) VALUES (?, ?, ?, ?)",
        )
        .run("INVALID_CAT", "Warga", "Judul", "Deskripsi"),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO community_reports (category, severity, reporter_role_label, title, description) VALUES (?, ?, ?, ?, ?)",
        )
        .run("KUALITAS_PANGAN", "CRITICAL", "Warga", "Judul", "Deskripsi"),
    ).toThrow(/CHECK constraint failed/);

    expect(() =>
      db.$client
        .prepare(
          "INSERT INTO community_reports (category, status, reporter_role_label, title, description) VALUES (?, ?, ?, ?, ?)",
        )
        .run("KUALITAS_PANGAN", "CLOSED", "Warga", "Judul", "Deskripsi"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("loads community report relations to delivery, cooperative, and kitchen", async () => {
    const parents = insertParents(db);
    const delivery = insertDelivery(db, parents);
    const [report] = db
      .insert(communityReports)
      .values({
        category: "SELISIH_KUANTITAS",
        severity: "HIGH",
        reporterRoleLabel: "Petugas Lapangan",
        deliveryId: delivery.id,
        cooperativeId: parents.cooperative.id,
        kitchenId: parents.kitchen.id,
        title: "Selisih timbangan beras 5 kg",
        description: "Timbangan saat penerimaan menunjukkan 245 kg dari 250 kg di surat jalan.",
      })
      .returning()
      .all();

    const loaded = await db.query.communityReports.findFirst({
      where: eq(communityReports.id, report.id),
      with: { delivery: true, cooperative: true, kitchen: true },
    });

    expect(loaded?.delivery?.qrToken).toBe(delivery.qrToken);
    expect(loaded?.cooperative?.name).toBe("Koperasi Desa Merah Putih Cibogo");
    expect(loaded?.kitchen?.name).toBe("SPPG Subang Kota");
  });
});
