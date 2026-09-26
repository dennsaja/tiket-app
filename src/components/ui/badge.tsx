import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        // Status variants
        open: "status-open",
        assigned: "status-assigned",
        in_progress: "status-in_progress",
        pending: "status-pending",
        waiting_for_user: "status-waiting_for_user",
        waiting_for_third_party: "status-waiting_for_third_party",
        resolved: "status-resolved",
        closed: "status-closed",
        reopened: "status-reopened",
        cancelled: "status-cancelled",
        // Priority variants
        critical: "priority-critical",
        high: "priority-high",
        medium: "priority-medium",
        low: "priority-low",
        // Generic
        default: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
        success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
        warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
        info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
        indigo: "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", {
            "bg-zinc-500": variant === "open" || variant === "closed",
            "bg-blue-500": variant === "assigned" || variant === "info",
            "bg-purple-500": variant === "in_progress" || variant === "purple",
            "bg-amber-500": variant === "pending" || variant === "warning" || variant === "reopened",
            "bg-orange-500":
              variant === "waiting_for_user" ||
              variant === "waiting_for_third_party" ||
              variant === "high",
            "bg-green-500": variant === "resolved" || variant === "success" || variant === "low",
            "bg-red-500": variant === "cancelled" || variant === "error" || variant === "critical",
            "bg-yellow-500": variant === "medium",
          })}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
