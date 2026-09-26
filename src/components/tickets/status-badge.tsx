import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getTicketStatusLabel } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  className?: string;
  dot?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, dot = true, size = "sm" }: StatusBadgeProps) {
  const normalized = (status?.toLowerCase() || "open") as any;
  const label = getTicketStatusLabel(status);

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
