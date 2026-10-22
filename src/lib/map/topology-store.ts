import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import initSqlJs from "sql.js";
import { emptyTopology, topologyFromRows, type TopologyRow, type TopologySnapshot } from "./topology";

export const MAX_TOPOLOGY_BYTES = 10 * 1024 * 1024;
const destination = () => process.env.TOPOLOGY_DATA_FILE || path.join(process.cwd(), "uploads", "topology", "network.json");
let engine: ReturnType<typeof initSqlJs> | undefined;

export async function readSqliteTopology(bytes: Uint8Array): Promise<TopologySnapshot> {
  if (bytes.byteLength > MAX_TOPOLOGY_BYTES) throw new Error("Ukuran topologi maksimal 10 MB.");
  if (Buffer.from(bytes.subarray(0, 16)).toString("binary") !== "SQLite format 3\u0000") throw new Error("Pilih database topologi SQLite yang valid (.db).");
  engine ??= initSqlJs({ wasmBinary: new Uint8Array(await fs.readFile(path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"))).buffer });
  const SQL = await engine;
  const database = new SQL.Database(bytes);
  try {
    database.run("PRAGMA query_only = ON");
    if (!database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'")[0]?.values.length) throw new Error("Tabel nodes tidak ditemukan dalam database.");
    const query = database.exec("SELECT id,type,name,coordinates,parent_id,data FROM nodes LIMIT 10001")[0];
    const rows = query?.values.map(values => Object.fromEntries(query.columns.map((key, index) => [key, values[index]])) as unknown as TopologyRow) || [];
    const snapshot = topologyFromRows(rows);
    if (!snapshot.nodes.length) throw new Error("Database tidak memiliki titik dengan koordinat yang valid.");
    return snapshot;
  } finally { database.close(); }
}

export async function readTopology(): Promise<TopologySnapshot> {
  try { return JSON.parse(await fs.readFile(destination(), "utf8")); }
  catch (error: any) { if (error.code === "ENOENT") return emptyTopology(); throw error; }
}
export async function saveTopology(topology: TopologySnapshot) {
  const file = destination();
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + "." + randomUUID() + ".tmp";
  try { await fs.writeFile(temporary, JSON.stringify(topology), { mode: 0o600 }); await fs.rename(temporary, file); }
  finally { await fs.unlink(temporary).catch(() => {}); }
}
