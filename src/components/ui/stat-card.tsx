import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  description?: string;
  className?: string;
  colorClass?: string;
}

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  description,
  className,
  colorClass = "text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800",
}: StatCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const isPositiveChange = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4.5 shadow-xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200/50 dark:border-zinc-700/50",
              colorClass
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(change !== undefined || description || changeLabel) && (
        <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-900">
          {change !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium font-mono",
                isPositiveChange ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(change)}%
            </span>
          )}
          {changeLabel && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{changeLabel}</span>
          )}
          {description && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
