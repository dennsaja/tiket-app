"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatDateTime, formatFileSize } from "@/lib/utils";
import { Lock, Download, Paperclip, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface Message {
  id: string;
  content: string;
  type: "public" | "internal_note";
  isFirstResponse?: boolean;
  createdAt: string | Date;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  };
  attachments?: Attachment[];
}

interface ConversationProps {
  ticket: {
    id: string;
    title: string;
    description: string;
    createdAt: string | Date;
    requester: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      role: string;
    };
    attachments?: Attachment[];
  };
  messages: Message[];
}

export function Conversation({ ticket, messages }: ConversationProps) {
  return (
    <div className="space-y-4">
      {/* Original Ticket Description Card (Vercel Style) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-black">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 gap-2">
          <div className="flex items-center gap-3">
            <Avatar
              name={ticket.requester?.name || "Requester"}
              src={ticket.requester?.avatarUrl}
              size="md"
              className="border border-zinc-200 dark:border-zinc-800"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                  {ticket.requester?.name}
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0 capitalize">
                  {ticket.requester?.role === "admin" ? "Admin" : ticket.requester?.role === "agent" ? "Teknisi" : "Pelapor"}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                {formatDateTime(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})
              </p>
            </div>
          </div>
          <Badge variant="indigo" className="text-[10px] font-mono self-start sm:self-auto">
            Laporan Awal
          </Badge>
        </div>

        <div className="pt-4 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {ticket.description}
        </div>

        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <p className="text-[11px] font-medium text-zinc-500 mb-2 flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> Lampiran Berkas ({ticket.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {ticket.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/attachments/${att.id}`}
                  download={att.originalName}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="font-medium truncate max-w-[160px]">{att.originalName}</span>
                  <span className="text-zinc-400 text-[10px] font-mono">({formatFileSize(att.size)})</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message Timeline */}
      {messages.map((msg) => {
        const isInternal = msg.type === "internal_note";
        return (
          <div
            key={msg.id}
            className={cn(
              "rounded-xl border p-4.5 shadow-xs transition-all",
              isInternal
                ? "border-amber-300/80 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black"
            )}
          >
            <div className="flex items-start justify-between border-b pb-2.5 border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={msg.author.name}
                  src={msg.author.avatarUrl}
                  size="sm"
                  className="border border-zinc-200 dark:border-zinc-800"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {msg.author.name}
                    </span>
                    <Badge
                      variant={
                        msg.author.role === "admin"
                          ? "purple"
                          : msg.author.role === "agent"
                          ? "indigo"
                          : "default"
                      }
                      className="text-[10px] px-1 py-0 capitalize"
                    >
                      {msg.author.role === "admin" ? "Administrator" : msg.author.role === "agent" ? "Teknisi" : "Pelapor"}
                    </Badge>
                    {msg.isFirstResponse && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 rounded-full px-1.5 py-0.2">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Respons Pertama
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {formatDateTime(msg.createdAt)} ({formatRelativeTime(msg.createdAt)})
                  </p>
                </div>
              </div>

              {isInternal ? (
                <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100/80 border border-amber-300 rounded-full px-2 py-0.5 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                  <Lock className="h-3 w-3" />
                  <span>Catatan Internal</span>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-400">Balasan Publik</span>
              )}
            </div>

            <div className="pt-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>

            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
                <div className="flex flex-wrap gap-2">
                  {msg.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/attachments/${att.id}`}
                      download={att.originalName}
                      className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50/50 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Download className="h-3 w-3 text-zinc-400" />
                      <span className="truncate max-w-[140px]">{att.originalName}</span>
                      <span className="text-zinc-400 text-[10px] font-mono">({formatFileSize(att.size)})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
