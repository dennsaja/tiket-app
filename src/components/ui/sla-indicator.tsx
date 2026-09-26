import * as React from "react";
import { cn } from "@/lib/utils";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

type SlaStatus = "ok" | "warning" | "breached" | "completed" | "na";

interface SlaIndicatorProps {
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  label?: string;
  className?: string;
  compact?: boolean;
}

function getSlaStatus(
  dueAt: Date,
  completedAt?: Date | null
): { status: SlaStatus; remaining: string; percent: number } {
  const now = completedAt ? new Date(completedAt) : new Date();
  const due = new Date(dueAt);
  const remainingMinutes = differenceInMinutes(due, now);

  if (completedAt) {
    const wasOnTime = new Date(completedAt) <= due;
    return {
      status: wasOnTime ? "completed" : "breached",
      remaining: wasOnTime ? "Selesai tepat waktu" : "Selesai terlambat",
      percent: 100,
    };
  }

  if (remainingMinutes < 0) {
    const overdue = Math.abs(remainingMinutes);
    const h = Math.floor(overdue / 60);
    const m = overdue % 60;
    return {
      status: "breached",
      remaining: h > 0 ? `Terlewat ${h}j ${m}m` : `Terlewat ${m}m`,
      percent: 100,
    };
  }

  const h = Math.floor(remainingMinutes / 60);
  const m = remainingMinutes % 60;
  const remaining = h > 0 ? `${h}j ${m}m` : `${m}m`;

  const baseMinutes = 24 * 60;
  const used = baseMinutes - remainingMinutes;
  const percent = Math.min(Math.max((used / baseMinutes) * 100, 0), 100);

  const status: SlaStatus = remainingMinutes < 60 ? "warning" : "ok";
  return { status, remaining, percent };
}

function SlaIndicator({
  dueAt,
  completedAt,
  label,
  className,
  compact = false,
}: SlaIndicatorProps) {
  if (!dueAt) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-zinc-400 font-mono", className)}>
        <Clock className="h-3 w-3" />
        <span>Tanpa SLA</span>
      </div>
    );
  }

  const due = new Date(dueAt);
  const completed = completedAt ? new Date(completedAt) : null;
  const { status, remaining, percent } = getSlaStatus(due, completed);

  const statusConfig = {
    ok: {
      bar: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      Icon: CheckCircle,
    },
    warning: {
      bar: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      Icon: AlertTriangle,
    },
    breached: {
      bar: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800",
      Icon: AlertTriangle,
    },
    completed: {
      bar: "bg-zinc-400",
      text: "text-zinc-600 dark:text-zinc-400",
      bg: "bg-zinc-50 dark:bg-zinc-900",
      border: "border-zinc-200 dark:border-zinc-800",
      Icon: CheckCircle,
    },
    na: {
      bar: "bg-zinc-300",
      text: "text-zinc-400",
      bg: "bg-zinc-50 dark:bg-zinc-900",
      border: "border-zinc-200 dark:border-zinc-800",
      Icon: Clock,
    },
  };

  const config = statusConfig[status];
  const { Icon } = config;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium font-mono",
          config.text,
          className
        )}
        title={`Batas: ${format(due, "dd MMM yyyy HH:mm")}`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span>{remaining}</span>
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-600 dark:text-zinc-400">
          {label || "Target Waktu"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-mono text-[11px] font-medium",
            config.text
          )}
        >
          <Icon className="h-3 w-3" />
          {remaining}
        </span>
      </div>

      {/* Vercel Hairline Progress Bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all duration-300", config.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
        <span>Batas: {format(due, "dd MMM HH:mm")}</span>
        {status === "breached" && (
          <span className="font-medium text-red-600 dark:text-red-400">Terlewat</span>
        )}
      </div>
    </div>
  );
}

export { SlaIndicator };
export type { SlaIndicatorProps };
