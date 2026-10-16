import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, getDatabase, type AppDatabase } from "./client";
import { runMigrations } from "./migrate";
import {
  commodities,
  cooperatives,
  deliveries,
  deliveryItems,
  farmers,
  kitchens,
  proofOfDelivery,
} from "./schema";

/** Summary of table row counts returned after seeding the database. */
export interface SeedSummary {
  cooperatives: number;
  kitchens: number;
  farmers: number;
  commodities: number;
  deliveries: number;
  deliveryItems: number;
  proofOfDelivery: number;
}

/** Counts rows across all domain tables for reporting and idempotency checks. */
function getSeedSummary(db: AppDatabase): SeedSummary {
  return {
    cooperatives: db.select().from(cooperatives).all().length,
    kitchens: db.select().from(kitchens).all().length,
    farmers: db.select().from(farmers).all().length,
    commodities: db.select().from(commodities).all().length,
    deliveries: db.select().from(deliveries).all().length,
    deliveryItems: db.select().from(deliveryItems).all().length,
    proofOfDelivery: db.select().from(proofOfDelivery).all().length,
  };
}

/**
 * Populates the database with realistic Indonesian village cooperative, farmer,
 * SPPG central kitchen, commodity, and delivery data for Subang and Banyumas.
 *
 * The operation is idempotent: if cooperatives are already present, existing
 * records are preserved and current table counts are returned.
 */
export function seedDatabase(db: AppDatabase): SeedSummary {
  const existing = getSeedSummary(db);
  if (existing.cooperatives > 0) {
    return existing;
  }

  const runSeedTransaction = db.$client.transaction(() => {
    const [subangCoop, banyumasCoop] = db
      .insert(cooperatives)
      .values([
        {
          name: "Koperasi Desa Merah Putih Cibogo",
          village: "Desa Cibogo",
          district: "Kecamatan Cibogo",
          regency: "Kabupaten Subang",
          province: "Jawa Barat",
          contactName: "Pak Tatang Ruhiyat",
          contactPhone: "0812-2345-6781",
        },
        {
          name: "BUMDes Maju Bersama Sokaraja",
          village: "Desa Sokaraja Tengah",
          district: "Kecamatan Sokaraja",
          regency: "Kabupaten Banyumas",
          province: "Jawa Tengah",
          contactName: "Ibu Sri Wahyuni",
          contactPhone: "0813-2890-4412",
        },
      ])
      .returning()
      .all();

    const [subangKitchen, banyumasKitchen] = db
      .insert(kitchens)
      .values([
        {
          name: "SPPG Dapur Gizi Subang Kota",
          address: "Jl. Otto Iskandardinata No. 88, Karanganyar, Subang",
          regency: "Kabupaten Subang",
          province: "Jawa Barat",
          dailyCapacity: 3200,
          serviceArea: "Kecamatan Subang & Kecamatan Cibogo",
        },
        {
          name: "SPPG Satuan Gizi Purwokerto Timur",
          address: "Jl. Jenderal Sudirman No. 214, Purwokerto",
          regency: "Kabupaten Banyumas",
          province: "Jawa Tengah",
          dailyCapacity: 3800,
          serviceArea: "Kecamatan Sokaraja & Purwokerto Timur",
        },
      ])
      .returning()
      .all();

    const [pakAsep, buIda, pakSlamet, buRatna] = db
      .insert(farmers)
      .values([
        {
          cooperativeId: subangCoop.id,
          name: "Pak Asep Sunandar",
          village: "Desa Cibogo",
          phone: "0852-1109-2231",
        },
        {
          cooperativeId: subangCoop.id,
          name: "Ibu Ida Farida",
          village: "Desa Padaasih",
          phone: "0853-2291-7740",
        },
        {
          cooperativeId: banyumasCoop.id,
          name: "Pak Slamet Riyadi",
          village: "Desa Sokaraja Tengah",
          phone: "0815-4201-9981",
        },
        {
          cooperativeId: banyumasCoop.id,
          name: "Ibu Ratna Ningsih",
          village: "Desa Kalikidang",
          phone: "0816-7732-5510",
        },
      ])
      .returning()
      .all();

    const [beras, telur, ayam, bayam, susu] = db
      .insert(commodities)
      .values([
        { name: "Beras Medium", unit: "kg", benchmarkPrice: 13500 },
        { name: "Telur Ayam Ras", unit: "kg", benchmarkPrice: 28000 },
        { name: "Daging Ayam Ras", unit: "kg", benchmarkPrice: 36000 },
        { name: "Sayur Bayam Segar", unit: "ikat", benchmarkPrice: 3500 },
        { name: "Susu Sapi Pasteurisasi", unit: "liter", benchmarkPrice: 16000 },
      ])
      .returning()
      .all();

    const verifiedDispatchDate = new Date("2026-10-14T06:15:00+07:00");
    const verifiedAtDate = new Date("2026-10-14T08:05:00+07:00");
    const activeDispatchDate = new Date("2026-10-16T06:30:00+07:00");

    const [subangVerified, banyumasVerified, subangDispatched, banyumasDraft] = db
      .insert(deliveries)
      .values([
        {
          cooperativeId: subangCoop.id,
          kitchenId: subangKitchen.id,
          scheduledDate: "2026-10-14",
          status: "VERIFIED",
          qrToken: "mbg_sbg_20261014_verified_8f9a2b3c4d5e6f7a8b9c0d",
          dispatchedAt: verifiedDispatchDate,
        },
        {
          cooperativeId: banyumasCoop.id,
          kitchenId: banyumasKitchen.id,
          scheduledDate: "2026-10-15",
          status: "VERIFIED",
          qrToken: "mbg_bms_20261015_verified_1a2b3c4d5e6f7a8b9c0d1e",
          dispatchedAt: new Date("2026-10-15T06:00:00+07:00"),
        },
        {
          cooperativeId: subangCoop.id,
          kitchenId: subangKitchen.id,
          scheduledDate: "2026-10-16",
          status: "DISPATCHED",
          qrToken: "mbg_sbg_20261016_dispatch_9c8b7a6f5e4d3c2b1a0f9e",
          dispatchedAt: activeDispatchDate,
        },
        {
          cooperativeId: banyumasCoop.id,
          kitchenId: banyumasKitchen.id,
          scheduledDate: "2026-10-17",
          status: "DRAFT",
          qrToken: "mbg_bms_20261017_draft_3f4e5d6c7b8a9f0e1d2c3b4a",
          dispatchedAt: null,
        },
      ])
      .returning()
      .all();

    const rawItems = [
      {
        deliveryId: subangVerified.id,
        commodityId: beras.id,
        farmerId: pakAsep.id,
        quantity: 250,
        unitPrice: 13400,
      },
      {
        deliveryId: subangVerified.id,
        commodityId: telur.id,
        farmerId: buIda.id,
        quantity: 90,
        unitPrice: 27800,
      },
      {
        deliveryId: subangVerified.id,
        commodityId: bayam.id,
        farmerId: pakAsep.id,
        quantity: 180,
        unitPrice: 3500,
      },
      {
        deliveryId: banyumasVerified.id,
        commodityId: beras.id,
        farmerId: pakSlamet.id,
        quantity: 300,
        unitPrice: 13500,
      },
      {
        deliveryId: banyumasVerified.id,
        commodityId: ayam.id,
        farmerId: buRatna.id,
        quantity: 120,
        unitPrice: 35800,
      },
      {
        deliveryId: banyumasVerified.id,
        commodityId: susu.id,
        farmerId: buRatna.id,
        quantity: 150,
        unitPrice: 15900,
      },
      {
        deliveryId: subangDispatched.id,
        commodityId: beras.id,
        farmerId: pakAsep.id,
        quantity: 200,
        unitPrice: 13500,
      },
      {
        deliveryId: subangDispatched.id,
        commodityId: ayam.id,
        farmerId: buIda.id,
        quantity: 80,
        unitPrice: 36000,
      },
      {
        deliveryId: banyumasDraft.id,
        commodityId: telur.id,
        farmerId: pakSlamet.id,
        quantity: 110,
        unitPrice: 28000,
      },
    ];

    db.insert(deliveryItems)
      .values(
        rawItems.map((item) => ({
          ...item,
          totalValue: Math.round(item.quantity * item.unitPrice),
        })),
      )
      .run();

    db.insert(proofOfDelivery)
      .values([
        {
          deliveryId: subangVerified.id,
          receiverName: "Ibu Siti Aminah (Kepala Dapur SPPG Subang)",
          verifiedAt: verifiedAtDate,
          signOffNote: "Beras, telur, dan bayam diterima segar sesuai timbangan.",
          photoPath: "/uploads/pod/demo-subang-20261014.jpg",
        },
        {
          deliveryId: banyumasVerified.id,
          receiverName: "Pak Hendra Wijaya (Koordinator SPPG Purwokerto)",
          verifiedAt: new Date("2026-10-15T07:45:00+07:00"),
          signOffNote: "Semua komoditas lengkap, suhu susu terjaga baik.",
          photoPath: "/uploads/pod/demo-banyumas-20261015.jpg",
        },
      ])
      .run();
  });

  runSeedTransaction();
  return getSeedSummary(db);
}

/** Runs migrations and seeds the configured SQLite database from the CLI. */
export function runSeedCli(): SeedSummary {
  const db = getDatabase();
  try {
    runMigrations(db);
    return seedDatabase(db);
  } finally {
    closeDatabase();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runSeedCli();
}
