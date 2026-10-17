import { pool } from "@/lib/db";

export interface DatabaseBackupResult {
  tables: Record<string, any[]>;
  counts: Record<string, number>;
  sqlDump: string;
}

// Exact topological dependency order (parents before children)
export const BACKUP_TABLES_ORDER = [
  "departments",
  "categories",
  "subcategories",
  "tags",
  "sla_policies",
  "business_hours",
  "users",
  "accounts",
  "system_settings",
  "kb_articles",
  "tickets",
  "ticket_assignees",
  "ticket_tags",
  "ticket_messages",
  "ticket_status_history",
  "ticket_assignment_history",
  "ticket_work_reports",
  "technician_locations",
  "attachments",
  "notifications",
  "audit_logs",
  "sla_events",
] as const;

/**
 * Formats a value safely for an SQL script
 */
function formatSqlValue(val: any): string {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }
  if (typeof val === "number" || typeof val === "bigint") {
    return String(val);
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === "object") {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // String escaping
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Exports all application database tables to structured JSON and standard SQL insert dump.
 */
export async function exportDatabaseData(): Promise<DatabaseBackupResult> {
  const client = await pool.connect();
  try {
    const tables: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    const sqlStatements: string[] = [
      `-- ==========================================================`,
      `-- HELPDESK APPLICATION DATABASE BACKUP (PG DUMP)`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- Note: This file contains all application data (tickets, users, configs)`,
      `-- ==========================================================`,
      `SET statement_timeout = 0;`,
      `SET client_encoding = 'UTF8';`,
      `SET standard_conforming_strings = on;`,
      `BEGIN;`,
      ``,
    ];

    for (const tableName of BACKUP_TABLES_ORDER) {
      try {
        const res = await client.query(`SELECT * FROM "${tableName}"`);
        const rows = res.rows || [];
        tables[tableName] = rows;
        counts[tableName] = rows.length;

        if (rows.length > 0) {
          sqlStatements.push(`-- Data for Table: "${tableName}" (${rows.length} records)`);
          const columns = Object.keys(rows[0]);
          const colsEscaped = columns.map((c) => `"${c}"`).join(", ");

          for (const row of rows) {
            const valuesEscaped = columns.map((c) => formatSqlValue(row[c])).join(", ");
            sqlStatements.push(
              `INSERT INTO "${tableName}" (${colsEscaped}) VALUES (${valuesEscaped}) ON CONFLICT DO NOTHING;`
            );
          }
          sqlStatements.push(``);
        }
      } catch (err: any) {
        // Table might not exist or be empty
        tables[tableName] = [];
        counts[tableName] = 0;
      }
    }

    // Sequence adjustment statement
    sqlStatements.push(
      `-- Synchronize sequences`,
      `SELECT setval('tickets_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM tickets), 1), true);`,
      ``,
      `COMMIT;`,
      `-- Backup completed successfully.`
    );

    return {
      tables,
      counts,
      sqlDump: sqlStatements.join("\n"),
    };
  } finally {
    client.release();
  }
}

/**
 * Gets live statistics of existing database records
 */
export async function getDatabaseSummaryStats(): Promise<{
  counts: Record<string, number>;
  totalTickets: number;
  totalUsers: number;
  totalAttachments: number;
  totalMessages: number;
  totalWorkReports: number;
}> {
  const client = await pool.connect();
  try {
    const counts: Record<string, number> = {};
    for (const tableName of BACKUP_TABLES_ORDER) {
      try {
        const res = await client.query(`SELECT COUNT(*)::int as count FROM "${tableName}"`);
        counts[tableName] = res.rows[0]?.count || 0;
      } catch {
        counts[tableName] = 0;
      }
    }

    return {
      counts,
      totalTickets: counts["tickets"] || 0,
      totalUsers: counts["users"] || 0,
      totalAttachments: counts["attachments"] || 0,
      totalMessages: counts["ticket_messages"] || 0,
      totalWorkReports: counts["ticket_work_reports"] || 0,
    };
  } finally {
    client.release();
  }
}

/**
 * Restores database tables from a structured JSON backup object.
 */
export async function restoreDatabaseData(
  tables: Record<string, any[]>,
  mode: "overwrite" | "merge" = "overwrite"
): Promise<{
  restoredCounts: Record<string, number>;
  errors: string[];
}> {
  const client = await pool.connect();
  const errors: string[] = [];
  const restoredCounts: Record<string, number> = {};

  try {
    await client.query("BEGIN;");

    // In overwrite mode, clean tables in reverse topological order (children first)
    if (mode === "overwrite") {
      const reversedTables = [...BACKUP_TABLES_ORDER].reverse();
      for (const tableName of reversedTables) {
        try {
          await client.query(`DELETE FROM "${tableName}";`);
        } catch (delErr: any) {
          // If foreign key constraint trips, continue and try cascading or defer
        }
      }
    }

    // Insert records in topological order (parents first)
    for (const tableName of BACKUP_TABLES_ORDER) {
      const rows = tables[tableName];
      if (!Array.isArray(rows) || rows.length === 0) {
        restoredCounts[tableName] = 0;
        continue;
      }

      let inserted = 0;
      for (const row of rows) {
        const columns = Object.keys(row).filter((k) => row[k] !== undefined);
        if (columns.length === 0) continue;

        const colsEscaped = columns.map((c) => `"${c}"`).join(", ");
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
        const values = columns.map((c) => row[c]);

        // Construct query depending on mode
        let query = `INSERT INTO "${tableName}" (${colsEscaped}) VALUES (${placeholders})`;

        if (mode === "merge") {
          // In merge mode, do nothing on duplicate primary key conflict
          query += ` ON CONFLICT DO NOTHING`;
        } else {
          // In overwrite mode, if row still exists, update
          const hasId = columns.includes("id");
          if (hasId) {
            const updateSets = columns
              .filter((c) => c !== "id")
              .map((c) => `"${c}" = EXCLUDED."${c}"`)
              .join(", ");
            if (updateSets.length > 0) {
              query += ` ON CONFLICT ("id") DO UPDATE SET ${updateSets}`;
            } else {
              query += ` ON CONFLICT ("id") DO NOTHING`;
            }
          } else {
            query += ` ON CONFLICT DO NOTHING`;
          }
        }

        try {
          await client.query(query, values);
          inserted++;
        } catch (insertErr: any) {
          // Log and continue with other rows
          if (inserted === 0 && errors.length < 5) {
            errors.push(`Gagal menyimpan ke ${tableName}: ${insertErr.message}`);
          }
        }
      }

      restoredCounts[tableName] = inserted;
    }

    // Synchronize serial sequences
    try {
      await client.query(
        `SELECT setval('tickets_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM tickets), 1), true);`
      );
    } catch {}

    await client.query("COMMIT;");
    return { restoredCounts, errors };
  } catch (err: any) {
    await client.query("ROLLBACK;");
    throw new Error(`Gagal memulihkan database: ${err.message}`);
  } finally {
    client.release();
  }
}
