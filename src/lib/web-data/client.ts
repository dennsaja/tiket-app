import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { backendOrigin } from "@/lib/network/server";
import type { dashboardData, ticketPageData, knowledgeData } from "./queries";
type PageData = { dashboard: Awaited<ReturnType<typeof dashboardData>>; tickets: Awaited<ReturnType<typeof ticketPageData>>; knowledge: Awaited<ReturnType<typeof knowledgeData>> };
export async function getWebPageData<R extends keyof PageData>(resource: R, params: Record<string, string> = {}): Promise<PageData[R]> {
  if (process.env.APP_SERVICE === "frontend") {
    const incoming = await headers();
    const response = await fetch(backendOrigin() + "/api/web/" + resource + "?" + new URLSearchParams(params), { headers: { cookie: incoming.get("cookie") || "" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (response.status === 401) redirect("/login");
    if (!response.ok) throw new Error("Backend data unavailable: " + response.status);
    return JSON.parse(await response.text(), (key, value) => /(?:At|Due)$/.test(key) && typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(value) : value);
  }
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const actor = { id: session.user.id, name: session.user.name, role: (session.user as any).role };
  const queries = await import("./queries");
  if (resource === "dashboard") return await queries.dashboardData(actor, params) as PageData[R];
  if (resource === "tickets") return await queries.ticketPageData(actor, params) as PageData[R];
  return await queries.knowledgeData() as PageData[R];
}
