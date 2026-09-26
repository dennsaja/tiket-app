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
  colorClass = "text-indigo-600 bg-indigo-50",
}: StatCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up"
      ? "text-green-600"
      : trend === "down"
      ? "text-red-600"
      : "text-gray-500";

  const isPositiveChange = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "rounded-md border border-gray-200 bg-white p-4",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              colorClass
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {change !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-medium",
              isPositiveChange ? "text-green-600" : "text-red-600"
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
          <span className="text-xs text-gray-500">{changeLabel}</span>
        )}
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
