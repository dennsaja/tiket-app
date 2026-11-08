import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { dashboardData, ticketPageData, knowledgeData } from "./queries";
type PageData = { dashboard: Awaited<ReturnType<typeof dashboardData>>; tickets: Awaited<ReturnType<typeof ticketPageData>>; knowledge: Awaited<ReturnType<typeof knowledgeData>> };
export async function getWebPageData<R extends keyof PageData>(resource: R, params: Record<string, string> = {}): Promise<PageData[R]> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const actor = { id: session.user.id, name: session.user.name, role: (session.user as any).role };
  const queries = await import("./queries");
  if (resource === "dashboard") return await queries.dashboardData(actor, params) as PageData[R];
  if (resource === "tickets") return await queries.ticketPageData(actor, params) as PageData[R];
  return await queries.knowledgeData() as PageData[R];
}
