"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  Navigation,
  NavigationOff,
  RefreshCw,
  Battery,
  AlertTriangle,
  Radio,
  MapPin,
  Lock,
  Smartphone,
  Monitor,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useTechnicianTracker } from "@/hooks/use-technician-tracker";
import { formatRelativeTime } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export function TechnicianGpsBar() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isTechnician = userRole === "agent";

  const {
    isSupported,
    isTracking,
    isLocating,
    permissionStatus,
    error,
    lastLocation,
    battery,
    toggleTracking,
    requestPermission,
    forceSendLocation,
  } = useTechnicianTracker();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [helpModalOpen, setHelpModalOpen] = React.useState(false);
  const [deviceTab, setDeviceTab] = React.useState<"android" | "desktop">("android");

  // Auto-detect device for modal default tab
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      setDeviceTab(isMobile ? "android" : "desktop");
    }
  }, []);

  // Don't render for non-technicians
  if (!isTechnician) return null;

  // Manual update coordinates
  const handleManualUpdate = async () => {
    setIsUpdating(true);
    const ok = await forceSendLocation();
    setIsUpdating(false);
    if (ok) {
      toast.success("Koordinat GPS berhasil diperbarui!");
    } else {
      toast.error("Gagal mendapatkan lokasi. Pastikan GPS HP Anda aktif.");
    }
  };

  // User click action to trigger native browser prompt
  const handleRequestPermission = async () => {
    setIsUpdating(true);
    const ok = await requestPermission();
    setIsUpdating(false);
    if (ok) {
      setHelpModalOpen(false);
      toast.success("✅ Izin lokasi GPS berhasil diaktifkan! Pelacakan dimulai.");
    } else {
      if (permissionStatus === "denied" || error?.includes("ditolak")) {
        setHelpModalOpen(true);
      }
    }
  };

  // If browser doesn't support geolocation or insecure connection
  if (!isSupported) {
    return (
      <div className="bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs px-3 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            {error || "Perangkat atau browser ini tidak mendukung sensor GPS Geolocation, atau koneksi bukan HTTPS."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── CASE 1: Permission is BLOCKED / DENIED ── */}
      {permissionStatus === "denied" ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs px-3 sm:px-6 py-2.5 shadow-xs transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200/80 dark:bg-amber-900/50 shrink-0 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  Izin Lokasi (GPS) Diblokir oleh Browser
                </p>
                <p className="text-[11px] sm:text-xs text-amber-750 dark:text-amber-300 truncate sm:whitespace-normal">
                  Browser Anda memblokir akses lokasi. Buka blokir via ikon gembok 🔒 di address bar agar posisi Anda dapat dipantau di live map dispatcher.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <a
                href="/download"
                className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors"
                title="Pasang aplikasi Android untuk pelacakan latar belakang"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Download APK Android</span>
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHelpModalOpen(true)}
                className="h-7 text-xs border-amber-300 dark:border-amber-700 bg-amber-100/60 dark:bg-amber-900/30 hover:bg-amber-200 text-amber-900 dark:text-amber-100 font-medium"
              >
                <Lock className="h-3 w-3 mr-1 text-amber-700 dark:text-amber-400" />
                Panduan Buka Blokir (🔒)
              </Button>
              <Button
                size="sm"
                disabled={isUpdating}
                onClick={handleRequestPermission}
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isUpdating ? "animate-spin" : ""}`} />
                Coba Lagi
              </Button>
            </div>
          </div>
        </div>
      ) : permissionStatus === "prompt" ? (
        /* ── CASE 2: Permission not yet granted (PROMPT WAITING) ── */
        <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200 text-xs px-3 sm:px-6 py-2.5 shadow-xs transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-200/80 dark:bg-sky-900/50 shrink-0 text-sky-700 dark:text-sky-300">
                <Navigation className="h-4 w-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs sm:text-sm text-sky-900 dark:text-sky-100 flex items-center gap-1.5">
                  Aktivasi Pelacakan Lokasi (GPS) Teknisi
                </p>
                <p className="text-[11px] sm:text-xs text-sky-750 dark:text-sky-300 truncate sm:whitespace-normal">
                  Ketuk tombol di bawah untuk memunculkan izin lokasi browser, agar status lapangan dan rute tiket Anda terhubung realtime.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                disabled={isUpdating}
                onClick={handleRequestPermission}
                className="h-7 text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-xs"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {isUpdating ? "Meminta Izin..." : "Izinkan Akses GPS"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── CASE 3: Permission GRANTED (NORMAL GPS BAR) ── */
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
                      {lastLocation.speed !== null &&
                        lastLocation.speed !== undefined &&
                        lastLocation.speed > 1 && (
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
                className="inline-flex items-center gap-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                title="Perbarui koordinat sekarang"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isUpdating ? "animate-spin text-emerald-500" : ""}`}
                />
                <span className="hidden sm:inline">Perbarui</span>
              </button>

              <button
                type="button"
                onClick={() => toggleTracking()}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors shadow-xs cursor-pointer ${
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
      )}

      {/* ── MODAL: Panduan Buka Blokir Izin Lokasi ── */}
      <Modal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        title="Cara Membuka Izin Lokasi (GPS)"
      >
        <div className="space-y-4 pt-1 text-xs text-zinc-700 dark:text-zinc-300">
          <p className="text-zinc-600 dark:text-zinc-400">
            Browser telah memblokir akses lokasi untuk domain HelpDesk. Ikuti langkah mudah di bawah ini untuk membuka izin:
          </p>

          {/* Mobile APK Callout */}
          <div className="bg-sky-50 dark:bg-sky-950/40 p-3 rounded-xl border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <strong className="text-sky-950 dark:text-sky-100 block font-semibold text-xs">
                💡 Rekomendasi: Pasang Aplikasi Android Teknisi
              </strong>
              <span className="text-[11px] text-sky-800 dark:text-sky-300">
                GPS otomatis aktif di latar belakang saat HP di saku tanpa kendala izin browser.
              </span>
            </div>
            <a
              href="/downloads/helpdesk-teknisi.apk"
              download="helpdesk-teknisi.apk"
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 font-bold text-xs shadow-xs transition-colors"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Unduh APK (.apk)</span>
            </a>
          </div>

          {/* Device Tab Switcher */}
          <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDeviceTab("android")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                deviceTab === "android"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Android / HP</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab("desktop")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                deviceTab === "desktop"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Laptop / Komputer</span>
            </button>
          </div>

          {/* Android Steps */}
          {deviceTab === "android" ? (
            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  Ketuk ikon <strong>Gembok (🔒)</strong> atau <strong>Setelan Web (Tune)</strong> di samping kiri alamat web URL (sebelah kiri <code>helpdesk.infinityteknik.net</code>).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  Ketuk menu <strong>Izin (Permissions)</strong> atau <strong>Setelan situs (Site settings)</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  Cari opsi <strong>Lokasi (Location)</strong>, lalu ubah statusnya menjadi <strong>Izinkan (Allow)</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  4
                </span>
                <p>
                  Pastikan tombol <strong>Lokasi / GPS</strong> di bar atas (Quick Settings) ponsel Android Anda sudah dinyalakan.
                </p>
              </div>
            </div>
          ) : (
            /* Desktop Steps */
            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  Klik ikon <strong>Gembok (🔒)</strong> atau ikon <strong>Setelan Situs</strong> di sebelah kiri address bar URL browser Anda.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  Pada baris <strong>Lokasi (Location)</strong>, ubah pengaturan menjadi <strong>Izinkan (Allow)</strong> atau geser toggle ke posisi aktif.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[11px] items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  Setelah diubah, klik tombol <strong>Periksa Ulang Lokasi</strong> di bawah atau muat ulang (refresh) halaman.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpModalOpen(false)}
              className="text-xs"
            >
              Tutup
            </Button>
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={handleRequestPermission}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {isUpdating ? "Memeriksa..." : "Periksa Ulang Lokasi Sekarang"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
