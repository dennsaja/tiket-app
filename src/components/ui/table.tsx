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
        className={cn("w-full caption-bottom text-sm", className)}
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
    <thead className={cn("border-b border-gray-200", className)} {...props}>
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
    <tbody className={cn("divide-y divide-gray-100", className)} {...props}>
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
        "transition-colors hover:bg-gray-50",
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
        "h-9 px-3 text-left align-middle text-xs font-medium text-gray-500 first:pl-4",
        sortable && "cursor-pointer select-none hover:text-gray-900",
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className="shrink-0">
            {sortDirection === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : sortDirection === "desc" ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 text-gray-300" />
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
        "px-3 py-2.5 align-middle text-sm text-gray-700 first:pl-4",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// ─── Table Foot ───────────────────────────────────────────────────────────────

function TableFoot({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("border-t border-gray-200 bg-gray-50 text-xs text-gray-500", className)}
      {...props}
    >
      {children}
    </tfoot>
  );
}

export { Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableFoot };
