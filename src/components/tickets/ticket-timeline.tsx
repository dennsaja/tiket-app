"use client";

import * as React from "react";
import { formatRelativeTime, formatDateTime, getTicketStatusLabel } from "@/lib/utils";
import { History, UserCheck, RefreshCw, CheckCircle, Clock } from "lucide-react";

interface StatusHistoryItem {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
  createdAt: string | Date;
  changedBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface AssignmentHistoryItem {
  id: string;
  reason?: string | null;
  createdAt: string | Date;
  fromAgent?: { id: string; name: string } | null;
  toAgent?: { id: string; name: string } | null;
  assignedBy: { id: string; name: string };
}

interface TicketTimelineProps {
  statusHistory?: StatusHistoryItem[];
  assignmentHistory?: AssignmentHistoryItem[];
}

export function TicketTimeline({
  statusHistory = [],
  assignmentHistory = [],
}: TicketTimelineProps) {
  // Merge and sort all events by date desc
  const allEvents = React.useMemo(() => {
    const events: Array<{
      id: string;
      date: Date;
      type: "status" | "assignment";
      data: any;
    }> = [];

    statusHistory.forEach((h) => {
      events.push({
        id: `status-${h.id}`,
        date: new Date(h.createdAt),
        type: "status",
        data: h,
      });
    });

    assignmentHistory.forEach((h) => {
      events.push({
        id: `assign-${h.id}`,
        date: new Date(h.createdAt),
        type: "assignment",
        data: h,
      });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [statusHistory, assignmentHistory]);

  if (allEvents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-400 text-center">
        No activity history recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-3">
      <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
        <History className="h-4 w-4 text-indigo-600" />
        Activity Timeline
      </h3>

      <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
        {allEvents.map((event) => {
          if (event.type === "status") {
            const h = event.data as StatusHistoryItem;
            return (
              <div key={event.id} className="relative text-xs">
                <span className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">
                    Status changed to{" "}
                    <span className="font-semibold text-indigo-600">
                      {getTicketStatusLabel(h.toStatus)}
                    </span>
                  </span>
                  <span className="text-[11px] text-gray-400">
                    by {h.changedBy?.name || "System"} • {formatRelativeTime(h.createdAt)}
                  </span>
                  {h.reason && (
                    <span className="mt-0.5 text-[11px] text-gray-500 italic">
                      "{h.reason}"
                    </span>
                  )}
                </div>
              </div>
            );
          }

          if (event.type === "assignment") {
            const h = event.data as AssignmentHistoryItem;
            return (
              <div key={event.id} className="relative text-xs">
                <span className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-800">
                    {h.toAgent ? (
                      <>
                        Assigned to{" "}
                        <span className="font-semibold text-gray-900">
                          {h.toAgent.name}
                        </span>
                      </>
                    ) : (
                      "Ticket unassigned"
                    )}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    by {h.assignedBy?.name || "System"} • {formatRelativeTime(h.createdAt)}
                  </span>
                  {h.reason && (
                    <span className="mt-0.5 text-[11px] text-gray-500 italic">
                      "{h.reason}"
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
