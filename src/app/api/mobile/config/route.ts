import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { defaultMobileConfig } from "@/lib/mobile-console/config";
import { readMobileConsole } from "@/lib/mobile-console/store";

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
      config: published?.config ?? defaultMobileConfig }, { headers });
  } catch {
    // A failure must retain the device's last good configuration, not reset it.
    return NextResponse.json({ error: "Konfigurasi belum dapat dimuat." }, { status: 503, headers });
  }
}
