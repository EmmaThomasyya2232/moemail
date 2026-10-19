CREATE TABLE `pending_message` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`address_lower` text NOT NULL,
	`from_address` text,
	`to_address` text,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`html` text,
	`received_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pending_message_address_lower_idx` ON `pending_message` (`address_lower`);--> statement-breakpoint
CREATE INDEX `pending_message_expires_at_idx` ON `pending_message` (`expires_at`);