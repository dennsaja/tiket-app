"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import {
  MessagesSquare,
  Send,
  Search,
  RefreshCw,
  Lock,
  ExternalLink,
  Building2,
  Clock,
  Shield,
  User,
  Paperclip,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

interface ChatRoom {
  ticketId: string;
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  department: { name: string; color?: string };
  assignee?: { name: string; avatarUrl?: string } | null;
  requester?: { name: string; avatarUrl?: string } | null;
  reporterName?: string | null;
  lastMessage?: {
    content: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
  } | null;
  updatedAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    role: string;
  };
}

export default function DepartmentChatPage() {
  const { data: session, status: authStatus } = useSession();
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [activeTicket, setActiveTicket] = React.useState<any>(null);
  const [inputMessage, setInputMessage] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoadingRooms, setIsLoadingRooms] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const currentUser = session?.user;
  const currentUserId = currentUser?.id || "";
  const userRole = (currentUser as any)?.role || "user";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Fetch Rooms List
  const fetchRooms = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoadingRooms(true);
    try {
      const res = await fetch("/api/chat/rooms");
      if (!res.ok) throw new Error("Gagal memuat daftar obrolan department");
      const data = await res.json();
      setRooms(data || []);
      // Select first room if none selected
      if (!selectedRoomId && data?.length > 0) {
        setSelectedRoomId(data[0].ticketId);
      }
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Gagal memuat obrolan");
    } finally {
      if (!silent) setIsLoadingRooms(false);
    }
  }, [selectedRoomId]);

  // 2. Fetch Messages for Selected Room
  const fetchMessages = React.useCallback(
    async (ticketId: string, silent = false) => {
      if (!silent) setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/chat/rooms/${ticketId}`);
        if (!res.ok) throw new Error("Gagal memuat pesan obrolan");
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveTicket(data.ticket);
      } catch (err: any) {
        if (!silent) toast.error(err.message || "Gagal memuat pesan");
      } finally {
        if (!silent) setIsLoadingMessages(false);
      }
    },
    []
  );

  // Initial load
  React.useEffect(() => {
    if (authStatus === "authenticated") {
      fetchRooms();
    }
  }, [authStatus, fetchRooms]);

  // Load messages when selected room changes
  React.useEffect(() => {
    if (selectedRoomId) {
      fetchMessages(selectedRoomId);
    }
  }, [selectedRoomId, fetchMessages]);

  // Auto-scroll when messages change
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Background polling for live messages every 4 seconds
  React.useEffect(() => {
    if (!selectedRoomId) return;
    const interval = setInterval(() => {
      fetchMessages(selectedRoomId, true);
      fetchRooms(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedRoomId, fetchMessages, fetchRooms]);

  // 3. Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !selectedRoomId || isSending) return;

    const content = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mengirim pesan");
      }

      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      fetchRooms(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan");
      setInputMessage(content); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  // Filter rooms by search
  const filteredRooms = React.useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ticketNumber.toString().includes(q) ||
        r.department?.name?.toLowerCase().includes(q) ||
        r.reporterName?.toLowerCase().includes(q)
    );
  }, [rooms, searchQuery]);

  if (authStatus === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (userRole !== "admin" && userRole !== "agent") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
        <Shield className="h-8 w-8 text-red-600 mx-auto" />
        <h2 className="mt-2 text-base font-semibold text-red-900 dark:text-red-300">
          Akses Terbatas
        </h2>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          Halaman Obrolan Department hanya dapat diakses oleh Administrator dan Teknisi/Agent terkait.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col rounded-lg border border-gray-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              Chat Tim Departemen
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
                <Lock className="h-2.5 w-2.5" /> Khusus Admin &amp; Anggota Dept
              </span>
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Setiap tiket baru memiliki ruang koordinasi internal otomatis untuk teknisi &amp; admin.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            fetchRooms();
            if (selectedRoomId) fetchMessages(selectedRoomId);
          }}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          className="text-xs text-gray-500"
        >
          Segarkan
        </Button>
      </div>

      {/* 2-Column Chat Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Channels / Rooms List */}
        <div className="w-80 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50/30 dark:bg-slate-900/50">
          {/* Search Box */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-800">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari tiket atau department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Rooms Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
            {isLoadingRooms ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Tidak ada obrolan tiket yang tersedia.
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.ticketId === selectedRoomId;
                return (
                  <button
                    key={room.ticketId}
                    type="button"
                    onClick={() => setSelectedRoomId(room.ticketId)}
                    className={`w-full p-3 text-left transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? "bg-indigo-50/80 border-l-4 border-indigo-600 dark:bg-slate-800"
                        : "hover:bg-gray-100/70 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                        #{room.ticketNumber}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(room.updatedAt)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                      {room.title}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="inline-flex items-center gap-1 rounded bg-gray-200/70 px-1.5 py-0.2 text-[10px] font-medium text-gray-700 dark:bg-slate-700 dark:text-gray-300">
                        <Building2 className="h-2.5 w-2.5" />
                        {room.department?.name || "General"}
                      </span>
                      <StatusBadge status={room.status} size="sm" dot={false} />
                    </div>

                    {room.lastMessage ? (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {room.lastMessage.authorName}:
                        </span>{" "}
                        {room.lastMessage.content}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-gray-400 italic">
                        Belum ada diskusi internal
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Room Messages */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {selectedRoomId && activeTicket ? (
            <>
              {/* Room Header */}
              <div className="flex items-center justify-between p-3.5 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      #{activeTicket.ticketNumber}
                    </span>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {activeTicket.title}
                    </h2>
                    <StatusBadge status={activeTicket.status} size="sm" />
                    <PriorityBadge priority={activeTicket.priority} size="sm" />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      Department:{" "}
                      <strong className="text-gray-800 dark:text-gray-200">
                        {activeTicket.department?.name || "General"}
                      </strong>
                    </span>
                    {activeTicket.assignee && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-gray-400" />
                        Teknisi:{" "}
                        <strong className="text-gray-800 dark:text-gray-200">
                          {activeTicket.assignee.name}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/tickets/${selectedRoomId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Detail Tiket <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {isLoadingMessages ? (
                  <div className="flex h-48 items-center justify-center">
                    <Spinner size="md" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-gray-400">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-slate-800 dark:text-indigo-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Ruang Obrolan Internal Tiket #{activeTicket.ticketNumber}
                    </p>
                    <p className="text-[11px] max-w-sm">
                      Kirim pesan pertama untuk berkoordinasi dengan admin dan rekan teknisi di department {activeTicket.department?.name || "terkait"}.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.author?.id === currentUserId;
                    const isAdmin = msg.author?.role === "admin";

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${
                          isMe ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <Avatar
                          name={msg.author?.name || "Staff"}
                          src={msg.author?.avatarUrl}
                          size="sm"
                          className="h-7 w-7 text-[10px] mt-0.5 shrink-0"
                        />

                        <div
                          className={`max-w-[75%] rounded-lg p-3 shadow-xs space-y-1 ${
                            isMe
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-900 dark:bg-slate-800 dark:text-gray-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-bold ${
                                  isMe ? "text-indigo-100" : "text-gray-800 dark:text-gray-200"
                                }`}
                              >
                                {msg.author?.name}
                              </span>
                              <span
                                className={`rounded px-1 py-0.2 text-[9px] font-semibold ${
                                  isAdmin
                                    ? isMe
                                      ? "bg-indigo-700 text-indigo-100"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : isMe
                                    ? "bg-indigo-700 text-indigo-100"
                                    : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
                                }`}
                              >
                                {isAdmin ? "ADMIN" : "AGENT"}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] ${
                                isMe ? "text-indigo-200" : "text-gray-400"
                              }`}
                            >
                              {formatDateTime(msg.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Ketik pesan internal untuk tim ${activeTicket.department?.name || ""}... (Tekan Enter untuk kirim)`}
                  disabled={isSending}
                  className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={!inputMessage.trim() || isSending}
                  isLoading={isSending}
                  leftIcon={<Send className="h-3.5 w-3.5" />}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  Kirim
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-gray-400 space-y-2">
              <MessagesSquare className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Pilih salah satu tiket di sebelah kiri untuk membuka obrolan tim.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
