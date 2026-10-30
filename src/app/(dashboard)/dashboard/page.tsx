import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getWebPageData } from "@/lib/web-data/client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ringkasan" };
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string | string[] }> }) {
  const params = await searchParams;
  const data = await getWebPageData("dashboard", { days: Array.isArray(params.days) ? params.days[0] : params.days || "" });
  return <DashboardOverview {...data} />;
}
