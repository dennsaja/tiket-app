import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0 text-xs font-medium leading-5 whitespace-nowrap",
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
        default: "bg-gray-100 text-gray-700 border-gray-200",
        success: "bg-green-50 text-green-700 border-green-200",
        warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
        error: "bg-red-50 text-red-700 border-red-200",
        info: "bg-blue-50 text-blue-700 border-blue-200",
        purple: "bg-purple-50 text-purple-700 border-purple-200",
        indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
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
          className={cn("inline-block h-1.5 w-1.5 rounded-full", {
            "bg-blue-500": variant === "open",
            "bg-indigo-500": variant === "assigned",
            "bg-purple-500": variant === "in_progress",
            "bg-yellow-500": variant === "pending",
            "bg-orange-500":
              variant === "waiting_for_user" ||
              variant === "waiting_for_third_party",
            "bg-green-500": variant === "resolved" || variant === "success",
            "bg-gray-400": variant === "closed",
            "bg-amber-500": variant === "reopened",
            "bg-red-500": variant === "cancelled" || variant === "error",
            "bg-red-600": variant === "critical",
            "bg-orange-600": variant === "high",
            "bg-yellow-600": variant === "medium",
            "bg-green-600": variant === "low",
          })}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
