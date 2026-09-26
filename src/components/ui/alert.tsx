import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

const alertConfig: Record<
  AlertVariant,
  {
    containerClass: string;
    iconClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  info: {
    containerClass: "bg-blue-50 border-blue-200 text-blue-800",
    iconClass: "text-blue-500",
    Icon: Info,
  },
  success: {
    containerClass: "bg-green-50 border-green-200 text-green-800",
    iconClass: "text-green-500",
    Icon: CheckCircle,
  },
  warning: {
    containerClass: "bg-yellow-50 border-yellow-200 text-yellow-800",
    iconClass: "text-yellow-500",
    Icon: AlertTriangle,
  },
  error: {
    containerClass: "bg-red-50 border-red-200 text-red-800",
    iconClass: "text-red-500",
    Icon: XCircle,
  },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

function Alert({
  variant = "info",
  title,
  children,
  onClose,
  className,
}: AlertProps) {
  const config = alertConfig[variant];
  const { Icon } = config;

  return (
    <div
      className={cn(
        "flex gap-3 rounded border p-3",
        config.containerClass,
        className
      )}
      role="alert"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClass)} />
      <div className="flex-1 text-sm">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export { Alert };
export type { AlertVariant };
