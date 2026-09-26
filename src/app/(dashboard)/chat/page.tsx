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
  User,
  ArrowLeft,
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
  const [mobileChatOpen, setMobileChatOpen] = React.useState(false);
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

  // Load messages when selectedRoomId changes
  React.useEffect(() => {
    if (selectedRoomId) {
      fetchMessages(selectedRoomId);
    }
  }, [selectedRoomId, fetchMessages]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 3. Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !inputMessage.trim() || isSending) return;

    const trimmed = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengirim pesan");
      }

      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      fetchRooms(true);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
      setInputMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      String(r.ticketNumber).includes(q) ||
      r.department?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6.5rem)] rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs dark:border-zinc-800 dark:bg-black">
      {/* Chat Top Banner */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black shadow-xs shrink-0">
            <MessagesSquare className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
              Ruang Chat Tim Departemen
              <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.2 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hidden sm:inline">
                Internal
              </span>
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate hidden sm:block">
              Saluran koordinasi tertutup khusus admin dan teknisi per tiket
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchRooms(false);
            if (selectedRoomId) fetchMessages(selectedRoomId, false);
          }}
          isLoading={isLoadingRooms}
          leftIcon={<RefreshCw className="h-3 w-3" />}
          className="text-xs shrink-0"
        >
          Segarkan
        </Button>
      </div>

      {/* 2-Column Responsive Chat Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Channels / Rooms List */}
        <div
          className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/40 dark:bg-zinc-950/40 shrink-0 ${
            mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search Box */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari tiket atau departemen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:focus:border-white"
              />
            </div>
          </div>

          {/* Rooms Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {isLoadingRooms ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                Tidak ada obrolan tiket yang tersedia.
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = room.ticketId === selectedRoomId;
                return (
                  <button
                    key={room.ticketId}
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(room.ticketId);
                      setMobileChatOpen(true);
                    }}
                    className={`w-full p-3 text-left transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? "bg-zinc-100/90 border-l-2 border-black dark:bg-zinc-900 dark:border-white"
                        : "hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        #{room.ticketNumber}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatRelativeTime(room.updatedAt)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {room.title}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-200/70 px-1.5 py-0.2 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        <Building2 className="h-2.5 w-2.5" />
                        {room.department?.name || "Umum"}
                      </span>
                      <StatusBadge status={room.status} size="sm" dot={false} />
                    </div>

                    {room.lastMessage ? (
                      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {room.lastMessage.authorName}:
                        </span>{" "}
                        {room.lastMessage.content}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-400 italic">
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
        <div
          className={`flex-1 flex flex-col bg-white dark:bg-black min-w-0 ${
            !mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedRoomId && activeTicket ? (
            <>
              {/* Room Header */}
              <div className="flex items-center justify-between p-3 sm:p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile Back to List Button */}
                  <button
                    type="button"
                    onClick={() => setMobileChatOpen(false)}
                    className="flex md:hidden h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 shrink-0"
                    aria-label="Kembali ke Daftar"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 shrink-0">
                        #{activeTicket.ticketNumber}
                      </span>
                      <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px] sm:max-w-xs">
                        {activeTicket.title}
                      </h2>
                      <StatusBadge status={activeTicket.status} size="sm" />
                      <PriorityBadge priority={activeTicket.priority} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      <span className="flex items-center gap-1 truncate">
                        <Building2 className="h-3 w-3 text-zinc-400 shrink-0" />
                        {activeTicket.department?.name || "Umum"}
                      </span>
                      {activeTicket.assignee && (
                        <span className="flex items-center gap-1 truncate hidden sm:flex">
                          <User className="h-3 w-3 text-zinc-400 shrink-0" />
                          {activeTicket.assignee.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/tickets/${selectedRoomId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-black hover:underline dark:text-white shrink-0"
                >
                  <span className="hidden sm:inline">Detail Tiket</span> <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingMessages ? (
                  <div className="flex h-48 items-center justify-center">
                    <Spinner size="md" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-zinc-400">
                    <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Ruang Obrolan Internal Tiket #{activeTicket.ticketNumber}
                    </p>
                    <p className="text-[11px] max-w-sm">
                      Kirim pesan pertama untuk berkoordinasi dengan admin dan rekan teknisi di departemen {activeTicket.department?.name || "terkait"}.
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
                          className="h-6 w-6 text-[9px] mt-0.5 shrink-0 border border-zinc-200 dark:border-zinc-800"
                        />

                        <div
                          className={`max-w-[75%] rounded-xl p-3 shadow-xs space-y-1 ${
                            isMe
                              ? "bg-black text-white dark:bg-white dark:text-black"
                              : "bg-zinc-100 text-zinc-900 border border-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-bold ${
                                  isMe ? "text-zinc-200 dark:text-zinc-800" : "text-zinc-800 dark:text-zinc-200"
                                }`}
                              >
                                {msg.author?.name}
                              </span>
                              <span
                                className={`rounded px-1 py-0.2 text-[9px] font-semibold ${
                                  isAdmin
                                    ? isMe
                                      ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : isMe
                                    ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {isAdmin ? "ADMIN" : "TEKNISI"}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-mono ${
                                isMe ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-400"
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
                className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Ketik pesan internal untuk tim ${activeTicket.department?.name || ""}...`}
                  disabled={isSending}
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:focus:border-white"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={!inputMessage.trim() || isSending}
                  isLoading={isSending}
                  leftIcon={<Send className="h-3 w-3" />}
                  className="shrink-0 text-xs"
                >
                  Kirim
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-6 text-zinc-400 space-y-2">
              <MessagesSquare className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Pilih salah satu tiket di sebelah kiri untuk membuka obrolan tim.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
