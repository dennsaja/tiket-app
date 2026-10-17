"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Compass, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// Dynamically import 3D Mapbox / MapLibre GL view with SSR disabled
const LiveDispatcherMap = dynamic(
  () => import("./live-dispatcher-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] min-h-[580px] rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-b from-sky-50/60 to-white dark:from-zinc-900 dark:to-black text-xs text-zinc-500 gap-3 shadow-sm">
        <Spinner size="md" />
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          Memuat Peta 3D Interaktif &amp; Navigasi Teknisi Live...
        </span>
      </div>
    ),
  }
);

export default function AdminLiveMapPage() {
  return (
    <div className="space-y-3">
      {/* Compact Modern Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0066AE] to-[#0096D6] text-white flex items-center justify-center shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                3D Live Dispatch &amp; Navigation
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                3D Maps UI Preview
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Visualisasi gedung 3D interaktif, indikator rute navigasi real-time, dan panel kontrol bergaya super-app.
            </p>
          </div>
        </div>
      </div>

      {/* Main 3D Map & GoPay/Gojek Inspired Dispatch View */}
      <LiveDispatcherMap />
    </div>
  );
}
