"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  UserCheck,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trash2,
  CheckCircle2,
  MapPin,
  Play,
  FileText,
  Clock,
  Send,
  ShieldAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { WorkReportModal } from "@/components/tickets/work-report-modal";
import toast from "react-hot-toast";

interface UserOption {
  id: string;
  name: string;
}

interface TicketActionsProps {
  ticketId: string;
  ticketNumber?: number;
  currentStatus: string;
  currentPriority: string;
  currentAssigneeId?: string | null;
  currentUserId: string;
  userRole: string;
  agents?: UserOption[];
  onActionComplete: () => void;
}

export function TicketActions({
  ticketId,
  ticketNumber = 0,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  currentUserId,
  userRole,
  agents = [],
  onActionComplete,
}: TicketActionsProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [resolveModalOpen, setResolveModalOpen] = React.useState(false);
  const [workReportModalOpen, setWorkReportModalOpen] = React.useState(false);
  const [resolutionText, setResolutionText] = React.useState("");

  const isNoc = userRole === "noc";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || isNoc || isOwner;
  const isAgent = userRole === "agent";
  const isStaff = isAdmin || isAgent;

  const handleStatusChange = async (newStatus: string, resolution?: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolution,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui status");
      }

      toast.success("Status tiket berhasil diperbarui");
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
      setResolveModalOpen(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui prioritas");
      }

      toast.success("Prioritas tiket berhasil diperbarui");
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignChange = async (newAssigneeId: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeId: newAssigneeId === "unassigned" ? null : newAssigneeId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menugaskan tiket");
      }

      toast.success("Penugasan teknisi berhasil diperbarui");
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignToMe = () => {
    handleAssignChange(currentUserId);
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus tiket ini? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus tiket");
      }

      toast.success("Tiket berhasil dihapus");
      window.location.href = "/tickets";
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-4">
        <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center justify-between">
          <span>Tindakan &amp; Alur Pengerjaan</span>
          <span className="text-[10px] font-mono uppercase bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
            {currentStatus}
          </span>
        </h3>

        {/* ─── TECHNICIAN STEP-BY-STEP WORKFLOW BAR ─── */}
        {isStaff && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-2">
            <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
              Alur Kerja Teknisi:
            </p>

            <div className="flex flex-col gap-1.5">
              {/* Step 1: Diterima */}
              {(currentStatus === "open" || currentStatus === "assigned") && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("accepted")}
                  isLoading={isUpdating}
                  leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-cyan-600" />}
                  className="w-full text-xs justify-center bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  1. Terima Tugas (Accepted)
                </Button>
              )}

              {/* Step 2: Tiba di Lokasi */}
              {currentStatus === "accepted" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("on_site")}
                  isLoading={isUpdating}
                  leftIcon={<MapPin className="h-3.5 w-3.5 text-indigo-400" />}
                  className="w-full text-xs justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  2. Tiba di Lokasi (On-Site)
                </Button>
              )}

              {/* Step 3: Mulai Pengerjaan */}
              {currentStatus === "on_site" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("in_progress")}
                  isLoading={isUpdating}
                  leftIcon={<Play className="h-3.5 w-3.5 text-purple-400" />}
                  className="w-full text-xs justify-center bg-purple-600 hover:bg-purple-700 text-white"
                >
                  3. Mulai Pengerjaan (In-Progress)
                </Button>
              )}

              {/* Step 4: Laporan Kerja & Selesai */}
              {currentStatus === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => setWorkReportModalOpen(true)}
                  leftIcon={<FileText className="h-3.5 w-3.5 text-emerald-400" />}
                  className="w-full text-xs justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  4. Kirim Laporan Kerja (Selesai)
                </Button>
              )}

              {/* Step 5: Tutup Tiket (Admin/NOC) */}
              {currentStatus === "resolved" && isAdmin && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("closed")}
                  isLoading={isUpdating}
                  leftIcon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                  className="w-full text-xs justify-center"
                >
                  5. Verifikasi &amp; Tutup Tiket
                </Button>
              )}
            </div>
          </div>
        )}

        {isStaff ? (
          <div className="space-y-3">
            {/* Quick Assign to me */}
            {currentAssigneeId !== currentUserId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssignToMe}
                isLoading={isUpdating}
                leftIcon={<UserCheck className="h-3.5 w-3.5" />}
                className="w-full text-xs justify-center"
              >
                Tugaskan ke Saya
              </Button>
            )}

            {/* Assignee select for Admin */}
            {isAdmin && agents.length > 0 && (
              <Select
                label="Teknisi Utama / Lead"
                value={currentAssigneeId || "unassigned"}
                onValueChange={handleAssignChange}
                options={[
                  { value: "unassigned", label: "Belum Ditugaskan" },
                  ...agents.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            )}

            {/* Status select for manual override */}
            <Select
              label="Ubah Status Tiket"
              value={currentStatus}
              onValueChange={(val) => {
                if (val === "resolved") {
                  setWorkReportModalOpen(true);
                } else {
                  handleStatusChange(val);
                }
              }}
              options={[
                { value: "open", label: "Baru (Open)" },
                { value: "assigned", label: "Ditugaskan (Assigned)" },
                { value: "accepted", label: "Tugas Diterima (Accepted)" },
                { value: "on_site", label: "Tiba di Lokasi (On-Site)" },
                { value: "in_progress", label: "Sedang Dikerjakan (In Progress)" },
                { value: "pending", label: "Tertunda (Pending)" },
                { value: "waiting_for_user", label: "Menunggu Respons Pelapor" },
                { value: "resolved", label: "Laporan Kerja Selesai (Resolved)" },
                { value: "closed", label: "Ditutup (Closed)" },
                { value: "reopened", label: "Dibuka Kembali (Reopened)" },
                { value: "cancelled", label: "Dibatalkan (Cancelled)" },
              ]}
            />

            {/* Priority select */}
            {isAdmin && (
              <Select
                label="Tingkat Prioritas"
                value={currentPriority}
                onValueChange={handlePriorityChange}
                options={[
                  { value: "critical", label: "Kritis" },
                  { value: "high", label: "Tinggi" },
                  { value: "medium", label: "Sedang" },
                  { value: "low", label: "Rendah" },
                ]}
              />
            )}

            {/* Action buttons */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-1.5">
              {(currentStatus === "closed" || currentStatus === "resolved") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("reopened")}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                  className="w-full text-xs justify-center hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  Buka Kembali Tiket
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  className="w-full text-xs justify-center mt-2"
                >
                  Hapus Tiket
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Regular User Actions */
          <div className="space-y-2">
            {currentStatus === "resolved" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("closed")}
                  leftIcon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                  className="w-full text-xs justify-center hover:bg-emerald-50"
                >
                  Konfirmasi &amp; Tutup Tiket
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("reopened")}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                  className="w-full text-xs justify-center hover:bg-amber-50"
                >
                  Masalah Belum Tuntas (Buka Kembali)
                </Button>
              </>
            )}

            {currentStatus === "open" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("cancelled")}
                leftIcon={<XCircle className="h-3.5 w-3.5 text-red-600" />}
                className="w-full text-xs justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Batalkan Tiket
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Work Report Modal with Before & After Photo Upload / Camera */}
      <WorkReportModal
        ticketId={ticketId}
        ticketNumber={ticketNumber}
        isOpen={workReportModalOpen}
        onClose={() => setWorkReportModalOpen(false)}
        onReportSubmitted={onActionComplete}
      />
    </>
  );
}
