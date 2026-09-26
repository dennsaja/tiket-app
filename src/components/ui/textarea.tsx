import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  maxLength?: number;
  containerClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      showCount,
      maxLength,
      containerClassName,
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(
      typeof value === "string" ? value.length : 0
    );
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

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
        <textarea
          id={inputId}
          ref={ref}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          className={cn(
            "w-full rounded-md border bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 shadow-xs",
            "transition-colors focus:outline-none focus:ring-1 focus:ring-black focus:border-black",
            "dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-white dark:focus:border-white",
            "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:bg-zinc-900",
            "resize-y min-h-[80px]",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-zinc-200",
            className
          )}
          {...props}
        />
        <div className="flex items-start justify-between">
          <div>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            {helperText && !error && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
            )}
          </div>
          {showCount && maxLength && (
            <p
              className={cn(
                "text-xs tabular-nums ml-auto font-mono",
                charCount > maxLength * 0.9
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-400"
              )}
            >
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
