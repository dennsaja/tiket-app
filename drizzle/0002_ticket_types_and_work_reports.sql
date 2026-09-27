-- Step 1: Create ticket_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN
    CREATE TYPE ticket_type AS ENUM ('psb', 'perbaikan_infrastruktur', 'pemasangan_cctv', 'perbaikan_cctv', 'maintenance');
  END IF;
END $$;

-- Step 2: Add values to ticket_status enum if not exists
DO $$
BEGIN
  ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'accepted';
  ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'on_site';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Add columns to tickets table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_type') THEN
    ALTER TABLE tickets ADD COLUMN ticket_type ticket_type NOT NULL DEFAULT 'psb';
    CREATE INDEX IF NOT EXISTS tickets_type_idx ON tickets (ticket_type);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'spec_data') THEN
    ALTER TABLE tickets ADD COLUMN spec_data jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'reporter_phone') THEN
    ALTER TABLE tickets ADD COLUMN reporter_phone varchar(50);
  END IF;
END $$;

-- Step 4: Create ticket_assignees table
CREATE TABLE IF NOT EXISTS ticket_assignees (
  id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  assigned_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_assignees_ticket_user_idx ON ticket_assignees (ticket_id, user_id);
CREATE INDEX IF NOT EXISTS ticket_assignees_ticket_idx ON ticket_assignees (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_assignees_user_idx ON ticket_assignees (user_id);

-- Step 5: Create ticket_work_reports table
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

CREATE INDEX IF NOT EXISTS ticket_work_reports_ticket_idx ON ticket_work_reports (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_work_reports_technician_idx ON ticket_work_reports (technician_id);
CREATE INDEX IF NOT EXISTS ticket_work_reports_created_at_idx ON ticket_work_reports (created_at);
