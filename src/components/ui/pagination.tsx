"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { Select } from "./select";

export interface PaginationProps {
  page?: number;
  currentPage?: number;
  perPage?: number;
  itemsPerPage?: number;
  total?: number;
  totalItems?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  className?: string;
}

function getPaginationRange(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range: (number | "...")[] = [1];

  if (current > 3) range.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    range.push(i);
  }
  if (current < total - 2) range.push("...");
  range.push(total);

  return range;
}

function Pagination({
  page: rawPage,
  currentPage: rawCurrentPage,
  perPage: rawPerPage,
  itemsPerPage: rawItemsPerPage,
  total: rawTotal,
  totalItems: rawTotalItems,
  totalPages: rawTotalPages,
  onPageChange,
  onPerPageChange,
  className,
}: PaginationProps) {
  const page = rawCurrentPage || rawPage || 1;
  const perPage = rawItemsPerPage || rawPerPage || 25;
  const total = rawTotalItems !== undefined ? rawTotalItems : rawTotal !== undefined ? rawTotal : 0;
  const calculatedTotalPages = rawTotalPages || Math.ceil(total / perPage) || 1;

  const start = Math.min((page - 1) * perPage + 1, total);
  const end = Math.min(page * perPage, total);
  const range = getPaginationRange(page, calculatedTotalPages);

  const perPageOptions = [
    { value: "10", label: "10 / hal" },
    { value: "25", label: "25 / hal" },
    { value: "50", label: "50 / hal" },
    { value: "100", label: "100 / hal" },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-2",
        className
      )}
    >
      <p className="text-xs text-gray-500">
        Menampilkan{" "}
        <span className="font-medium text-gray-700">
          {start}–{end}
        </span>{" "}
        dari <span className="font-medium text-gray-700">{total}</span> data
      </p>

      <div className="flex items-center gap-2">
        {onPerPageChange && (
          <Select
            options={perPageOptions}
            value={String(perPage)}
            onValueChange={(v) => onPerPageChange(Number(v))}
            containerClassName="w-28"
          />
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1 || !onPageChange}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {range.map((r, i) =>
            r === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-7 w-7 items-center justify-center text-gray-400"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            ) : (
              <button
                key={r}
                onClick={() => onPageChange?.(r as number)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors cursor-pointer",
                  r === page
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {r}
              </button>
            )
          )}

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= calculatedTotalPages || !onPageChange}
            aria-label="Halaman selanjutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { Pagination };
