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
      {/* Original Ticket Description Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={ticket.requester?.name || "Requester"}
              src={ticket.requester?.avatarUrl}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-sm">
                  {ticket.requester?.name}
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0 capitalize">
                  {ticket.requester?.role || "User"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                Created {formatRelativeTime(ticket.createdAt)} ({formatDateTime(ticket.createdAt)})
              </p>
            </div>
          </div>
          <Badge variant="indigo" className="text-xs font-mono">
            Original Post
          </Badge>
        </div>

        <div className="pt-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {ticket.description}
        </div>

        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Attachments ({ticket.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {ticket.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/api/attachments/${att.id}`}
                  download={att.originalName}
                  className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-gray-500" />
                  <span className="font-medium truncate max-w-[160px]">{att.originalName}</span>
                  <span className="text-gray-400 text-[10px]">({formatFileSize(att.size)})</span>
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
              "rounded-lg border p-4 shadow-xs transition-all",
              isInternal
                ? "border-amber-200 bg-amber-50/50"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="flex items-start justify-between border-b pb-2.5 border-gray-100">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={msg.author.name}
                  src={msg.author.avatarUrl}
                  size="sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900">
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
                      {msg.author.role}
                    </Badge>
                    {msg.isFirstResponse && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> 1st Response
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formatRelativeTime(msg.createdAt)} ({formatDateTime(msg.createdAt)})
                  </p>
                </div>
              </div>

              {isInternal ? (
                <div className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded px-2 py-0.5">
                  <Lock className="h-3 w-3" />
                  <span>Internal Note</span>
                </div>
              ) : (
                <span className="text-[11px] text-gray-400">Public Reply</span>
              )}
            </div>

            <div className="pt-3 text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>

            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-2.5">
                <div className="flex flex-wrap gap-2">
                  {msg.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/attachments/${att.id}`}
                      download={att.originalName}
                      className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3 w-3 text-gray-400" />
                      <span className="truncate max-w-[140px]">{att.originalName}</span>
                      <span className="text-gray-400 text-[10px]">({formatFileSize(att.size)})</span>
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
