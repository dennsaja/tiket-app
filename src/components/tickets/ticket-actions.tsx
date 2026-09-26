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
  AlertTriangle,
  Send,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

interface UserOption {
  id: string;
  name: string;
}

interface TicketActionsProps {
  ticketId: string;
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
  const [resolutionText, setResolutionText] = React.useState("");

  const isAgentOrAdmin = userRole === "agent" || userRole === "admin";
  const isAdmin = userRole === "admin";

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
        throw new Error(err.error || "Failed to update status");
      }

      toast.success(`Status updated to ${newStatus}`);
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to update priority");
      }

      toast.success(`Priority updated to ${newPriority}`);
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
        throw new Error(err.error || "Failed to assign ticket");
      }

      toast.success("Ticket assignment updated");
      onActionComplete();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignToMe = () => {
    handleAssignChange(currentUserId);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete ticket");
      }

      toast.success("Ticket deleted successfully");
      window.location.href = "/tickets";
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-4">
      <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-100 pb-2">
        Kelola Tiket
      </h3>

      {isAgentOrAdmin ? (
        <div className="space-y-3">
          {/* Quick Assign to me */}
          {currentAssigneeId !== currentUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAssignToMe}
              isLoading={isUpdating}
              leftIcon={<UserCheck className="h-3.5 w-3.5 text-indigo-600" />}
              className="w-full text-xs justify-center"
            >
              Tugaskan ke Saya
            </Button>
          )}

          {/* Assignee select */}
          {agents.length > 0 && (
            <Select
              label="Teknisi / Assignee"
              value={currentAssigneeId || "unassigned"}
              onValueChange={handleAssignChange}
              options={[
                { value: "unassigned", label: "Belum Ditugaskan" },
                ...agents.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}

          {/* Status select */}
          <Select
            label="Ubah Status"
            value={currentStatus}
            onValueChange={(val) => {
              if (val === "resolved") {
                setResolveModalOpen(true);
              } else {
                handleStatusChange(val);
              }
            }}
            options={[
              { value: "open", label: "Baru" },
              { value: "assigned", label: "Ditugaskan" },
              { value: "in_progress", label: "Sedang Dikerjakan" },
              { value: "pending", label: "Tertunda" },
              { value: "waiting_for_user", label: "Menunggu Respons User" },
              { value: "resolved", label: "Selesai" },
              { value: "closed", label: "Ditutup" },
              { value: "reopened", label: "Dibuka Kembali" },
              { value: "cancelled", label: "Dibatalkan" },
            ]}
          />

          {/* Priority select */}
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

          {/* Action buttons */}
          <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5">
            {currentStatus !== "resolved" && currentStatus !== "closed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolveModalOpen(true)}
                leftIcon={<CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                className="w-full text-xs justify-center text-green-700 hover:bg-green-50 hover:border-green-300"
              >
                Selesaikan Tiket
              </Button>
            )}

            {currentStatus === "resolved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("closed")}
                leftIcon={<CheckCircle className="h-3.5 w-3.5 text-gray-600" />}
                className="w-full text-xs justify-center"
              >
                Tutup Tiket
              </Button>
            )}

            {(currentStatus === "closed" || currentStatus === "resolved") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("reopened")}
                leftIcon={<RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                className="w-full text-xs justify-center text-amber-700 hover:bg-amber-50"
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
                leftIcon={<CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                className="w-full text-xs justify-center text-green-700 hover:bg-green-50"
              >
                Konfirmasi &amp; Tutup Tiket
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("reopened")}
                leftIcon={<RotateCcw className="h-3.5 w-3.5 text-amber-600" />}
                className="w-full text-xs justify-center text-amber-700 hover:bg-amber-50"
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
              className="w-full text-xs justify-center text-red-600 hover:bg-red-50"
            >
              Batalkan Tiket
            </Button>
          )}
        </div>
      )}

      {/* Resolve Ticket Modal with Resolution Description */}
      <Modal
        open={resolveModalOpen}
        onOpenChange={setResolveModalOpen}
        title="Selesaikan Tiket"
        description="Berikan ringkasan solusi yang menjelaskan bagaimana kendala diperbaiki."
      >
        <div className="space-y-3 pt-2">
          <Textarea
            label="Rincian Solusi &amp; Penyelesaian"
            value={resolutionText}
            onChange={(e) => setResolutionText(e.target.value)}
            placeholder="Jelaskan solusi atau perbaikan yang telah dilakukan untuk pelapor..."
            rows={4}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResolveModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => handleStatusChange("resolved", resolutionText)}
              isLoading={isUpdating}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Konfirmasi Selesai
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
