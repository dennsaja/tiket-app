ALTER TABLE "tickets" ADD COLUMN "reporter_name" varchar(255);--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "reporter_address" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "reporter_map_url" text;