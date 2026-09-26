"use client";

import * as React from "react";
import { buildApiUrl } from "@/lib/utils";

interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  requesterId: string;
  assigneeId?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  slaResolutionDue?: string | null;
  slaFirstResponseDue?: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; name: string; email: string; avatarUrl?: string | null };
  assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
}

interface TicketFilters {
  status?: string[];
  priority?: string[];
  assigneeId?: string;
  departmentId?: string;
  categoryId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  mine?: boolean;
}

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface UseTicketsReturn {
  tickets: Ticket[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTickets(filters: TicketFilters = {}): UseTicketsReturn {
  const [data, setData] = React.useState<TicketsResponse>({
    tickets: [],
    total: 0,
    page: 1,
    perPage: 25,
    totalPages: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, any> = {
      page: filters.page || 1,
      perPage: filters.perPage || 25,
    };

    if (filters.status?.length) params.status = filters.status;
    if (filters.priority?.length) params.priority = filters.priority;
    if (filters.assigneeId) params.assigneeId = filters.assigneeId;
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.search) params.search = filters.search;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters.mine) params.mine = "true";

    const url = buildApiUrl("/api/tickets", params);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    filters.status?.join(","),
    filters.priority?.join(","),
    filters.assigneeId,
    filters.departmentId,
    filters.categoryId,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
    filters.perPage,
    filters.sortBy,
    filters.sortOrder,
    filters.mine,
    refreshKey,
  ]);

  return {
    ...data,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}

interface UseTicketReturn {
  ticket: TicketDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface TicketDetail extends Ticket {
  description: string;
  resolution?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  messages?: Array<{
    id: string;
    content: string;
    type: string;
    isFirstResponse: boolean;
    createdAt: string;
    editedAt?: string | null;
    author: {
      id: string;
      name: string;
      email: string;
      role: string;
      avatarUrl?: string | null;
    };
    attachments?: Array<{
      id: string;
      originalName: string;
      size: number;
      mimeType: string;
    }>;
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    createdAt: string;
    changedBy?: { id: string; name: string };
  }>;
  assignmentHistory?: Array<{
    id: string;
    fromAgent?: { id: string; name: string } | null;
    toAgent?: { id: string; name: string } | null;
    createdAt: string;
    assignedBy?: { id: string; name: string };
  }>;
  subcategory?: { id: string; name: string } | null;
  slaPolicy?: { id: string; name: string; firstResponseMinutes: number; resolutionMinutes: number } | null;
  slaFirstResponseAt?: string | null;
  slaResolvedAt?: string | null;
}

export function useTicket(id: string): UseTicketReturn {
  const [ticket, setTicket] = React.useState<TicketDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/tickets/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setTicket(json.ticket || json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  return {
    ticket,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}

export type { Ticket, TicketFilters, TicketsResponse };
