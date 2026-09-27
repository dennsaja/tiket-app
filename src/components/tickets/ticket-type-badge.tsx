import * as React from "react";
import { cn, getTicketTypeShortLabel, getTicketTypeLabel } from "@/lib/utils";
import { Globe, Wrench, Video, ShieldAlert, ClipboardCheck } from "lucide-react";

export interface TicketTypeBadgeProps {
  type: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  fullLabel?: boolean;
  size?: "sm" | "md";
}

export function TicketTypeBadge({
  type = "psb",
  className,
  showIcon = true,
  fullLabel = false,
  size = "sm",
}: TicketTypeBadgeProps) {
  const normType = type?.toLowerCase() || "psb";
  const label = fullLabel ? getTicketTypeLabel(normType) : getTicketTypeShortLabel(normType);

  let icon = <Globe className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;
  let colorClasses = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";

  if (normType === "perbaikan_infrastruktur") {
    icon = <Wrench className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  } else if (normType === "pemasangan_cctv") {
    icon = <Video className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;
    colorClasses = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
  } else if (normType === "perbaikan_cctv") {
    icon = <ShieldAlert className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  } else if (normType === "maintenance") {
    icon = <ClipboardCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />;
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap shadow-2xs transition-colors",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]",
        colorClasses,
        className
      )}
      title={getTicketTypeLabel(normType)}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
}
