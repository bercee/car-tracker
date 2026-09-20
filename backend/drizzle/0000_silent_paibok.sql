CREATE TABLE `adblue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_date` text NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`odometer_km` integer NOT NULL,
	`liters_milliliters` integer NOT NULL,
	`price_huf` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_adblue_event_date` ON `adblue` (`event_date`,`id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_date` text NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`amount_huf` integer NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_event_date` ON `expenses` (`event_date`,`id`);--> statement-breakpoint
CREATE TABLE `fuel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_date` text NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`odometer_km` integer NOT NULL,
	`liters_milliliters` integer NOT NULL,
	`price_huf` integer NOT NULL,
	`full_tank` integer NOT NULL,
	`remark` text
);
--> statement-breakpoint
CREATE INDEX `idx_fuel_event_date` ON `fuel` (`event_date`,`id`);