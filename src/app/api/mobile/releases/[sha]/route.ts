import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { releaseDirectory } from "@/lib/mobile-console/apk";
import { promises as fs } from "node:fs";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, context: { params: Promise<{ sha: string }> }) {
  const actor = await getAuthUser(req);
  if (!actor || !["noc", "owner", "admin", "agent"].includes(actor.role)) return new NextResponse(null, { status: 401 });
  const { sha } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(sha)) return new NextResponse(null, { status: 404 });
  const bytes = await fs.readFile(path.join(releaseDirectory, sha + ".apk")).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "APK belum tersedia. Minta pengelola memublikasikan ulang." }, { status: 404 });
  return new NextResponse(bytes, { headers: { "Content-Type": "application/vnd.android.package-archive", "Content-Length": String(bytes.length), "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="helpdesk-teknisi.apk"' } });
}
