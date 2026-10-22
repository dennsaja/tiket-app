export type NetworkKind = "server" | "router" | "odp" | "customer";
export type LngLat = [number, number];
export interface NetworkNode {
  id: string;
  kind: NetworkKind;
  name: string;
  coordinates: LngLat;
  parentIds: string[];
}
export interface NetworkLink {
  id: string;
  from: string;
  to: string;
  kind: NetworkKind;
  coordinates: LngLat[];
  traced: boolean;
}
export interface TopologySnapshot {
  version: 1;
  importedAt: string | null;
  nodes: NetworkNode[];
  links: NetworkLink[];
  bounds: [number, number, number, number] | null;
  skipped: number;
}
export interface TopologyRow { id: unknown; type: unknown; name: unknown; coordinates: unknown; parent_id?: unknown; data?: unknown }
export const NETWORK_LABELS: Record<NetworkKind, string> = { server: "Server", router: "MikroTik / router", odp: "ODP", customer: "Pelanggan" };
export const NETWORK_COLORS: Record<NetworkKind, string> = { server: "#0ea5e9", router: "#8b5cf6", odp: "#f59e0b", customer: "#10b981" };
export const emptyTopology = (): TopologySnapshot => ({ version: 1, importedAt: null, nodes: [], links: [], bounds: null, skipped: 0 });

function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
}
export function validPosition(position: unknown): position is LngLat {
  return Array.isArray(position) && position.length === 2 && position.every(Number.isFinite) && Math.abs(position[0]) <= 180 && Math.abs(position[1]) <= 90 && !(position[0] === 0 && position[1] === 0);
}
// The supplied SQLite file stores [latitude, longitude]; GeoJSON uses the reverse order.
function fromLatLng(value: unknown): LngLat | null {
  const pair = json(value);
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  const position: LngLat = [pair[1], pair[0]];
  return validPosition(position) ? position : null;
}
const same = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8;
const squareDistance = (a: LngLat, b: LngLat) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

/** Whitelist geometry and labels only. Never serialize raw node.data into the snapshot. */
export function topologyFromRows(rows: TopologyRow[], importedAt = new Date().toISOString()): TopologySnapshot {
  if (rows.length > 10000) throw new Error("Topologi maksimal 10.000 titik.");
  const result = emptyTopology(); result.importedAt = importedAt;
  const raw = new Map<string, Record<string, unknown>>();
  const ids = new Set<string>();
  for (const row of rows) {
    const id = text(row.id, 128);
    const kind = row.type === "client" ? "customer" : row.type;
    const coordinates = fromLatLng(row.coordinates);
    if (!id || ids.has(id) || !["server", "router", "odp", "customer"].includes(kind as string) || !coordinates) { result.skipped++; continue; }
    const parsed = json(row.data);
    const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    const parents = [...(Array.isArray(data.parent) ? data.parent : [data.parent]), row.parent_id];
    const parentIds = [...new Set(parents.map(p => text(p, 128)).filter(p => p && p !== id))];
    result.nodes.push({ id, kind: kind as NetworkKind, name: text(row.name, 160) || NETWORK_LABELS[kind as NetworkKind], coordinates, parentIds });
    raw.set(id, data); ids.add(id);
  }
  const nodes = new Map(result.nodes.map(n => [n.id, n]));
  for (const child of result.nodes) {
    const data = raw.get(child.id)!;
    const path = json(data.cable_path);
    const converted = Array.isArray(path) && path.length <= 10000 ? path.map(fromLatLng) : [];
    const usable = converted.length > 0 && converted.every(p => p !== null);
    for (const parentId of child.parentIds) {
      const parent = nodes.get(parentId);
      if (!parent) { result.skipped++; continue; }
      // A shared cable_path cannot describe two different uplinks accurately.
      const traced = usable && child.parentIds.length === 1;
      let interior: LngLat[] = traced ? converted as LngLat[] : [];
      if (interior.length > 1 && squareDistance(interior[0], parent.coordinates) > squareDistance(interior.at(-1)!, parent.coordinates)) interior = [...interior].reverse();
      const coordinates = [parent.coordinates, ...interior, child.coordinates].filter((p, i, all) => i === 0 || !same(p, all[i - 1]));
      if (coordinates.length < 2) { result.skipped++; continue; }
      result.links.push({ id: JSON.stringify([parentId, child.id]), from: parentId, to: child.id, kind: child.kind, coordinates, traced: Boolean(traced) });
    }
    child.parentIds = child.parentIds.filter(id => nodes.has(id));
  }
  if (result.nodes.length) result.bounds = result.nodes.reduce<[number, number, number, number]>((b, n) => [Math.min(b[0], n.coordinates[0]), Math.min(b[1], n.coordinates[1]), Math.max(b[2], n.coordinates[0]), Math.max(b[3], n.coordinates[1])], [180, 90, -180, -90]);
  return result;
}

export function upstreamLinks(topology: TopologySnapshot, nodeId: string): Set<string> {
  const byChild = new Map<string, NetworkLink[]>();
  for (const link of topology.links) byChild.set(link.to, [...(byChild.get(link.to) || []), link]);
  const visited = new Set<string>(), links = new Set<string>(), queue = [nodeId];
  while (queue.length) {
    const id = queue.pop()!; if (visited.has(id)) continue; visited.add(id);
    for (const link of byChild.get(id) || []) { links.add(link.id); queue.push(link.from); }
  }
  return links;
}

export function topologyGeoJson(topology: TopologySnapshot) {
  return {
    points: { type: "FeatureCollection", features: topology.nodes.map(node => ({ type: "Feature", id: node.id, properties: { id: node.id, kind: node.kind, name: node.name }, geometry: { type: "Point", coordinates: node.coordinates } })) },
    lines: { type: "FeatureCollection", features: topology.links.map(link => ({ type: "Feature", id: link.id, properties: { id: link.id, from: link.from, to: link.to, kind: link.kind, traced: link.traced }, geometry: { type: "LineString", coordinates: link.coordinates } })) },
  };
}
