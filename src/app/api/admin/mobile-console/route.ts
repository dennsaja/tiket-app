import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { consoleActionSchema } from "@/lib/mobile-console/config";
import { changeMobileConsole, ConsoleConflict, readMobileConsole } from "@/lib/mobile-console/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function operator(req: NextRequest) {
  const identity = await getAuthUser(req);
  if (!identity) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, identity.id) });
  return user?.isActive && !user.deletedAt && ["noc", "owner"].includes(user.role) ? user : null;
}
export async function GET(req: NextRequest) {
  try {
    if (!await operator(req)) return NextResponse.json({ error: "Console hanya tersedia untuk NOC dan Owner." }, { status: 403 });
    return NextResponse.json(await readMobileConsole(), { headers });
  } catch {
    return NextResponse.json({ error: "Console belum dapat dimuat." }, { status: 503, headers });
  }
}
export async function POST(req: NextRequest) {
  try {
    const actor = await operator(req);
    if (!actor) return NextResponse.json({ error: "Console hanya tersedia untuk NOC dan Owner." }, { status: 403 });
    if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Permintaan lintas situs ditolak." }, { status: 403 });
    if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "Gunakan format JSON." }, { status: 415 });
    const limit = rateLimit("mobile_console:" + actor.id, { windowMs: 60000, max: 20 });
    if (!limit.success) return rateLimitResponse(limit.reset);
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Data belum diisi." }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > 8192) { await reader.cancel(); return NextResponse.json({ error: "Data terlalu besar." }, { status: 413 }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
    const parsed = consoleActionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Periksa isian dan batas nilai konfigurasi." }, { status: 422 });
    const state = await changeMobileConsole(parsed.data, actor.name);
    await createAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "settings_updated", targetType: "android_remote_config", targetId: String(state.revision), metadata: { operation: parsed.data.action, version: state.published?.version }, ipAddress: getClientIp(req) });
    return NextResponse.json(state, { headers });
  } catch (error) {
    if (error instanceof ConsoleConflict) return NextResponse.json({ error: error.message }, { status: 409, headers });
    return NextResponse.json({ error: "Perubahan belum tersimpan. Muat ulang console sebelum mencoba lagi." }, { status: 503, headers });
  }
}
