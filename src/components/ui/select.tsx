"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  containerClassName?: string;
  id?: string;
}

function Select({
  label,
  error,
  helperText,
  placeholder = "Pilih...",
  options,
  value,
  onValueChange,
  disabled,
  required,
  containerClassName,
  id,
}: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={inputId}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border bg-white px-3 text-xs text-zinc-900 shadow-xs",
            "transition-colors focus:outline-none focus:ring-1 focus:ring-black focus:border-black",
            "dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:focus:ring-white dark:focus:border-white",
            "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:bg-zinc-900",
            "data-[placeholder]:text-zinc-400 dark:data-[placeholder]:text-zinc-600",
            error ? "border-red-500" : "border-zinc-200"
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg animate-fade-in dark:border-zinc-800 dark:bg-black"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded px-2.5 py-1.5 text-xs text-zinc-900 outline-none transition-colors dark:text-zinc-100",
                    "hover:bg-zinc-100 focus:bg-zinc-100 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  )}
                >
                  <SelectPrimitive.ItemIndicator className="absolute right-2">
                    <Check className="h-3.5 w-3.5 text-black dark:text-white" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
      )}
    </div>
  );
}

export { Select };
