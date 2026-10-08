"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Navigation, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// Dynamically import Leaflet view with SSR disabled to prevent window object errors
const LiveDispatcherMap = dynamic(
  () =>
    import("@/components/map/live-dispatcher-map").then(
      (mod) => mod.LiveDispatcherMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] min-h-[500px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-xs text-zinc-500 gap-3">
        <Spinner size="md" />
        <span>Memuat peta satelit &amp; koordinat teknisi live...</span>
      </div>
    ),
  }
);

export default function AdminLiveMapPage() {
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
            Peta Teknisi &amp; Dispatcher Realtime
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pantau posisi GPS seluruh teknisi lapangan, status pergerakan, dan lokasi penugasan tiket secara langsung.
          </p>
        </div>
      </div>

      {/* Main Map View */}
      <LiveDispatcherMap />
    </div>
  );
}
