"use client";

import * as React from "react";
import { SlaIndicator } from "@/components/ui/sla-indicator";
import { Timer, CheckCircle2 } from "lucide-react";

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
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-400 text-center dark:border-zinc-800 dark:bg-black">
        Tidak ada kebijakan SLA aktif untuk tiket ini.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
        <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
          Target Waktu SLA
        </h3>
        {policyName && (
          <span className="text-[10px] text-zinc-400 font-mono">
            {policyName}
          </span>
        )}
      </div>

      <div className="space-y-3.5">
        {/* First Response SLA */}
        {firstResponseDue && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Respons Pertama</span>
              {firstResponseAt ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-medium font-mono">
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
          <div className="space-y-1 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">Waktu Resolusi</span>
              {resolvedAt ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-medium font-mono">
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
