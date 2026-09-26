import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getTicketPriorityLabel } from "@/lib/utils";

export interface PriorityBadgeProps {
  priority: string;
  className?: string;
  dot?: boolean;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, className, dot = true, size = "sm" }: PriorityBadgeProps) {
  const normalized = (priority?.toLowerCase() || "medium") as any;
  const label = getTicketPriorityLabel(priority);

  return (
    <Badge
      variant={normalized}
      dot={dot}
      className={className}
    >
      {label}
    </Badge>
  );
}
