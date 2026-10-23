import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { defaultMobileConfig } from "@/lib/mobile-console/config";
import { readMobileConsole } from "@/lib/mobile-console/store";
import apkRelease from "../../../../../public/downloads/version.json";
import { z } from "zod";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const actor = await getAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (!["noc", "owner", "admin", "agent"].includes(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const { published } = await readMobileConsole();
    // Never expose a draft, publication history, or operator identity to devices.
    return NextResponse.json({ schemaVersion: 1, minAppVersionCode: 12, version: published?.version ?? 0,
      note: published?.note ?? "", publishedAt: published?.publishedAt ?? null,
      apk: { versionCode: apkRelease.versionCode, versionName: apkRelease.versionName, releaseNotes: apkRelease.releaseNotes, downloadPath: "/download" },
      config: published?.config ?? defaultMobileConfig }, { headers });
  } catch {
    // A failure must retain the device's last good configuration, not reset it.
    return NextResponse.json({ error: "Konfigurasi belum dapat dimuat." }, { status: 503, headers });
  }
}

const receiptSchema = z.object({ version: z.number().int().nonnegative(), appVersionCode: z.number().int().min(12).max(1000000), appVersion: z.string().regex(/^\d+\.\d+\.\d+$/).max(24) }).strict();
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const actor = await getAuthUser(req);
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (!["noc", "owner", "admin", "agent"].includes(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const limit = rateLimit("mobile_config_ack:" + actor.id, { windowMs: 60000, max: 20 });
    if (!limit.success) return rateLimitResponse(limit.reset);
    if (Number(req.headers.get("content-length")) > 1024) return NextResponse.json({ error: "Data terlalu besar" }, { status: 413 });
    const parsed = receiptSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Data tidak valid" }, { status: 422 });
    const { published, history } = await readMobileConsole();
    if (parsed.data.version !== 0 && parsed.data.version !== published?.version && !history.some(item => item.version === parsed.data.version)) return NextResponse.json({ error: "Konfigurasi sudah berubah, periksa ulang." }, { status: 409 });
    const receipt = { ...parsed.data, name: actor.name, userId: actor.id, appliedAt: new Date().toISOString() };
    const key = "android_config_receipt:" + actor.id;
    await db.insert(systemSettings).values({ key, value: JSON.stringify(receipt) }).onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(receipt), updatedAt: new Date() } });
    return NextResponse.json({ success: true }, { headers });
  } catch { return NextResponse.json({ error: "Status penerimaan belum tersimpan." }, { status: 503, headers }); }
}
