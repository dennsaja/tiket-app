"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DashboardPeriod } from "@/lib/utils/dashboard";

export function PeriodSelect({ days }: { days: DashboardPeriod }) {
  const router = useRouter();
  return <div className="period-select">
    <CalendarDays className="h-4 w-4" aria-hidden="true" />
    <select aria-label="Periode dashboard" value={days} onChange={(event) => router.push("/dashboard?days=" + event.target.value)}>
      <option value={7}>7 hari terakhir</option>
      <option value={14}>14 hari terakhir</option>
      <option value={30}>30 hari terakhir</option>
    </select>
    <ChevronDown className="h-4 w-4 pointer-events-none" aria-hidden="true" />
  </div>;
}
