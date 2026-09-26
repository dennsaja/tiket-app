import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function Spinner({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  };

  return (
    <Loader2
      className={cn("animate-spin text-indigo-600", sizes[size], className)}
    />
  );
}

function SpinnerPage() {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export { Spinner, SpinnerPage };
