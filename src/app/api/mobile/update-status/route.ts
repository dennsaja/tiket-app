import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { publishedApk } from "@/lib/mobile-console/apk";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
const schema = z.object({ revision: z.string().uuid(), versionCode: z.number().int().positive(), installedVersionCode: z.number().int().positive(), phase: z.enum(["offered", "downloading", "verified", "installing", "installed", "failed", "cancelled"]), message: z.string().max(300).optional() }).strict();
export async function POST(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor || !["noc", "owner", "admin", "agent"].includes(actor.role)) return new NextResponse(null, { status: 401 });
  const limit = rateLimit("apk_status:" + actor.id, { windowMs: 60000, max: 30 });
  if (!limit.success) return rateLimitResponse(limit.reset);
  if (Number(req.headers.get("content-length")) > 2048) return new NextResponse(null, { status: 413 });
  const data = schema.safeParse(await req.json().catch(() => null));
  const release = await publishedApk();
  if (!data.success || !release || data.data.revision !== release.revision || data.data.versionCode !== release.versionCode) return new NextResponse(null, { status: 409 });
  if (data.data.phase === "installed" && data.data.installedVersionCode < release.versionCode) return new NextResponse(null, { status: 422 });
  const key = "android_apk_receipt:" + actor.id;
  const value = JSON.stringify({ ...data.data, name: actor.name, userId: actor.id, updatedAt: new Date().toISOString() });
  await db.insert(systemSettings).values({ key, value }).onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
  return NextResponse.json({ success: true });
}
