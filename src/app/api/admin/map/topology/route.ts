import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { MAX_TOPOLOGY_BYTES, readSqliteTopology, readTopology, saveTopology } from "@/lib/map/topology-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const permitted = (role: string) => ["noc", "owner", "admin"].includes(role);
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permitted(actor.role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  return NextResponse.json(await readTopology(), { headers });
}
export async function POST(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!permitted(actor.role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const limit = rateLimit("topology_import:" + actor.id, { windowMs: 60000, max: 4 });
  if (!limit.success) return rateLimitResponse(limit.reset);
  const maxBody = MAX_TOPOLOGY_BYTES + 65536;
  if (Number(req.headers.get("content-length")) > maxBody) return NextResponse.json({ error: "Ukuran topologi maksimal 10 MB." }, { status: 413 });
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Berkas topologi belum dipilih.");
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        total += part.value.byteLength;
        if (total > maxBody) { await reader.cancel(); return NextResponse.json({ error: "Ukuran topologi maksimal 10 MB." }, { status: 413 }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": req.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Pilih database topology.db.");
    const snapshot = await readSqliteTopology(new Uint8Array(await file.arrayBuffer()));
    await saveTopology(snapshot);
    await createAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "settings_updated", targetType: "network_topology", targetId: "tracking_map", metadata: { nodes: snapshot.nodes.length, links: snapshot.links.length, skipped: snapshot.skipped }, ipAddress: getClientIp(req) });
    return NextResponse.json(snapshot, { headers });
  } catch (error: any) {
    const safeMessages = ["Ukuran topologi", "Pilih database", "Tabel nodes", "Database tidak", "Topologi maksimal", "Berkas topologi"];
    return NextResponse.json({ error: safeMessages.some(prefix => String(error.message).startsWith(prefix)) ? error.message : "Database topologi tidak dapat dibaca. Gunakan salinan SQLite yang valid." }, { status: 422 });
  }
}
