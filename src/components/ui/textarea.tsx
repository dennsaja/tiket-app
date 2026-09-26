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
      <div className={cn("flex flex-col gap-1", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-gray-700"
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
            "w-full rounded border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            "resize-y min-h-[80px]",
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-500/20"
              : "border-gray-300",
            className
          )}
          {...props}
        />
        <div className="flex items-start justify-between">
          <div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {helperText && !error && (
              <p className="text-xs text-gray-500">{helperText}</p>
            )}
          </div>
          {showCount && maxLength && (
            <p
              className={cn(
                "text-xs tabular-nums ml-auto",
                charCount > maxLength * 0.9
                  ? "text-orange-600"
                  : "text-gray-400"
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
