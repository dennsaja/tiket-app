import { describe, expect, it } from "vitest";
import { readMigrationFiles } from "drizzle-orm/migrator";
import path from "node:path";

describe("single-app upgrade schema", () => {
  it("registers the existing ticket schema and the additive compatibility migration", () => {
    const migrations = readMigrationFiles({ migrationsFolder: path.join(process.cwd(), "drizzle") });
    expect(migrations).toHaveLength(4);
    expect(migrations[2].sql.join("\n")).toContain("CREATE TABLE IF NOT EXISTS ticket_work_reports");
    const additions = migrations[3].sql.join("\n");
    expect(additions).toContain('ADD COLUMN IF NOT EXISTS "username"');
    expect(additions).toContain('ADD COLUMN IF NOT EXISTS "ticket_type"');
    expect(additions).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
    expect(additions).not.toMatch(/\b(?:DELETE FROM|UPDATE users|TRUNCATE|DROP TABLE|password_hash)\b/i);
  });
});
