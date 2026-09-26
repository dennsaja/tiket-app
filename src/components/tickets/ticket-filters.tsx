"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Filter, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Department {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface TicketFiltersProps {
  departments?: Department[];
  categories?: Category[];
  agents?: UserOption[];
}

export function TicketFilters({ departments = [], categories = [], agents = [] }: TicketFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [status, setStatus] = React.useState(searchParams.get("status") || "all");
  const [priority, setPriority] = React.useState(searchParams.get("priority") || "all");
  const [assigneeId, setAssigneeId] = React.useState(searchParams.get("assigneeId") || "all");
  const [departmentId, setDepartmentId] = React.useState(searchParams.get("departmentId") || "all");
  const [categoryId, setCategoryId] = React.useState(searchParams.get("categoryId") || "all");

  const applyFilters = React.useCallback(
    (overrides: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      const current = {
        search,
        status,
        priority,
        assigneeId,
        departmentId,
        categoryId,
        ...overrides,
      };

      Object.entries(current).forEach(([k, v]) => {
        if (v && v !== "all") params.set(k, v);
      });

      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [search, status, priority, assigneeId, departmentId, categoryId, router, pathname]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search });
  };

  const handleReset = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setAssigneeId("all");
    setDepartmentId("all");
    setCategoryId("all");
    router.push(pathname);
  };

  const hasActiveFilters = Boolean(
    searchParams.get("search") ||
    (searchParams.get("status") && searchParams.get("status") !== "all") ||
    (searchParams.get("priority") && searchParams.get("priority") !== "all") ||
    (searchParams.get("assigneeId") && searchParams.get("assigneeId") !== "all") ||
    (searchParams.get("departmentId") && searchParams.get("departmentId") !== "all") ||
    (searchParams.get("categoryId") && searchParams.get("categoryId") !== "all")
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID tiket, judul, atau pelapor..."
              className="pl-8 h-8 text-xs font-normal"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              leftIcon={<RotateCcw className="h-3 w-3" />}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 pt-1">
        {/* Status */}
        <Select
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            applyFilters({ status: val });
          }}
          options={[
            { value: "all", label: "Semua Status" },
            { value: "open", label: "Baru" },
            { value: "assigned", label: "Ditugaskan" },
            { value: "in_progress", label: "Sedang Dikerjakan" },
            { value: "pending", label: "Tertunda" },
            { value: "waiting_for_user", label: "Menunggu Respons User" },
            { value: "resolved", label: "Selesai" },
            { value: "closed", label: "Ditutup" },
          ]}
        />

        {/* Priority */}
        <Select
          value={priority}
          onValueChange={(val) => {
            setPriority(val);
            applyFilters({ priority: val });
          }}
          options={[
            { value: "all", label: "Semua Prioritas" },
            { value: "critical", label: "Kritis" },
            { value: "high", label: "Tinggi" },
            { value: "medium", label: "Sedang" },
            { value: "low", label: "Rendah" },
          ]}
        />

        {/* Department */}
        <Select
          value={departmentId}
          onValueChange={(val) => {
            setDepartmentId(val);
            applyFilters({ departmentId: val });
          }}
          options={[
            { value: "all", label: "Semua Departemen" },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />

        {/* Category */}
        <Select
          value={categoryId}
          onValueChange={(val) => {
            setCategoryId(val);
            applyFilters({ categoryId: val });
          }}
          options={[
            { value: "all", label: "Semua Kategori" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />

        {/* Assignee */}
        <Select
          value={assigneeId}
          onValueChange={(val) => {
            setAssigneeId(val);
            applyFilters({ assigneeId: val });
          }}
          options={[
            { value: "all", label: "Semua Teknisi" },
            { value: "unassigned", label: "Belum Ditugaskan" },
            ...agents.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>
    </div>
  );
}
