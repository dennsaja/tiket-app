"use client";

import * as React from "react";
import Link from "next/link";
import { TableRow, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { SlaIndicator } from "@/components/ui/sla-indicator";
import { ChevronRight } from "lucide-react";

interface TicketRowProps {
  ticket: {
    id: string;
    ticketNumber: number;
    title: string;
    status: string;
    priority: string;
    createdAt: string | Date;
    slaResolutionDue?: string | Date | null;
    requester?: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    } | null;
    assignee?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    } | null;
    department?: {
      id: string;
      name: string;
    } | null;
    category?: {
      id: string;
      name: string;
    } | null;
  };
  isSelected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  showCheckbox?: boolean;
}

export function TicketRow({
  ticket,
  isSelected,
  onSelect,
  showCheckbox,
}: TicketRowProps) {
  return (
    <TableRow className="group hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 cursor-pointer transition-colors">
      {showCheckbox && (
        <TableCell className="w-10 px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect?.(ticket.id, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-black dark:text-white"
          />
        </TableCell>
      )}

      <TableCell className="w-20 font-mono text-xs text-zinc-400 font-medium">
        <Link href={`/tickets/${ticket.id}`} className="hover:text-black dark:hover:text-white block py-1">
          #{ticket.ticketNumber}
        </Link>
      </TableCell>

      <TableCell className="min-w-[240px] max-w-md">
        <Link href={`/tickets/${ticket.id}`} className="block py-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-900 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white transition-colors text-xs line-clamp-1">
              {ticket.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
            {ticket.department && (
              <span className="text-zinc-500 font-medium dark:text-zinc-400">{ticket.department.name}</span>
            )}
            {ticket.category && (
              <>
                <span>•</span>
                <span>{ticket.category.name}</span>
              </>
            )}
          </div>
        </Link>
      </TableCell>

      <TableCell className="w-28">
        <StatusBadge status={ticket.status} />
      </TableCell>

      <TableCell className="w-24">
        <PriorityBadge priority={ticket.priority} />
      </TableCell>

      <TableCell className="w-36">
        <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
          <Avatar
            name={ticket.requester?.name || "User"}
            src={ticket.requester?.avatarUrl}
            size="sm"
            className="h-5 w-5 text-[9px] border border-zinc-200 dark:border-zinc-800"
          />
          <span className="truncate max-w-[100px]" title={ticket.requester?.name}>
            {ticket.requester?.name || "Unknown"}
          </span>
        </div>
      </TableCell>

      <TableCell className="w-36">
        {ticket.assignee ? (
          <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <Avatar
              name={ticket.assignee.name}
              src={ticket.assignee.avatarUrl}
              size="sm"
              className="h-5 w-5 text-[9px] border border-zinc-200 dark:border-zinc-800"
            />
            <span className="truncate max-w-[100px]" title={ticket.assignee.name}>
              {ticket.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-zinc-400 italic">Belum Ditugaskan</span>
        )}
      </TableCell>

      <TableCell className="w-32">
        {ticket.slaResolutionDue ? (
          <SlaIndicator
            dueAt={ticket.slaResolutionDue}
            compact
          />
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        )}
      </TableCell>

      <TableCell className="w-28 text-xs text-zinc-400 font-mono">
        {formatRelativeTime(ticket.createdAt)}
      </TableCell>

      <TableCell className="w-8 text-right pr-3">
        <Link href={`/tickets/${ticket.id}`} className="text-zinc-400 group-hover:text-black dark:group-hover:text-white">
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
