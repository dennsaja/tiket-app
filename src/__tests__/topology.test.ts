import { describe, expect, it } from "vitest";
import { topologyFromRows, topologyGeoJson, upstreamLinks, type TopologyRow } from "@/lib/map/topology";
import { trackingStyle, SATELLITE_NATIVE_ZOOM } from "@/lib/map/styles";
import { readSqliteTopology } from "@/lib/map/topology-store";
import initSqlJs from "sql.js";
import fs from "node:fs/promises";

const row = (id: string, type: string, parent: unknown = null, extra: object = {}): TopologyRow => ({ id, type, name: "Titik " + id, coordinates: "[-6.76,110.85]", data: JSON.stringify({ parent, ...extra }) });
describe("network topology", () => {
  it("converts stored latitude/longitude to GeoJSON and discards sensitive device attributes", () => {
    const snapshot = topologyFromRows([row("a", "server", null, { login: { password: "private-router-password" }, billing: "billing-private", ip: "private-ip", credentials: "private-pppoe" })]);
    expect(snapshot.nodes[0].coordinates).toEqual([110.85, -6.76]);
    const serialized = JSON.stringify(topologyGeoJson(snapshot));
    for (const value of ["private-router-password", "billing-private", "private-ip", "private-pppoe", "credentials", "login"]) expect(serialized).not.toContain(value);
  });
  it("preserves multiple parent links and skips dangling references", () => {
    const rows = [row("a", "server"), { ...row("b", "router"), coordinates: "[-6.761,110.851]" }, { ...row("c", "odp", ["a", "b", "missing"]), coordinates: "[-6.762,110.852]" }];
    const snapshot = topologyFromRows(rows);
    expect(snapshot.links.map(link => link.from)).toEqual(["a", "b"]);
    expect(snapshot.nodes[2].parentIds).toEqual(["a", "b"]);
    expect(snapshot.skipped).toBe(1);
  });
  it("preserves drawn bends and reverses a child-to-parent cable path", () => {
    const snapshot = topologyFromRows([row("a", "server"), { ...row("b", "client", "a", { cable_path: [[-6.762, 110.852], [-6.761, 110.85], [-6.76, 110.85]] }), coordinates: "[-6.762,110.852]" }]);
    expect(snapshot.links[0].traced).toBe(true);
    expect(snapshot.links[0].coordinates).toEqual([[110.85, -6.76], [110.85, -6.761], [110.852, -6.762]]);
    expect(snapshot.nodes[1].kind).toBe("customer");
  });
  it("labels absent or corrupt cable geometry as schematic rather than a measured path", () => {
    const snapshot = topologyFromRows([row("a", "server"), { ...row("b", "odp", "a", { cable_path: [[999, 999]] }), coordinates: "[-6.761,110.851]" }]);
    expect(snapshot.links[0].traced).toBe(false);
    expect(snapshot.links[0].coordinates).toHaveLength(2);
  });
  it("rejects invalid coordinates and unknown point types without inventing locations", () => {
    const snapshot = topologyFromRows([{ ...row("zero", "client"), coordinates: "[0,0]" }, { ...row("bad", "odp"), coordinates: "[110,-6]" }, row("other", "unsupported")]);
    expect(snapshot.nodes).toHaveLength(0); expect(snapshot.bounds).toBeNull(); expect(snapshot.skipped).toBe(3);
  });
  it("traces upstream connections safely even when network links form a loop", () => {
    const snapshot = topologyFromRows([row("a", "server", "b"), { ...row("b", "router", "a"), coordinates: "[-6.761,110.851]" }]);
    expect(upstreamLinks(snapshot, "b").size).toBe(2);
  });
  it("keeps satellite imagery visible above its native zoom instead of fetching missing tiles", () => {
    const style = trackingStyle("satellite", false) as any;
    expect(style.sources.imagery.maxzoom).toBe(SATELLITE_NATIVE_ZOOM);
    expect(style.layers[0].maxzoom).toBeUndefined();
    expect(style.sources.imagery.tiles[0]).toContain("{z}/{y}/{x}");
  });
  it("reads an actual SQLite nodes table while excluding credentials from the saved snapshot", async () => {
    const SQL = await initSqlJs({ wasmBinary: new Uint8Array(await fs.readFile("node_modules/sql.js/dist/sql-wasm.wasm")).buffer });
    const database = new SQL.Database();
    try {
      database.run("CREATE TABLE nodes(id TEXT,type TEXT,name TEXT,coordinates TEXT,parent_id TEXT,data TEXT)");
      database.run("INSERT INTO nodes VALUES (?,?,?,?,?,?)", ["r", "router", "Router", "[-6.76,110.85]", null, JSON.stringify({ login: { password: "sensitive-value" } })]);
      const snapshot = await readSqliteTopology(database.export());
      expect(snapshot.nodes).toHaveLength(1); expect(JSON.stringify(snapshot)).not.toContain("sensitive-value");
    } finally { database.close(); }
  }, 30000);
});
