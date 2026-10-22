import fs from "node:fs/promises";
import dotenv from "dotenv";
import { readSqliteTopology, saveTopology } from "../src/lib/map/topology-store";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/import-topology.ts /private/path/topology.db");
  const snapshot = await readSqliteTopology(await fs.readFile(file));
  await saveTopology(snapshot);
  console.log(JSON.stringify({ nodes: snapshot.nodes.length, links: snapshot.links.length, traced: snapshot.links.filter(link => link.traced).length, skipped: snapshot.skipped }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
