"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  Navigation,
  NavigationOff,
  RefreshCw,
  Battery,
  AlertTriangle,
  CheckCircle2,
  Radio,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTechnicianTracker } from "@/hooks/use-technician-tracker";
import { formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

export function TechnicianGpsBar() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isTechnician = userRole === "agent";

  const {
    isSupported,
    isTracking,
    isLocating,
    error,
    lastLocation,
    battery,
    toggleTracking,
    forceSendLocation,
  } = useTechnicianTracker();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // Don't render for non-technicians
  if (!isTechnician || !isSupported) return null;

  const handleManualUpdate = async () => {
    setIsUpdating(true);
    const ok = await forceSendLocation();
    setIsUpdating(false);
    if (ok) {
      toast.success("Koordinat GPS berhasil diperbarui!");
    } else {
      toast.error("Gagal mendapatkan lokasi. Pastikan GPS aktif.");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs px-3 sm:px-6 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left: GPS Status indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            {isTracking ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600"></span>
            )}

            <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
              <Navigation className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Live GPS:
            </span>
          </div>

          {isTracking ? (
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 truncate">
              {isLocating ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Mencari sinyal GPS...
                </span>
              ) : lastLocation ? (
                <span className="truncate">
                  Aktif
                  {lastLocation.accuracy && (
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-1">
                      (±{Math.round(lastLocation.accuracy)}m)
                    </span>
                  )}
                  {lastLocation.speed !== null && lastLocation.speed !== undefined && lastLocation.speed > 1 && (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1.5 font-mono">
                      {Math.round(lastLocation.speed)} km/h
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-400 ml-1.5 hidden md:inline">
                    • update {formatRelativeTime(lastLocation.updatedAt)}
                  </span>
                </span>
              ) : (
                <span className="text-zinc-500">Menunggu koordinat pertama...</span>
              )}
            </div>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 italic">
              Pelacakan lokasi nonaktif
            </span>
          )}

          {error && (
            <span className="text-red-500 dark:text-red-400 font-medium flex items-center gap-1 ml-1 truncate">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="truncate">{error}</span>
            </span>
          )}
        </div>

        {/* Right: Controls & Battery */}
        <div className="flex items-center gap-2 shrink-0">
          {battery !== null && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded font-mono">
              <Battery className="h-3 w-3 text-zinc-400" />
              {battery}%
            </span>
          )}

          <button
            type="button"
            onClick={handleManualUpdate}
            disabled={isUpdating || !isTracking}
            className="inline-flex items-center gap-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
            title="Perbarui koordinat sekarang"
          >
            <RefreshCw className={`h-3 w-3 ${isUpdating ? "animate-spin text-emerald-500" : ""}`} />
            <span className="hidden sm:inline">Perbarui</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTracking()}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors shadow-xs ${
              isTracking
                ? "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isTracking ? (
              <>
                <NavigationOff className="h-3 w-3" />
                <span>Matikan</span>
              </>
            ) : (
              <>
                <Radio className="h-3 w-3 animate-pulse" />
                <span>Aktifkan GPS</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
