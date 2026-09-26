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
  RefreshCw,
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
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <h2 className="text-sm font-semibold text-red-800 dark:text-red-400">Gagal Membuka Tiket</h2>
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
      {/* Top Bar Navigation & Status (Vercel Style) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-3.5 dark:border-zinc-800">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/tickets">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
              Kembali
            </Button>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            #{ticket.ticketNumber}
          </span>
          <StatusBadge status={ticket.status} size="md" />
          <PriorityBadge priority={ticket.priority} size="md" />
          {isSharedViewer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              <Info className="h-3 w-3" /> Penampil Link Bersama
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAgentOrAdmin && (
            <Link href="/chat">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<MessagesSquare className="h-3.5 w-3.5" />}
                className="text-xs"
              >
                Chat Tim
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
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )
            }
            className="text-xs"
          >
            {copied ? "Link Disalin!" : "Bagikan Tiket"}
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
            className="text-xs text-zinc-500"
          >
            Segarkan
          </Button>
        </div>
      </div>

      {/* Main Title Section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-snug">
          {ticket.title}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/80 pt-2.5">
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-zinc-400" />
            Dilaporkan oleh <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{ticket.requester?.name}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-mono">{formatDateTime(ticket.createdAt)}</span> ({formatRelativeTime(ticket.createdAt)})
          </span>
          {ticket.department && (
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-400" />
              {ticket.department.name}
            </span>
          )}
          {ticket.category && (
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-zinc-400" />
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
          <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
            <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Informasi Tiket
            </h3>

            <dl className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                <dt className="text-zinc-500">Pelapor</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Avatar
                    name={ticket.requester?.name || "User"}
                    src={ticket.requester?.avatarUrl}
                    size="sm"
                    className="h-4 w-4 text-[8px]"
                  />
                  <span>{ticket.requester?.name}</span>
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                <dt className="text-zinc-500">Email</dt>
                <dd className="font-mono text-zinc-700 dark:text-zinc-300 select-all">
                  {ticket.requester?.email}
                </dd>
              </div>

              {ticket.requester?.phone && (
                <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                  <dt className="text-zinc-500">Telepon</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300 font-mono">{ticket.requester.phone}</dd>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                <dt className="text-zinc-500">Teknisi</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
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
                    <span className="text-zinc-400 italic">Belum Ditugaskan</span>
                  )}
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                <dt className="text-zinc-500">Departemen</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {ticket.department?.name || "Umum"}
                </dd>
              </div>

              <div className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                <dt className="text-zinc-500">Kategori</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {ticket.category?.name || "Tidak Ada"}
                </dd>
              </div>

              {ticket.resolution && (
                <div className="pt-2 border-t border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-2.5 rounded-lg">
                  <dt className="font-semibold text-emerald-900 dark:text-emerald-300 text-xs mb-1">
                    Ringkasan Solusi:
                  </dt>
                  <dd className="text-emerald-800 dark:text-emerald-400 text-xs whitespace-pre-wrap">
                    {ticket.resolution}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Informasi Pelapor & Lokasi Card */}
          {(ticket.reporterName || ticket.reporterAddress || ticket.reporterMapUrl) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4.5 shadow-xs space-y-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <User className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Informasi Pelapor &amp; Lokasi
                </h3>
              </div>

              <dl className="space-y-2.5 text-xs">
                {ticket.reporterName && (
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Nama Pelapor
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-200">
                      {ticket.reporterName}
                    </dd>
                  </div>
                )}

                {ticket.reporterAddress && (
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-zinc-400" />
                      Alamat Tertulis
                    </dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {ticket.reporterAddress}
                    </dd>
                  </div>
                )}

                {ticket.reporterMapUrl && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-zinc-900 dark:text-zinc-100" />
                      Lokasi Google Maps
                    </dt>
                    <a
                      href={ticket.reporterMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs dark:bg-white dark:text-black dark:hover:bg-zinc-200"
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
