CREATE TABLE `community_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`severity` text DEFAULT 'MEDIUM' NOT NULL,
	`status` text DEFAULT 'BARU' NOT NULL,
	`reporter_role_label` text NOT NULL,
	`reporter_name` text,
	`reporter_contact` text,
	`is_anonymous` integer DEFAULT 1 NOT NULL,
	`delivery_id` integer,
	`cooperative_id` integer,
	`kitchen_id` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`photo_path` text,
	`response_note` text,
	`responded_by` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cooperative_id`) REFERENCES `cooperatives`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`kitchen_id`) REFERENCES `kitchens`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "community_reports_category_valid" CHECK("community_reports"."category" IN ('KUALITAS_PANGAN', 'HARGA_PETANI', 'KENDALA_DISTRIBUSI', 'SELISIH_KUANTITAS')),
	CONSTRAINT "community_reports_severity_valid" CHECK("community_reports"."severity" IN ('HIGH', 'MEDIUM', 'LOW')),
	CONSTRAINT "community_reports_status_valid" CHECK("community_reports"."status" IN ('BARU', 'DITINDAKLANJUTI', 'SELESAI'))
);
--> statement-breakpoint
CREATE INDEX `community_reports_status_idx` ON `community_reports` (`status`);--> statement-breakpoint
CREATE INDEX `community_reports_category_idx` ON `community_reports` (`category`);--> statement-breakpoint
CREATE INDEX `community_reports_cooperative_id_idx` ON `community_reports` (`cooperative_id`);--> statement-breakpoint
CREATE INDEX `community_reports_kitchen_id_idx` ON `community_reports` (`kitchen_id`);
