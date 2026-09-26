import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ─── Table Root ───────────────────────────────────────────────────────────────

function Table({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full caption-bottom text-xs", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

// ─── Table Head ───────────────────────────────────────────────────────────────

function TableHead({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50", className)} {...props}>
      {children}
    </thead>
  );
}

// ─── Table Body ───────────────────────────────────────────────────────────────

function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-zinc-100 dark:divide-zinc-800/80", className)} {...props}>
      {children}
    </tbody>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

// ─── Table Header Cell ────────────────────────────────────────────────────────

export interface TableHeaderProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}

function TableHeader({
  className,
  children,
  sortable,
  sortDirection,
  onSort,
  ...props
}: TableHeaderProps) {
  return (
    <th
      className={cn(
        "h-8 px-3 text-left align-middle text-[11px] font-medium text-zinc-500 dark:text-zinc-400 first:pl-4 last:pr-4",
        sortable && "cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100",
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className="text-zinc-400">
            {sortDirection === "asc" ? (
              <ChevronUp className="h-3 w-3 text-zinc-900 dark:text-zinc-100" />
            ) : sortDirection === "desc" ? (
              <ChevronDown className="h-3 w-3 text-zinc-900 dark:text-zinc-100" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-40" />
            )}
          </span>
        )}
      </div>
    </th>
  );
}

// ─── Table Cell ───────────────────────────────────────────────────────────────

function TableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "py-2.5 px-3 align-middle text-xs text-zinc-700 dark:text-zinc-300 first:pl-4 last:pr-4",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// ─── Table Caption ────────────────────────────────────────────────────────────

function TableCaption({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("mt-4 text-xs text-zinc-400", className)}
      {...props}
    >
      {children}
    </caption>
  );
}

// ─── Table Empty ──────────────────────────────────────────────────────────────

function TableEmpty({
  colSpan,
  message = "Tidak ada data ditemukan",
  children,
}: {
  colSpan: number;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500"
      >
        {children || message}
      </td>
    </tr>
  );
}

export {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableCaption,
  TableEmpty,
};
