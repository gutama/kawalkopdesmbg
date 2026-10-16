import { relations, sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Lifecycle of a delivery dispatch. A delivery starts as a cooperative's
 * DRAFT, becomes DISPATCHED when the truck leaves with its QR pass, and ends
 * VERIFIED (or REJECTED) after the SPPG kitchen's receiving handshake.
 */
export const DELIVERY_STATUSES = ["DRAFT", "DISPATCHED", "VERIFIED", "REJECTED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Units used by village markets for staple MBG commodities. */
export const COMMODITY_UNITS = ["kg", "liter", "ikat", "butir"] as const;
export type CommodityUnit = (typeof COMMODITY_UNITS)[number];

/** Renders a TypeScript string tuple as a SQL `IN (...)` list for CHECK constraints. */
function sqlInList(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

/** Unix-epoch creation timestamp shared by all tables (stored in seconds). */
function createdAt() {
  return integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);
}

/** Village cooperative (Koperasi Desa) that aggregates farmer produce. */
export const cooperatives = sqliteTable("cooperatives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  village: text("village").notNull(),
  district: text("district").notNull(),
  regency: text("regency").notNull(),
  province: text("province").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  createdAt: createdAt(),
});

/** SPPG central kitchen (Satuan Pelayanan Pemenuhan Gizi) receiving deliveries. */
export const kitchens = sqliteTable(
  "kitchens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    address: text("address").notNull(),
    regency: text("regency").notNull(),
    province: text("province").notNull(),
    /** Meal portions the kitchen can prepare per day. */
    dailyCapacity: integer("daily_capacity").notNull(),
    serviceArea: text("service_area"),
    createdAt: createdAt(),
  },
  (table) => [check("kitchens_daily_capacity_positive", sql`${table.dailyCapacity} > 0`)],
);

/** Local farmer affiliated with exactly one village cooperative. */
export const farmers = sqliteTable(
  "farmers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cooperativeId: integer("cooperative_id")
      .notNull()
      .references(() => cooperatives.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    village: text("village").notNull(),
    phone: text("phone"),
    createdAt: createdAt(),
  },
  (table) => [index("farmers_cooperative_id_idx").on(table.cooperativeId)],
);

/** Agricultural product with its regional government benchmark price. */
export const commodities = sqliteTable(
  "commodities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    unit: text("unit", { enum: COMMODITY_UNITS }).notNull(),
    /** Benchmark price per unit in whole Rupiah (IDR has no minor unit in practice). */
    benchmarkPrice: integer("benchmark_price").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("commodities_unit_valid", sql`${table.unit} IN (${sqlInList(COMMODITY_UNITS)})`),
    check("commodities_benchmark_price_positive", sql`${table.benchmarkPrice} > 0`),
  ],
);

/** Delivery dispatch from a cooperative to an SPPG kitchen, secured by a QR token. */
export const deliveries = sqliteTable(
  "deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cooperativeId: integer("cooperative_id")
      .notNull()
      .references(() => cooperatives.id, { onDelete: "restrict" }),
    kitchenId: integer("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "restrict" }),
    /** Calendar date (YYYY-MM-DD, Asia/Jakarta) the delivery is scheduled for. */
    scheduledDate: text("scheduled_date").notNull(),
    status: text("status", { enum: DELIVERY_STATUSES }).notNull().default("DRAFT"),
    /** Random, unguessable token encoded in the Surat Jalan Digital QR code. */
    qrToken: text("qr_token").notNull().unique(),
    dispatchedAt: integer("dispatched_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("deliveries_status_valid", sql`${table.status} IN (${sqlInList(DELIVERY_STATUSES)})`),
    index("deliveries_status_idx").on(table.status),
    index("deliveries_cooperative_id_idx").on(table.cooperativeId),
    index("deliveries_kitchen_id_idx").on(table.kitchenId),
  ],
);

/** Line item of a delivery: which commodity, how much, and what the farmer was paid. */
export const deliveryItems = sqliteTable(
  "delivery_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryId: integer("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    commodityId: integer("commodity_id")
      .notNull()
      .references(() => commodities.id, { onDelete: "restrict" }),
    /** Supplying farmer; optional when produce is pooled from several farmers. */
    farmerId: integer("farmer_id").references(() => farmers.id, { onDelete: "restrict" }),
    quantity: real("quantity").notNull(),
    /** Price per unit paid to the farmer, in whole Rupiah. */
    unitPrice: integer("unit_price").notNull(),
    /** Line total in whole Rupiah, i.e. round(quantity * unitPrice). */
    totalValue: integer("total_value").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("delivery_items_quantity_positive", sql`${table.quantity} > 0`),
    check("delivery_items_unit_price_positive", sql`${table.unitPrice} > 0`),
    check("delivery_items_total_value_non_negative", sql`${table.totalValue} >= 0`),
    index("delivery_items_delivery_id_idx").on(table.deliveryId),
  ],
);

/**
 * Receiving-side verification record. One per delivery, and immutable once
 * written: the migration adds a trigger that aborts any UPDATE.
 */
export const proofOfDelivery = sqliteTable("proof_of_delivery", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deliveryId: integer("delivery_id")
    .notNull()
    .unique()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  receiverName: text("receiver_name").notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  signOffNote: text("sign_off_note"),
  /** Storage key/path of the compressed proof-of-delivery photo. */
  photoPath: text("photo_path").notNull(),
});

export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  farmers: many(farmers),
  deliveries: many(deliveries),
}));

export const kitchensRelations = relations(kitchens, ({ many }) => ({
  deliveries: many(deliveries),
}));

export const farmersRelations = relations(farmers, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [farmers.cooperativeId],
    references: [cooperatives.id],
  }),
  deliveryItems: many(deliveryItems),
}));

export const commoditiesRelations = relations(commodities, ({ many }) => ({
  deliveryItems: many(deliveryItems),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [deliveries.cooperativeId],
    references: [cooperatives.id],
  }),
  kitchen: one(kitchens, {
    fields: [deliveries.kitchenId],
    references: [kitchens.id],
  }),
  items: many(deliveryItems),
  proofOfDelivery: one(proofOfDelivery),
}));

export const deliveryItemsRelations = relations(deliveryItems, ({ one }) => ({
  delivery: one(deliveries, {
    fields: [deliveryItems.deliveryId],
    references: [deliveries.id],
  }),
  commodity: one(commodities, {
    fields: [deliveryItems.commodityId],
    references: [commodities.id],
  }),
  farmer: one(farmers, {
    fields: [deliveryItems.farmerId],
    references: [farmers.id],
  }),
}));

export const proofOfDeliveryRelations = relations(proofOfDelivery, ({ one }) => ({
  delivery: one(deliveries, {
    fields: [proofOfDelivery.deliveryId],
    references: [deliveries.id],
  }),
}));

export type Cooperative = typeof cooperatives.$inferSelect;
export type NewCooperative = typeof cooperatives.$inferInsert;
export type Kitchen = typeof kitchens.$inferSelect;
export type NewKitchen = typeof kitchens.$inferInsert;
export type Farmer = typeof farmers.$inferSelect;
export type NewFarmer = typeof farmers.$inferInsert;
export type Commodity = typeof commodities.$inferSelect;
export type NewCommodity = typeof commodities.$inferInsert;
export type Delivery = typeof deliveries.$inferSelect;
export type NewDelivery = typeof deliveries.$inferInsert;
export type DeliveryItem = typeof deliveryItems.$inferSelect;
export type NewDeliveryItem = typeof deliveryItems.$inferInsert;
export type ProofOfDelivery = typeof proofOfDelivery.$inferSelect;
export type NewProofOfDelivery = typeof proofOfDelivery.$inferInsert;
