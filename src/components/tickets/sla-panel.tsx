"use client";

import * as React from "react";
import { SlaIndicator } from "@/components/ui/sla-indicator";
import { formatDateTime } from "@/lib/utils";
import { Timer, CheckCircle2, AlertCircle } from "lucide-react";

interface SlaPanelProps {
  firstResponseDue?: string | Date | null;
  firstResponseAt?: string | Date | null;
  resolutionDue?: string | Date | null;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
  policyName?: string | null;
}

export function SlaPanel({
  firstResponseDue,
  firstResponseAt,
  resolutionDue,
  resolvedAt,
  createdAt,
  policyName,
}: SlaPanelProps) {
  if (!firstResponseDue && !resolutionDue) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500 text-center">
        Tidak ada kebijakan SLA aktif untuk tiket ini.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-indigo-600" />
          Target Waktu SLA
        </h3>
        {policyName && (
          <span className="text-[10px] text-gray-400 font-mono">
            {policyName}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* First Response SLA */}
        {firstResponseDue && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Respons Pertama</span>
              {firstResponseAt ? (
                <span className="text-green-700 flex items-center gap-1 text-[11px] font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Sudah Direspons
                </span>
              ) : null}
            </div>
            <SlaIndicator
              dueAt={firstResponseDue}
              completedAt={firstResponseAt}
            />
          </div>
        )}

        {/* Resolution SLA */}
        {resolutionDue && (
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Waktu Resolusi</span>
              {resolvedAt ? (
                <span className="text-green-700 flex items-center gap-1 text-[11px] font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Selesai
                </span>
              ) : null}
            </div>
            <SlaIndicator
              dueAt={resolutionDue}
              completedAt={resolvedAt}
            />
          </div>
        )}
      </div>
    </div>
  );
}
