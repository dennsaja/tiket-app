"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { TicketTypeBadge } from "@/components/tickets/ticket-type-badge";
import { Conversation } from "@/components/tickets/conversation";
import { ReplyComposer } from "@/components/tickets/reply-composer";
import { SlaPanel } from "@/components/tickets/sla-panel";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
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
  Users,
  Star,
  Layers,
  FileCheck2,
  Image as ImageIcon,
  CheckCircle2,
  CheckCheck,
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
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

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
      if (userRole === "admin" || userRole === "agent" || userRole === "noc" || userRole === "owner") {
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
  const isStaff = ["noc", "owner", "admin", "agent"].includes(userRole);
  const isRequester = ticket.requesterId === userId;
  const isSharedViewer = !isStaff && !isRequester;
  const isClosedOrCancelled = ticket.status === "closed" || ticket.status === "cancelled";

  const teamAssignees = ticket.assignees || [];
  const workReports = ticket.workReports || [];
  const specData = ticket.specData || {};
  const hasSpecData = Object.keys(specData).length > 0;

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
          <TicketTypeBadge type={ticket.ticketType} size="md" fullLabel />
          <StatusBadge status={ticket.status} size="md" />
          <PriorityBadge priority={ticket.priority} size="md" />
          {isSharedViewer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
              <Info className="h-3 w-3" /> Penampil Link Bersama
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isStaff && (
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
            Dibuat oleh <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{ticket.requester?.name}</strong>
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
        {/* Left Column (2 cols): Laporan Kerja (if any), Conversation & Reply Composer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Laporan Kerja Teknisi Card (If Submitted) */}
          {workReports.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200/70 dark:border-emerald-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white shadow-xs">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Laporan Hasil Kerja Teknisi
                    </h3>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Diserahkan oleh {workReports[0]?.technician?.name || "Teknisi"} pada{" "}
                      {formatDateTime(workReports[0]?.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <CheckCheck className="h-3.5 w-3.5" /> Terverifikasi
                </span>
              </div>

              {/* Report Body Details */}
              <div className="space-y-3 text-xs text-emerald-950 dark:text-emerald-100">
                <div>
                  <h4 className="font-semibold text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Ringkasan Pekerjaan:
                  </h4>
                  <p className="mt-0.5 text-xs leading-relaxed bg-white/70 dark:bg-black/40 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 whitespace-pre-wrap">
                    {workReports[0]?.summary}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Tindakan yang Dilakukan:
                  </h4>
                  <p className="mt-0.5 text-xs leading-relaxed bg-white/70 dark:bg-black/40 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 whitespace-pre-wrap">
                    {workReports[0]?.actionTaken}
                  </p>
                </div>

                {(workReports[0]?.materialsUsed || workReports[0]?.finalResult) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {workReports[0]?.materialsUsed && (
                      <div>
                        <h4 className="font-semibold text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Material &amp; Perangkat:
                        </h4>
                        <p className="mt-0.5 text-xs bg-white/70 dark:bg-black/40 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                          {workReports[0].materialsUsed}
                        </p>
                      </div>
                    )}
                    {workReports[0]?.finalResult && (
                      <div>
                        <h4 className="font-semibold text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Hasil Akhir / Pengukuran:
                        </h4>
                        <p className="mt-0.5 text-xs bg-white/70 dark:bg-black/40 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40 font-mono">
                          {workReports[0].finalResult}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Before & After Photos Gallery */}
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50 space-y-3">
                  {/* Before Photos */}
                  {workReports[0]?.beforePhotos && workReports[0].beforePhotos.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Dokumentasi Sebelum Pengerjaan (Before):
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {workReports[0].beforePhotos.map((url: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewImage(url)}
                            className="relative rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 aspect-video bg-zinc-900 cursor-pointer hover:opacity-90 transition-opacity shadow-xs"
                          >
                            <img
                              src={url}
                              alt={`Before ${idx}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.2 rounded">
                              Before
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* After Photos */}
                  {workReports[0]?.afterPhotos && workReports[0].afterPhotos.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Dokumentasi Sesudah Pengerjaan (After):
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {workReports[0].afterPhotos.map((url: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewImage(url)}
                            className="relative rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 aspect-video bg-zinc-900 cursor-pointer hover:opacity-90 transition-opacity shadow-xs"
                          >
                            <img
                              src={url}
                              alt={`After ${idx}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 bg-emerald-800/80 text-white text-[9px] px-1.5 py-0.2 rounded">
                              After
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Conversation Thread */}
          <Conversation
            ticket={ticket}
            messages={ticket.messages || []}
          />

          {/* Reply Composer */}
          <ReplyComposer
            ticketId={ticket.id}
            isAgentOrAdmin={isStaff}
            onMessageSent={fetchTicket}
            disabled={isClosedOrCancelled}
          />
        </div>

        {/* Right Column (1 col): Ticket Properties, SLA, Timeline & Actions */}
        <div className="space-y-4">
          {/* Actions Panel */}
          <TicketActions
            ticketId={ticket.id}
            ticketNumber={ticket.ticketNumber}
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

          {/* Spesifikasi Teknis Dinamis Card */}
          {hasSpecData && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-zinc-500" />
                  <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Spesifikasi &amp; Data Teknis
                  </h3>
                </div>
                <TicketTypeBadge type={ticket.ticketType} size="sm" />
              </div>

              <dl className="space-y-2 text-xs">
                {Object.entries(specData).map(([key, val]) => {
                  if (!val || val === "") return null;
                  let formattedKey = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/_/g, " ")
                    .replace(/^\w/, (c) => c.toUpperCase());

                  if (key === "bandwidth") formattedKey = "Bandwidth / Paket";
                  else if (key === "ontModel") formattedKey = "Model ONT / Modem";
                  else if (key === "odpCode") formattedKey = "Kode ODP & Port";
                  else if (key === "cableLength") formattedKey = "Panjang Kabel Dropcore";
                  else if (key === "rxPower") formattedKey = "Indikasi Redaman (RX)";
                  else if (key === "issueType") formattedKey = "Jenis Gangguan";
                  else if (key === "cameraCount") formattedKey = "Jumlah Titik CCTV";
                  else if (key === "cameraType") formattedKey = "Tipe Kamera";
                  else if (key === "recorderType") formattedKey = "Perekam NVR / DVR";
                  else if (key === "symptom") formattedKey = "Gejala Kerusakan";
                  else if (key === "scope") formattedKey = "Ruang Lingkup";
                  else if (key === "period") formattedKey = "Periode Maintenance";
                  else if (key === "scheduledAt") formattedKey = "Jadwal Pemasangan";

                  return (
                    <div key={key} className="flex justify-between py-1 border-b border-zinc-50 dark:border-zinc-900">
                      <dt className="text-zinc-500">{formattedKey}</dt>
                      <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-right max-w-[55%] break-words">
                        {String(val)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          {/* Tim Teknisi yang Ditugaskan Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-black space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-500" />
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Tim Teknisi Ditugaskan
                </h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {teamAssignees.length > 0 ? `${teamAssignees.length} Teknisi` : "1 Teknisi"}
              </span>
            </div>

            {teamAssignees.length > 0 ? (
              <div className="space-y-2">
                {teamAssignees.map((item: any, idx: number) => (
                  <div
                    key={item.user?.id || idx}
                    className="flex items-center justify-between p-2 rounded-lg border border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={item.user?.name || "Tech"}
                        src={item.user?.avatarUrl}
                        size="sm"
                        className="h-6 w-6 text-[10px] border border-zinc-200 dark:border-zinc-700"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.user?.name}
                        </p>
                        {item.user?.phone && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {item.user.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.isLead && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Lead
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : ticket.assignee ? (
              <div className="flex items-center justify-between p-2 rounded-lg border border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={ticket.assignee.name}
                    src={ticket.assignee.avatarUrl}
                    size="sm"
                    className="h-6 w-6 text-[10px]"
                  />
                  <div>
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {ticket.assignee.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">{ticket.assignee.email}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Lead
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic py-1">Belum ada teknisi yang ditugaskan</p>
            )}
          </div>

          {/* Informasi Pelapor & Lokasi Card */}
          {(ticket.reporterName || ticket.reporterPhone || ticket.reporterAddress || ticket.reporterMapUrl) && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4.5 shadow-xs space-y-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <User className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Informasi Pelapor &amp; Lokasi On-Site
                </h3>
              </div>

              <dl className="space-y-2.5 text-xs">
                {ticket.reporterName && (
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Nama Pelapor / PIC
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-200">
                      {ticket.reporterName}
                    </dd>
                  </div>
                )}

                {ticket.reporterPhone && (
                  <div>
                    <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-zinc-400" />
                      Telepon / WhatsApp
                    </dt>
                    <dd className="mt-0.5 font-mono text-zinc-900 dark:text-zinc-200">
                      <a href={`tel:${ticket.reporterPhone}`} className="hover:underline text-blue-600 dark:text-blue-400">
                        {ticket.reporterPhone}
                      </a>
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
                      className="inline-flex items-center gap-1.5 rounded-md bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs dark:bg-white dark:text-black dark:hover:bg-zinc-200 w-full justify-center"
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

      {/* Lightbox Modal for Photo Previews */}
      {previewImage && (
        <Modal
          open={Boolean(previewImage)}
          onOpenChange={() => setPreviewImage(null)}
          title="Dokumentasi Foto Pekerjaan"
          description="Tampilan resolusi penuh foto dokumentasi lapangan."
          className="max-w-4xl"
        >
          <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[80vh]">
            <img
              src={previewImage}
              alt="Preview Full"
              className="max-h-[75vh] w-auto object-contain"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
