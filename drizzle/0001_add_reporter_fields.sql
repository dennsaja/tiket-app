-- Migration: 0001_add_reporter_fields.sql
-- Description: Add optional reporter information fields to tickets table (backward-compatible, non-destructive)

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reporter_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reporter_address" text;
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reporter_map_url" text;
