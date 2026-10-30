import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { dashboardData, ticketPageData, knowledgeData } from "@/lib/web-data/queries";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const actor = await getAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { resource } = await context.params;
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const data = resource === "dashboard" ? await dashboardData(actor, params) : resource === "tickets" ? await ticketPageData(actor, params) : resource === "knowledge" ? await knowledgeData() : null;
  if (!data) return new NextResponse(null, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
