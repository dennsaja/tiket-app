#!/usr/bin/env bash
# ============================================================
# HelpDesk DB Migration Script
# Jalankan manual di server: bash scripts/migrate.sh
# ============================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL tidak ditemukan di .env.local"
  exit 1
fi

echo "🔧 Menjalankan migrasi database HelpDesk..."
echo "   Direktori: $APP_DIR"
echo ""

run_sql() {
  local STEP="$1"
  local SQL="$2"
  echo -n "  [$STEP] ... "
  if psql "$DATABASE_URL" -c "$SQL" > /dev/null 2>&1; then
    echo "✅ OK"
  else
    # Try to show actual error
    ERR=$(psql "$DATABASE_URL" -c "$SQL" 2>&1 || true)
    echo "⚠️  WARN: $ERR"
  fi
}

# 1. user_role enum
run_sql "user_role enum" "DO \$\$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'noc'; ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner'; EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END \$\$;"

# 2. ticket_type enum
run_sql "ticket_type enum" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN CREATE TYPE ticket_type AS ENUM ('psb', 'perbaikan_infrastruktur', 'pemasangan_cctv', 'perbaikan_cctv', 'maintenance'); END IF; EXCEPTION WHEN duplicate_object THEN null; END \$\$;"

# 3. ticket_status enum
run_sql "ticket_status enum" "DO \$\$ BEGIN ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'accepted'; ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'on_site'; EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END \$\$;"

# 4. tickets.ticket_type column
run_sql "tickets.ticket_type" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_type') THEN ALTER TABLE tickets ADD COLUMN ticket_type ticket_type NOT NULL DEFAULT 'psb'; CREATE INDEX IF NOT EXISTS tickets_type_idx ON tickets (ticket_type); END IF; END \$\$;"

# 5. tickets.spec_data column
run_sql "tickets.spec_data" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'spec_data') THEN ALTER TABLE tickets ADD COLUMN spec_data jsonb; END IF; END \$\$;"

# 6. tickets.reporter_phone column
run_sql "tickets.reporter_phone" "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'reporter_phone') THEN ALTER TABLE tickets ADD COLUMN reporter_phone varchar(50); END IF; END \$\$;"

# 7. ticket_assignees table
run_sql "ticket_assignees table" "CREATE TABLE IF NOT EXISTS ticket_assignees (id text PRIMARY KEY, ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, is_lead boolean NOT NULL DEFAULT false, assigned_at timestamp NOT NULL DEFAULT now());"

run_sql "ticket_assignees indexes" "CREATE UNIQUE INDEX IF NOT EXISTS ticket_assignees_ticket_user_idx ON ticket_assignees (ticket_id, user_id); CREATE INDEX IF NOT EXISTS ticket_assignees_ticket_idx ON ticket_assignees (ticket_id); CREATE INDEX IF NOT EXISTS ticket_assignees_user_idx ON ticket_assignees (user_id);"

# 8. ticket_work_reports table
run_sql "ticket_work_reports table" "CREATE TABLE IF NOT EXISTS ticket_work_reports (id text PRIMARY KEY, ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE, technician_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT, summary text NOT NULL, action_taken text NOT NULL, materials_used text, final_result text, before_photos jsonb DEFAULT '[]'::jsonb, after_photos jsonb DEFAULT '[]'::jsonb, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());"

run_sql "ticket_work_reports indexes" "CREATE INDEX IF NOT EXISTS ticket_work_reports_ticket_idx ON ticket_work_reports (ticket_id); CREATE INDEX IF NOT EXISTS ticket_work_reports_technician_idx ON ticket_work_reports (technician_id); CREATE INDEX IF NOT EXISTS ticket_work_reports_created_at_idx ON ticket_work_reports (created_at);"

echo ""
echo "✅ Migrasi selesai!"
echo ""
echo "👉 Restart service agar perubahan aktif:"
echo "   systemctl restart helpdesk"
echo "   atau: pm2 restart helpdesk"
