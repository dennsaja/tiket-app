import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  featured?: boolean;
  href?: string;
  badge?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  className?: string;
}

function StatCard({ title, value, description, icon, featured, href, badge, tone = "neutral", className }: StatCardProps) {
  const content = <>
    <div className="metric-heading"><h2>{title}</h2><span className="metric-arrow"><ArrowUpRight className="h-[18px] w-[18px]" /></span></div>
    <div className="metric-value"><strong>{typeof value === "number" ? value.toLocaleString("id-ID") : value}</strong>{badge && <span className={cn("metric-badge", "tone-" + tone)}>{tone === "success" ? <TrendingUp className="h-3 w-3" /> : tone === "danger" ? <TrendingDown className="h-3 w-3" /> : null}{badge}</span>}</div>
    <p className="metric-description">{icon}{description}</p>
  </>;
  const classes = cn("metric-card", featured && "is-featured", className);
  return href ? <Link href={href} className={classes}>{content}</Link> : <div className={classes}>{content}</div>;
}
export { StatCard };
export type { StatCardProps };
