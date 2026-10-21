"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ActivityPoint { date: string; label: string; count: number }

export function TicketActivityChart({ data }: { data: ActivityPoint[] }) {
  const gradientId = useId().replace(/:/g, "");
  const hasData = data.some((point) => point.count > 0);
  return <div className="activity-chart">
    {hasData ? <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 24, right: 4, left: -24, bottom: 0 }} accessibilityLayer>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#839aff" /><stop offset="100%" stopColor="#4162fa" /></linearGradient></defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} dy={12} minTickGap={22} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
        <Tooltip cursor={{ fill: "var(--surface-hover)", radius: 12 }} content={({ active, payload }) => {
          const point = payload?.[0]?.payload as ActivityPoint | undefined;
          return active && point ? <div className="chart-tooltip"><span>{point.label}</span><strong>{point.count} tiket masuk</strong></div> : null;
        }} />
        <Bar name="Tiket masuk" dataKey="count" fill={"url(#" + gradientId + ")"} radius={[12, 12, 12, 12]} maxBarSize={42} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer> : <div className="chart-empty"><span className="chart-empty-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span><strong>Belum ada aktivitas tiket</strong><span>Tiket masuk pada periode ini akan tampil di sini.</span></div>}
    <details className="chart-data-table">
      <summary>Lihat data grafik</summary>
      <table><caption>Tiket masuk per hari (WIB)</caption><thead><tr><th scope="col">Tanggal</th><th scope="col">Jumlah tiket</th></tr></thead><tbody>{data.map((point) => <tr key={point.date}><td>{point.label}</td><td>{point.count}</td></tr>)}</tbody></table>
    </details>
  </div>;
}
