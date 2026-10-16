CREATE TABLE `commodities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`benchmark_price` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "commodities_unit_valid" CHECK("commodities"."unit" IN ('kg', 'liter', 'ikat', 'butir')),
	CONSTRAINT "commodities_benchmark_price_positive" CHECK("commodities"."benchmark_price" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commodities_name_unique` ON `commodities` (`name`);--> statement-breakpoint
CREATE TABLE `cooperatives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`village` text NOT NULL,
	`district` text NOT NULL,
	`regency` text NOT NULL,
	`province` text NOT NULL,
	`contact_name` text,
	`contact_phone` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cooperative_id` integer NOT NULL,
	`kitchen_id` integer NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`qr_token` text NOT NULL,
	`dispatched_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kitchen_id`) REFERENCES `kitchens`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "deliveries_status_valid" CHECK("deliveries"."status" IN ('DRAFT', 'DISPATCHED', 'VERIFIED', 'REJECTED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_qr_token_unique` ON `deliveries` (`qr_token`);--> statement-breakpoint
CREATE INDEX `deliveries_status_idx` ON `deliveries` (`status`);--> statement-breakpoint
CREATE INDEX `deliveries_cooperative_id_idx` ON `deliveries` (`cooperative_id`);--> statement-breakpoint
CREATE INDEX `deliveries_kitchen_id_idx` ON `deliveries` (`kitchen_id`);--> statement-breakpoint
CREATE TABLE `delivery_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_id` integer NOT NULL,
	`commodity_id` integer NOT NULL,
	`farmer_id` integer,
	`quantity` real NOT NULL,
	`unit_price` integer NOT NULL,
	`total_value` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`commodity_id`) REFERENCES `commodities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`farmer_id`) REFERENCES `farmers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "delivery_items_quantity_positive" CHECK("delivery_items"."quantity" > 0),
	CONSTRAINT "delivery_items_unit_price_positive" CHECK("delivery_items"."unit_price" > 0),
	CONSTRAINT "delivery_items_total_value_non_negative" CHECK("delivery_items"."total_value" >= 0)
);
--> statement-breakpoint
CREATE INDEX `delivery_items_delivery_id_idx` ON `delivery_items` (`delivery_id`);--> statement-breakpoint
CREATE TABLE `farmers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cooperative_id` integer NOT NULL,
	`name` text NOT NULL,
	`village` text NOT NULL,
	`phone` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `farmers_cooperative_id_idx` ON `farmers` (`cooperative_id`);--> statement-breakpoint
CREATE TABLE `kitchens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`regency` text NOT NULL,
	`province` text NOT NULL,
	`daily_capacity` integer NOT NULL,
	`service_area` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "kitchens_daily_capacity_positive" CHECK("kitchens"."daily_capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE `proof_of_delivery` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`delivery_id` integer NOT NULL,
	`receiver_name` text NOT NULL,
	`verified_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sign_off_note` text,
	`photo_path` text NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_of_delivery_delivery_id_unique` ON `proof_of_delivery` (`delivery_id`);