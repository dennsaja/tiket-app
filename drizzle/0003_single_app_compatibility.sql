-- Schema additions previously bundled with the old account/data reset hooks.
-- Preserve all existing accounts, passwords, tickets, categories and settings.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(50);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "ticket_type" varchar(50);
