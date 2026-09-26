import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white hover:bg-zinc-800 active:bg-zinc-900 border border-black shadow-xs font-medium dark:bg-white dark:text-black dark:border-white dark:hover:bg-zinc-200",
        ghost:
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
        outline:
          "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 shadow-xs font-medium dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-red-600 shadow-xs font-medium",
        link: "text-black dark:text-white underline-offset-4 hover:underline p-0 h-auto font-normal",
        secondary:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 border border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700",
      },
      size: {
        sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
        md: "h-8 px-3 text-xs font-medium gap-1.5 rounded-md",
        lg: "h-9 px-4 text-sm gap-2 rounded-md",
        xl: "h-10 px-5 text-sm gap-2 rounded-md",
        icon: "h-8 w-8 p-0 rounded-md",
        "icon-sm": "h-7 w-7 p-0 rounded-md",
        "icon-lg": "h-9 w-9 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isBusy = loading || isLoading;
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isBusy}
        {...props}
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isBusy && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
