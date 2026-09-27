import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";
import { Pool } from "pg";

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const steps: { step: string; status: "ok" | "error" | "skip"; detail?: string }[] = [];

  const run = async (stepName: string, sql: string) => {
    try {
      await pool.query(sql);
      steps.push({ step: stepName, status: "ok" });
    } catch (err: any) {
      steps.push({ step: stepName, status: "error", detail: err.message });
    }
  };

  // 1. user_role enum values
  await run("user_role enum: add noc, owner", `
    DO $$
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'noc';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
    EXCEPTION
      WHEN duplicate_object THEN null;
      WHEN undefined_object THEN null;
    END $$;
  `);

  // 1b. audit_action enum: add new values
  await run("audit_action enum: add category/subcategory actions", `
    DO $$
    BEGIN
      ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'category_deleted';
      ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'subcategory_created';
      ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'subcategory_updated';
      ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'subcategory_deleted';
    EXCEPTION
      WHEN duplicate_object THEN null;
      WHEN undefined_object THEN null;
    END $$;
  `);

  // 2. ticket_type enum
  await run("Create ticket_type enum", `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN
        CREATE TYPE ticket_type AS ENUM (
          'psb', 'perbaikan_infrastruktur', 'pemasangan_cctv',
          'perbaikan_cctv', 'maintenance'
        );
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // 3. ticket_status enum values
  await run("ticket_status enum: add accepted, on_site", `
    DO $$
    BEGIN
      ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'accepted';
      ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'on_site';
    EXCEPTION
      WHEN duplicate_object THEN null;
      WHEN undefined_object THEN null;
    END $$;
  `);

  // 4. tickets.ticket_type column
  await run("tickets: add ticket_type column", `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = 'ticket_type'
      ) THEN
        ALTER TABLE tickets ADD COLUMN ticket_type ticket_type NOT NULL DEFAULT 'psb';
        CREATE INDEX IF NOT EXISTS tickets_type_idx ON tickets (ticket_type);
      END IF;
    END $$;
  `);

  // 5. tickets.spec_data column
  await run("tickets: add spec_data column", `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = 'spec_data'
      ) THEN
        ALTER TABLE tickets ADD COLUMN spec_data jsonb;
      END IF;
    END $$;
  `);

  // 6. tickets.reporter_phone column
  await run("tickets: add reporter_phone column", `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tickets' AND column_name = 'reporter_phone'
      ) THEN
        ALTER TABLE tickets ADD COLUMN reporter_phone varchar(50);
      END IF;
    END $$;
  `);

  // 7. ticket_assignees table
  await run("Create ticket_assignees table", `
    CREATE TABLE IF NOT EXISTS ticket_assignees (
      id text PRIMARY KEY,
      ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_lead boolean NOT NULL DEFAULT false,
      assigned_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await run("ticket_assignees: create indexes", `
    CREATE UNIQUE INDEX IF NOT EXISTS ticket_assignees_ticket_user_idx ON ticket_assignees (ticket_id, user_id);
    CREATE INDEX IF NOT EXISTS ticket_assignees_ticket_idx ON ticket_assignees (ticket_id);
    CREATE INDEX IF NOT EXISTS ticket_assignees_user_idx ON ticket_assignees (user_id);
  `);

  // 8. ticket_work_reports table
  await run("Create ticket_work_reports table", `
    CREATE TABLE IF NOT EXISTS ticket_work_reports (
      id text PRIMARY KEY,
      ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      technician_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      summary text NOT NULL,
      action_taken text NOT NULL,
      materials_used text,
      final_result text,
      before_photos jsonb DEFAULT '[]'::jsonb,
      after_photos jsonb DEFAULT '[]'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await run("ticket_work_reports: create indexes", `
    CREATE INDEX IF NOT EXISTS ticket_work_reports_ticket_idx ON ticket_work_reports (ticket_id);
    CREATE INDEX IF NOT EXISTS ticket_work_reports_technician_idx ON ticket_work_reports (technician_id);
    CREATE INDEX IF NOT EXISTS ticket_work_reports_created_at_idx ON ticket_work_reports (created_at);
  `);

  await pool.end();
  return steps;
}

// GET — dry run: check migration status
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const checks = await Promise.allSettled([
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_type'`),
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'spec_data'`),
      pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'reporter_phone'`),
      pool.query(`SELECT to_regclass('ticket_assignees')`),
      pool.query(`SELECT to_regclass('ticket_work_reports')`),
      pool.query(`SELECT typname FROM pg_type WHERE typname = 'ticket_type'`),
    ]);

    await pool.end();

    const labels = [
      "tickets.ticket_type column",
      "tickets.spec_data column",
      "tickets.reporter_phone column",
      "ticket_assignees table",
      "ticket_work_reports table",
      "ticket_type enum",
    ];

    const statuses = checks.map((c, i) => {
      if (c.status === "rejected") return { label: labels[i], exists: false, error: (c as any).reason?.message };
      const rows = (c as any).value?.rows ?? [];
      const exists = rows.length > 0 && rows[0][Object.keys(rows[0])[0]] !== null;
      return { label: labels[i], exists };
    });

    const needsMigration = statuses.some((s) => !s.exists);

    return NextResponse.json({ needsMigration, statuses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — run all pending migrations
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (!["noc", "owner"].includes(userRole)) {
    return errorResponse("Forbidden", 403);
  }

  try {
    const steps = await runMigration();
    const hasErrors = steps.some((s) => s.status === "error");

    return NextResponse.json({
      success: !hasErrors,
      steps,
      message: hasErrors
        ? "Beberapa langkah migrasi gagal. Periksa detail di bawah."
        : "Semua migrasi berhasil dijalankan!",
    });
  } catch (err: any) {
    console.error("[Migrate] Failed:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
