import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      error,
      helperText,
      leftElement,
      rightElement,
      containerClassName,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
            {props.required && (
              <span className="ml-0.5 text-red-500">*</span>
            )}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="pointer-events-none absolute left-2.5 flex items-center text-zinc-400">
              {leftElement}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              "h-8 w-full rounded-md border bg-white px-3 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-xs",
              "transition-colors focus:outline-none focus:ring-1 focus:ring-black focus:border-black",
              "dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white dark:focus:border-white",
              "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:bg-zinc-900",
              error
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-zinc-200",
              leftElement && "pl-8",
              rightElement && "pr-8",
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2.5 flex items-center text-zinc-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
