"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  Phone,
  MapPin,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TicketTypeBadge } from "@/components/tickets/ticket-type-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import {
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  triggerClientNotification,
} from "@/lib/notifications/client-notification";
import { playNotificationSound, unlockAudioContext } from "@/lib/utils/sound";
import { useSSE } from "@/hooks/use-sse";
import toast from "react-hot-toast";

interface NewTicketAlertData {
  id?: string;
  ticketId: string;
  ticketNumber: number;
  title: string;
  message?: string;
  ticketType?: string;
  priority?: string;
  reporterName?: string | null;
  reporterPhone?: string | null;
  reporterAddress?: string | null;
  isLead?: boolean;
}

export function TechnicianNotificationManager() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;
  const isTechnician = userRole === "agent";

  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("default");
  const [showPermissionPrompt, setShowPermissionPrompt] = React.useState(false);
  const [permissionHelpOpen, setPermissionHelpOpen] = React.useState(false);
  const [activeAlert, setActiveAlert] = React.useState<NewTicketAlertData | null>(null);

  // Initialize permission state & Service Worker
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    if (currentPerm === "granted") {
      registerServiceWorker();
    } else if (isTechnician) {
      // For technicians, aggressively ensure notification permission is requested
      setShowPermissionPrompt(true);
    }

    // Global click listener to unlock Web Audio context on first user interaction
    const handleFirstInteraction = () => {
      unlockAudioContext();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [isTechnician]);

  // Handle SSE Realtime Events
  useSSE("/api/sse", {
    enabled: !!session?.user,
    onEvent: (event) => {
      if (event.type === "notification") {
        const payload = event.data as any;
        if (!payload) return;

        // Dispatches event so top-nav notification bell updates unread count immediately
        window.dispatchEvent(new CustomEvent("refresh-notifications"));

        // If this is a ticket assignment notification
        if (payload.type === "ticket_assigned" && payload.ticketId) {
          const alertData: NewTicketAlertData = {
            ticketId: payload.ticketId,
            ticketNumber: payload.data?.ticketNumber || 0,
            title: payload.data?.ticketTitle || payload.title || "Tiket Baru",
            message: payload.message,
            ticketType: payload.data?.ticketType || "psb",
            priority: payload.data?.priority || "medium",
            reporterName: payload.data?.reporterName,
            reporterPhone: payload.data?.reporterPhone,
            reporterAddress: payload.data?.reporterAddress,
            isLead: payload.data?.isLead,
          };

          // 1. Play sound chime and trigger Android/Browser push notification
          triggerClientNotification({
            title: `🚨 Penugasan Tiket #${alertData.ticketNumber}`,
            message: alertData.title,
            ticketId: alertData.ticketId,
            ticketNumber: alertData.ticketNumber,
            ticketType: alertData.ticketType,
            priority: alertData.priority,
            playSound: true,
          });

          // 2. Open interactive In-App Pop-up
          setActiveAlert(alertData);
        } else {
          // Other notifications (e.g. message, status change)
          triggerClientNotification({
            title: payload.title || "Pemberitahuan HelpDesk",
            message: payload.message || "",
            ticketId: payload.ticketId,
            playSound: true,
          });
        }
      }
    },
  });

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);

    if (result === "granted") {
      setShowPermissionPrompt(false);
      toast.success("✅ Notifikasi & Suara berhasil diaktifkan!");
    } else if (result === "denied") {
      setPermissionHelpOpen(true);
    }
  };

  const handleTestSound = () => {
    unlockAudioContext();
    playNotificationSound("ticket_assigned");
    toast.success("🔊 Memutar nada dering notifikasi tiket!");
  };

  return (
    <>
      {/* ── Persistent Warning Banner for Technicians without Notification Permission ── */}
      {isTechnician && permission !== "granted" && showPermissionPrompt && (
        <div className="bg-amber-500 text-black border-b border-amber-600 px-4 py-2.5 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 shrink-0">
                <BellRing className="h-3.5 w-3.5 text-black animate-bounce" />
              </div>
              <div>
                <span className="font-bold">Izin Notifikasi Teknisi Diperlukan:</span> Aktifkan notifikasi &amp; suara agar Anda menerima pop-up peringatan realtime seketika saat ada penugasan tiket masuk.
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTestSound}
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-black/10 hover:bg-black/20 text-black px-2.5 py-1 rounded-md transition-colors"
                title="Uji coba bunyi notifikasi"
              >
                <Volume2 className="h-3 w-3" /> Tes Bunyi
              </button>

              <button
                type="button"
                onClick={handleRequestPermission}
                className="inline-flex items-center gap-1 text-[11px] font-bold bg-black text-white hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors shadow-xs"
              >
                <Bell className="h-3 w-3" /> Izinkan Notifikasi Sekarang
              </button>

              <button
                type="button"
                onClick={() => setShowPermissionPrompt(false)}
                className="text-black/60 hover:text-black p-1"
                aria-label="Tutup sementara"
                title="Tutup sementara"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Realtime Ticket Alert Interactive Popup Modal ── */}
      <Modal
        open={!!activeAlert}
        onOpenChange={(open) => !open && setActiveAlert(null)}
        title="🚨 Penugasan Tiket Baru Masuk!"
      >
        {activeAlert && (
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-white dark:border-zinc-800 space-y-3 shadow-md">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
                    #{activeAlert.ticketNumber}
                  </span>
                  {activeAlert.ticketType && (
                    <TicketTypeBadge type={activeAlert.ticketType} />
                  )}
                  {activeAlert.isLead && (
                    <span className="text-[10px] font-bold bg-amber-400 text-black px-1.5 py-0.5 rounded">
                      Ketua Tim
                    </span>
                  )}
                </div>
                {activeAlert.priority && (
                  <PriorityBadge priority={activeAlert.priority as any} />
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {activeAlert.title}
                </h3>
                {activeAlert.message && (
                  <p className="text-xs text-zinc-300 mt-1">
                    {activeAlert.message}
                  </p>
                )}
              </div>

              {/* Pelapor details */}
              {(activeAlert.reporterName || activeAlert.reporterPhone || activeAlert.reporterAddress) && (
                <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-300 space-y-1">
                  {activeAlert.reporterName && (
                    <p className="flex items-center gap-1.5">
                      <User className="h-3 w-3 text-zinc-400 shrink-0" />
                      <span>Pelapor: <strong className="text-white">{activeAlert.reporterName}</strong></span>
                    </p>
                  )}
                  {activeAlert.reporterPhone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-zinc-400 shrink-0" />
                      <span>Telepon: <strong className="text-white font-mono">{activeAlert.reporterPhone}</strong></span>
                    </p>
                  )}
                  {activeAlert.reporterAddress && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">Lokasi: <strong className="text-white">{activeAlert.reporterAddress}</strong></span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveAlert(null)}
                className="border-zinc-200 dark:border-zinc-800"
              >
                Tutup Peringatan
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const targetUrl = `/tickets/${activeAlert.ticketId}`;
                  setActiveAlert(null);
                  router.push(targetUrl);
                }}
                className="bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-bold"
                leftIcon={<Zap className="h-3.5 w-3.5 fill-current" />}
              >
                Buka &amp; Kerjakan Tiket
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Help Modal when Notification Permission is Blocked ── */}
      <Modal
        open={permissionHelpOpen}
        onOpenChange={setPermissionHelpOpen}
        title="Cara Mengaktifkan Notifikasi Browser"
      >
        <div className="space-y-3 pt-2 text-xs text-zinc-600 dark:text-zinc-300">
          <p>
            Izin notifikasi sebelumnya telah diblokir di browser Anda. Ikuti langkah mudah berikut untuk mengizinkannya:
          </p>
          <ol className="list-decimal pl-4 space-y-1.5 font-medium text-zinc-800 dark:text-zinc-200">
            <li>Klik ikon <strong>Gembok (🔒)</strong> atau <strong>Setelan</strong> di sebelah kiri bilah alamat URL browser Anda.</li>
            <li>Cari menu <strong>Notifikasi / Notifications</strong>.</li>
            <li>Ubah status dari <em>Blokir / Block</em> menjadi <strong>Izinkan / Allow</strong>.</li>
            <li>Muat ulang (refresh) halaman ini.</li>
          </ol>
          <div className="pt-3 flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setPermissionHelpOpen(false);
                window.location.reload();
              }}
            >
              Saya Sudah Mengizinkan, Muat Ulang
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
