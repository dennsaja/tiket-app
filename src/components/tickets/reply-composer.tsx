"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Send, Paperclip, X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

interface ReplyComposerProps {
  ticketId: string;
  isAgentOrAdmin: boolean;
  onMessageSent: () => void;
  disabled?: boolean;
}

export function ReplyComposer({
  ticketId,
  isAgentOrAdmin,
  onMessageSent,
  disabled,
}: ReplyComposerProps) {
  const [content, setContent] = React.useState("");
  const [isInternalNote, setIsInternalNote] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const valid = selected.filter((f) => f.size <= 10 * 1024 * 1024);
      if (valid.length < selected.length) {
        toast.error("Some files exceed the 10MB limit and were skipped.");
      }
      setFiles((prev) => [...prev, ...valid]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Silakan masukkan pesan balasan");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Post message
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          type: isInternalNote ? "internal_note" : "public",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengirim pesan");
      }

      const newMsg = await res.json();

      // 2. Upload attachments if any
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          if (newMsg?.id) formData.append("messageId", newMsg.id);

          await fetch(`/api/tickets/${ticketId}/attachments`, {
            method: "POST",
            body: formData,
          });
        }
      }

      toast.success(
        isInternalNote ? "Catatan internal berhasil ditambahkan" : "Balasan berhasil dikirim"
      );
      setContent("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onMessageSent();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (disabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
        Tiket ini sudah ditutup atau dibatalkan. Tidak dapat mengirim balasan baru.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-lg border bg-white p-4 shadow-xs transition-colors ${
        isInternalNote ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setIsInternalNote(false)}
            className={`px-3 py-1 font-medium rounded transition-all ${
              !isInternalNote
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Balasan Publik
          </button>
          {isAgentOrAdmin && (
            <button
              type="button"
              onClick={() => setIsInternalNote(true)}
              className={`flex items-center gap-1 px-3 py-1 font-medium rounded transition-all ${
                isInternalNote
                  ? "bg-amber-100 text-amber-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Lock className="h-3 w-3" />
              Catatan Internal
            </button>
          )}
        </div>

        {isInternalNote && (
          <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
            <Lock className="h-3 w-3" /> Hanya teknisi &amp; admin
          </span>
        )}
      </div>

      <div className="pt-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isInternalNote
              ? "Tambahkan catatan internal, langkah perbaikan teknis, atau memo khusus tim teknisi..."
              : "Ketik balasan pesan Anda kepada pelapor..."
          }
          rows={4}
          className="text-xs sm:text-sm border-gray-200 resize-y"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
            >
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="ticket-composer-file"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Paperclip className="h-3.5 w-3.5" />}
            className="text-xs text-gray-600"
          >
            Lampirkan Berkas
          </Button>
        </div>

        <Button
          type="submit"
          size="sm"
          isLoading={isSubmitting}
          leftIcon={<Send className="h-3.5 w-3.5" />}
          className={isInternalNote ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
        >
          {isInternalNote ? "Simpan Catatan" : "Kirim Balasan"}
        </Button>
      </div>
    </form>
  );
}
