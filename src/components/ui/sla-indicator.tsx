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
  const totalMinutes = differenceInMinutes(due, new Date(dueAt.getTime() - 24 * 60 * 60 * 1000));
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

  // Use 24h as baseline for percentage if total unknown
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
      <div className={cn("flex items-center gap-1 text-xs text-gray-400", className)}>
        <Clock className="h-3.5 w-3.5" />
        <span>Tanpa SLA</span>
      </div>
    );
  }

  const due = new Date(dueAt);
  const completed = completedAt ? new Date(completedAt) : null;
  const { status, remaining, percent } = getSlaStatus(due, completed);

  const statusConfig = {
    ok: {
      bar: "bg-green-500",
      text: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
      Icon: CheckCircle,
    },
    warning: {
      bar: "bg-yellow-500",
      text: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      Icon: AlertTriangle,
    },
    breached: {
      bar: "bg-red-500",
      text: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      Icon: AlertTriangle,
    },
    completed: {
      bar: "bg-green-500",
      text: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
      Icon: CheckCircle,
    },
    na: {
      bar: "bg-gray-300",
      text: "text-gray-500",
      bg: "bg-gray-50",
      border: "border-gray-200",
      Icon: Clock,
    },
  };

  const config = statusConfig[status];
  const { Icon } = config;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1 text-xs",
          config.text,
          className
        )}
      >
        <Icon className="h-3 w-3" />
        <span>{remaining}</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{label}</span>
          <div className={cn("flex items-center gap-1 text-xs font-medium", config.text)}>
            <Icon className="h-3 w-3" />
            <span>{remaining}</span>
          </div>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn("h-full rounded-full transition-all", config.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!label && (
        <div className={cn("flex items-center gap-1 text-xs", config.text)}>
          <Icon className="h-3 w-3" />
          <span>{remaining}</span>
          {dueAt && (
            <span className="ml-auto text-gray-400">
              Batas {format(due, "d MMM, HH:mm")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { SlaIndicator };
export type { SlaStatus };
