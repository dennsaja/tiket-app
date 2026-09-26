"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Conversation } from "@/components/tickets/conversation";
import { ReplyComposer } from "@/components/tickets/reply-composer";
import { SlaPanel } from "@/components/tickets/sla-panel";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Building2,
  FolderOpen,
  User,
  Mail,
  Phone,
  Tag as TagIcon,
  RefreshCw,
  Clock,
  Share2,
  Check,
  MapPin,
  ExternalLink,
  Info,
  MessagesSquare,
} from "lucide-react";
import toast from "react-hot-toast";

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const ticketId = params.id as string;

  const [ticket, setTicket] = React.useState<any>(null);
  const [agents, setAgents] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchTicket = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Tiket tidak ditemukan");
        if (res.status === 403) throw new Error("Anda tidak memiliki izin untuk melihat tiket ini");
        throw new Error("Gagal memuat informasi tiket");
      }
      const data = await res.json();
      setTicket(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat tiket");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [ticketId]);

  const handleShareTicket = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Link tiket berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Gagal menyalin link tiket");
    }
  };

  const fetchAgents = React.useCallback(async () => {
    try {
      const res = await fetch("/api/users?role=agent&perPage=50");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.data || []);
      }
    } catch {
      // Agents listing optional for non-admins
    }
  }, []);

  React.useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTicket();
      const userRole = (session?.user as any)?.role;
      if (userRole === "admin" || userRole === "agent") {
        fetchAgents();
      }
    }
  }, [authStatus, fetchTicket, fetchAgents, session]);

  if (authStatus === "loading" || isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <h2 className="text-base font-semibold text-red-800 dark:text-red-400">Gagal Membuka Tiket</h2>
        <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error || "Tiket tidak ditemukan"}</p>
        <div className="mt-4">
          <Link href="/tickets">
            <Button size="sm" variant="outline">
              Kembali ke Daftar Tiket
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentUser = session?.user;
  const userRole = (currentUser as any)?.role || "user";
  const userId = currentUser?.id || "";
  const isAgentOrAdmin = userRole === "agent" || userRole === "admin";
  const isRequester = ticket.requesterId === userId;
  const isSharedViewer = !isAgentOrAdmin && !isRequester;
  const isClosedOrCancelled = ticket.status === "closed" || ticket.status === "cancelled";

  return (
    <div className="space-y-4">
      {/* Top Bar Navigation & Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/tickets">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div className="h-4 w-px bg-gray-300" />
          <span className="font-mono text-xs font-semibold text-gray-500">
            #{ticket.ticketNumber}
          </span>
          <StatusBadge status={ticket.status} size="md" />
          <PriorityBadge priority={ticket.priority} size="md" />
          {isSharedViewer && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              <Info className="h-3 w-3" /> Shared Link Viewer
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAgentOrAdmin && (
            <Link href="/chat">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<MessagesSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                className="text-xs text-indigo-700 bg-indigo-50/50 border-indigo-200 hover:bg-indigo-100 dark:bg-slate-800 dark:text-indigo-300 dark:border-slate-700"
              >
                Department Chat
              </Button>
            </Link>
          )}

          {/* Share Ticket Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShareTicket}
            leftIcon={
              copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )
            }
            className="text-xs"
          >
            {copied ? "Link Disalin!" : "Share Ticket"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchTicket();
            }}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="text-xs text-gray-500"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Title Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
        <h1 className="text-lg font-bold text-gray-900 leading-snug">
          {ticket.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400" />
            Reported by <strong className="text-gray-700">{ticket.requester?.name}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            {formatDateTime(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})
          </span>
          {ticket.department && (
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              {ticket.department.name}
            </span>
          )}
          {ticket.category && (
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
              {ticket.category.name}
              {ticket.subcategory && ` / ${ticket.subcategory.name}`}
            </span>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Column (2 cols): Conversation & Reply Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Conversation
            ticket={ticket}
            messages={ticket.messages || []}
          />

          <ReplyComposer
            ticketId={ticket.id}
            isAgentOrAdmin={isAgentOrAdmin}
            onMessageSent={fetchTicket}
            disabled={isClosedOrCancelled}
          />
        </div>

        {/* Right Column (1 col): Ticket Properties, SLA, Timeline & Actions */}
        <div className="space-y-4">
          {/* Actions Panel */}
          <TicketActions
            ticketId={ticket.id}
            currentStatus={ticket.status}
            currentPriority={ticket.priority}
            currentAssigneeId={ticket.assigneeId}
            currentUserId={userId}
            userRole={userRole}
            agents={agents}
            onActionComplete={fetchTicket}
          />

          {/* SLA Targets */}
          <SlaPanel
            firstResponseDue={ticket.slaFirstResponseDue}
            firstResponseAt={ticket.slaFirstResponseAt}
            resolutionDue={ticket.slaResolutionDue}
            resolvedAt={ticket.resolvedAt || ticket.slaResolvedAt}
            createdAt={ticket.createdAt}
            policyName={ticket.slaPolicy?.name}
          />

          {/* Ticket Metadata Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-100 pb-2">
              Ticket Information
            </h3>

            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <dt className="text-gray-500">Requester</dt>
                <dd className="font-medium text-gray-900 flex items-center gap-1.5">
                  <Avatar
                    name={ticket.requester?.name || "User"}
                    src={ticket.requester?.avatarUrl}
                    size="sm"
                    className="h-4 w-4 text-[8px]"
                  />
                  <span>{ticket.requester?.name}</span>
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-50">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-mono text-gray-700 select-all">
                  {ticket.requester?.email}
                </dd>
              </div>

              {ticket.requester?.phone && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-700">{ticket.requester.phone}</dd>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-gray-50">
                <dt className="text-gray-500">Assignee</dt>
                <dd className="font-medium text-gray-900 flex items-center gap-1.5">
                  {ticket.assignee ? (
                    <>
                      <Avatar
                        name={ticket.assignee.name}
                        src={ticket.assignee.avatarUrl}
                        size="sm"
                        className="h-4 w-4 text-[8px]"
                      />
                      <span>{ticket.assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">Unassigned</span>
                  )}
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-50">
                <dt className="text-gray-500">Department</dt>
                <dd className="text-gray-900">
                  {ticket.department?.name || "General"}
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-50">
                <dt className="text-gray-500">Category</dt>
                <dd className="text-gray-900">
                  {ticket.category?.name || "None"}
                </dd>
              </div>

              {ticket.resolution && (
                <div className="pt-2 border-t border-green-100 bg-green-50/50 p-2.5 rounded">
                  <dt className="font-semibold text-green-900 text-xs mb-1">
                    Resolution Summary:
                  </dt>
                  <dd className="text-green-800 text-xs whitespace-pre-wrap">
                    {ticket.resolution}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Informasi Pelapor & Lokasi Card (Hanya tampil jika ada data) */}
          {(ticket.reporterName || ticket.reporterAddress || ticket.reporterMapUrl) && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-4 shadow-xs space-y-3 dark:border-indigo-900/40 dark:bg-slate-800/80">
              <div className="flex items-center gap-1.5 border-b border-indigo-100 dark:border-slate-700 pb-2">
                <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  Informasi Pelapor & Lokasi
                </h3>
              </div>

              <dl className="space-y-2.5 text-xs">
                {ticket.reporterName && (
                  <div>
                    <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Nama Pelapor
                    </dt>
                    <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-200">
                      {ticket.reporterName}
                    </dd>
                  </div>
                )}

                {ticket.reporterAddress && (
                  <div>
                    <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      Alamat Tertulis
                    </dt>
                    <dd className="mt-0.5 text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {ticket.reporterAddress}
                    </dd>
                  </div>
                )}

                {ticket.reporterMapUrl && (
                  <div className="pt-1.5 border-t border-indigo-100/60 dark:border-slate-700">
                    <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      Lokasi Google Maps
                    </dt>
                    <a
                      href={ticket.reporterMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka Rute di Google Maps
                    </a>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Activity Timeline */}
          <TicketTimeline
            statusHistory={ticket.statusHistory}
            assignmentHistory={ticket.assignmentHistory}
          />
        </div>
      </div>
    </div>
  );
}
