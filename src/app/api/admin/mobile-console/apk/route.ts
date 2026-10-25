import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { availableApk, publishedApk, pushApk, apkReceipts } from "@/lib/mobile-console/apk";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAuditLog, getClientIp } from "@/lib/audit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor || !["noc", "owner"].includes(actor.role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const [available, published, receipts] = await Promise.all([availableApk(), publishedApk(), apkReceipts()]);
  return NextResponse.json({ available, published, receipts }, { headers });
}
export async function POST(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor || !["noc", "owner"].includes(actor.role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const limit = rateLimit("apk_push:" + actor.id, { windowMs: 60000, max: 5 });
  if (!limit.success) return rateLimitResponse(limit.reset);
  try {
    const release = await pushApk();
    await createAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "settings_updated", targetType: "android_apk", targetId: release.revision, metadata: { versionCode: release.versionCode, sha256: release.sha256 }, ipAddress: getClientIp(req) });
    return NextResponse.json(release, { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "APK belum dapat dipublikasikan" }, { status: 409, headers }); }
}
