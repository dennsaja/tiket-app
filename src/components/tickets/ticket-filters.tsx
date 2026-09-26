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
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-xs space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, description..."
              className="pl-8 h-9 text-xs"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              className="h-9 text-xs"
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => applyFilters()}
            leftIcon={<Filter className="h-3.5 w-3.5" />}
            className="h-9 text-xs"
          >
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 pt-1 border-t border-gray-100">
        <Select
          label="Status"
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            applyFilters({ status: val });
          }}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "open", label: "Open" },
            { value: "assigned", label: "Assigned" },
            { value: "in_progress", label: "In Progress" },
            { value: "pending", label: "Pending" },
            { value: "waiting_for_user", label: "Waiting for User" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
            { value: "reopened", label: "Reopened" },
          ]}
        />

        <Select
          label="Priority"
          value={priority}
          onValueChange={(val) => {
            setPriority(val);
            applyFilters({ priority: val });
          }}
          options={[
            { value: "all", label: "All Priorities" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />

        {agents.length > 0 && (
          <Select
            label="Assignee"
            value={assigneeId}
            onValueChange={(val) => {
              setAssigneeId(val);
              applyFilters({ assigneeId: val });
            }}
            options={[
              { value: "all", label: "All Assignees" },
              { value: "unassigned", label: "Unassigned" },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        )}

        {departments.length > 0 && (
          <Select
            label="Department"
            value={departmentId}
            onValueChange={(val) => {
              setDepartmentId(val);
              applyFilters({ departmentId: val });
            }}
            options={[
              { value: "all", label: "All Departments" },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        )}

        {categories.length > 0 && (
          <Select
            label="Category"
            value={categoryId}
            onValueChange={(val) => {
              setCategoryId(val);
              applyFilters({ categoryId: val });
            }}
            options={[
              { value: "all", label: "All Categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}
      </div>
    </div>
  );
}
