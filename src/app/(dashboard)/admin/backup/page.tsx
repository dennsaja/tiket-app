"use client";

import * as React from "react";
import {
  Archive,
  Database,
  Download,
  UploadCloud,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Users,
  Ticket,
  ShieldCheck,
  Clock,
  HardDrive,
  Sparkles,
  RefreshCw,
  Info,
  X,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface BackupItem {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  manifest?: {
    version: string;
    appName: string;
    createdAt: string;
    note?: string;
    includedFiles: boolean;
    counts: {
      users: number;
      tickets: number;
      messages: number;
      workReports: number;
      attachments: number;
      departments: number;
      categories: number;
      filesCount: number;
      filesTotalBytes: number;
      [key: string]: number;
    };
  } | null;
}

interface StatsInfo {
  totalTickets: number;
  totalUsers: number;
  totalAttachments: number;
  totalMessages: number;
  totalWorkReports: number;
  totalFilesCount: number;
  totalFilesBytes: number;
  counts: Record<string, number>;
}

export default function AdminBackupPage() {
  const [backups, setBackups] = React.useState<BackupItem[]>([]);
  const [stats, setStats] = React.useState<StatsInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Create Backup State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [includeFiles, setIncludeFiles] = React.useState(true);
  const [backupNote, setBackupNote] = React.useState("");
  const [autoDownload, setAutoDownload] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);

  // Restore State
  const [isRestoreOpen, setIsRestoreOpen] = React.useState(false);
  const [restoreSource, setRestoreSource] = React.useState<"server" | "upload">("server");
  const [selectedServerFilename, setSelectedServerFilename] = React.useState<string>("");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [restoreMode, setRestoreMode] = React.useState<"overwrite" | "merge">("overwrite");
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [restoreResult, setRestoreResult] = React.useState<any | null>(null);

  // Delete State
  const [deletingFilename, setDeletingFilename] = React.useState<string | null>(null);

  // Load data
  const loadBackupsAndStats = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("Gagal mengambil data backup");
      const data = await res.json();
      setBackups(data.backups || []);
      setStats(data.stats || null);
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Gagal memuat data backup");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadBackupsAndStats();
  }, [loadBackupsAndStats]);

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Handle Create Backup
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeFiles,
          note: backupNote,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal membuat cadangan");
      }

      const data = await res.json();
      toast.success("Cadangan data aplikasi berhasil dibuat!");
      setIsCreateOpen(false);
      setBackupNote("");

      // Auto download if requested
      if (autoDownload && data.backup?.downloadUrl) {
        window.location.href = data.backup.downloadUrl;
      }

      loadBackupsAndStats(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat cadangan");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Delete Backup
  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus berkas cadangan "${filename}" dari server?`)) {
      return;
    }

    setDeletingFilename(filename);
    try {
      const res = await fetch(`/api/admin/backup/${filename}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal menghapus cadangan");
      }

      toast.success("Berkas cadangan berhasil dihapus");
      loadBackupsAndStats(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus berkas");
    } finally {
      setDeletingFilename(null);
    }
  };

  // Open restore modal for specific server backup
  const openRestoreForFile = (filename: string) => {
    setSelectedServerFilename(filename);
    setRestoreSource("server");
    setRestoreResult(null);
    setIsRestoreOpen(true);
  };

  // Handle Restore Execution
  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmMessage =
      restoreMode === "overwrite"
        ? "PERINGATAN: Mode Timpa akan mengganti data saat ini dengan data dari berkas cadangan. Pastikan Anda sudah membuat cadangan terbaru. Lanjutkan pemulihan?"
        : "Mode Gabung akan menambahkan data dari berkas cadangan ke sistem tanpa menghapus data baru. Lanjutkan?";

    if (!confirm(confirmMessage)) return;

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      let res: Response;
      if (restoreSource === "upload") {
        if (!uploadFile) {
          toast.error("Pilih berkas cadangan (.zip / .json)");
          setIsRestoring(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("mode", restoreMode);

        res = await fetch("/api/admin/backup/restore", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/admin/backup/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: selectedServerFilename,
            mode: restoreMode,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memulihkan data");
      }

      toast.success(data.message || "Data aplikasi berhasil dipulihkan!");
      setRestoreResult(data);
      loadBackupsAndStats(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal memulihkan cadangan");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Archive className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
              Backup &amp; Pemulihan Data Aplikasi
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              Data Only (Non-Code)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Cadangkan seluruh data operasional aplikasi (tiket, akun, obrolan tim, kebijakan SLA, riwayat, dan foto/lampiran). Tidak menyertakan source code web.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBackupsAndStats(false)}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />}
          >
            Segarkan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRestoreSource("upload");
              setSelectedServerFilename("");
              setUploadFile(null);
              setRestoreResult(null);
              setIsRestoreOpen(true);
            }}
            leftIcon={<UploadCloud className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          >
            Upload &amp; Restore
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Buat Backup Sekarang
          </Button>
        </div>
      </div>

      {/* ── Top Metric Cards (Live App Data Scope) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tickets & Reports */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-black p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Tiket &amp; Riwayat</span>
            <Ticket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {stats?.totalTickets ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">Tiket terdaftar</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {stats?.totalMessages ?? 0} pesan chat &bull; {stats?.totalWorkReports ?? 0} laporan teknisi
          </p>
        </div>

        {/* Card 2: Accounts & Users */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-black p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Akun &amp; Pengguna</span>
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {stats?.totalUsers ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">Pengguna aktif</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Password terenkripsi (Bcrypt hash) aman
          </p>
        </div>

        {/* Card 3: Photos & Attachments */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-black p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Foto &amp; Berkas Lampiran</span>
            <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {stats?.totalFilesCount ?? 0}
            </span>
            <span className="text-[11px] text-zinc-500">
              Berkas ({formatBytes(stats?.totalFilesBytes ?? 0)})
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Foto sebelum/sesudah, avatar, dan dokumen
          </p>
        </div>

        {/* Card 4: Backup Storage */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-black p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold">
            <span>Cadangan di Server</span>
            <HardDrive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {backups.length}
            </span>
            <span className="text-[11px] text-zinc-500">Berkas ZIP cadangan</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Total {formatBytes(backups.reduce((acc, b) => acc + b.sizeBytes, 0))} tersimpan
          </p>
        </div>
      </div>

      {/* ── Server Backups Table ── */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-black shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
              Daftar Berkas Cadangan Tersimpan di Server
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Setiap berkas cadangan berisi file database JSON lengkap, SQL dump, manifest, dan arsip foto/lampiran.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-400 text-xs gap-3">
            <Spinner size="md" />
            <span>Memuat daftar cadangan data...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs space-y-3">
            <Archive className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-700 stroke-[1.5]" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Belum ada berkas cadangan tersimpan di server.
            </p>
            <p className="text-[11px] max-w-md mx-auto text-zinc-500">
              Klik tombol &quot;Buat Backup Sekarang&quot; di atas untuk membuat cadangan pertama database tiket, foto, dan akun Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nama Berkas Cadangan</th>
                  <th className="py-3 px-4 font-semibold">Waktu Pembuatan</th>
                  <th className="py-3 px-4 font-semibold">Ukuran</th>
                  <th className="py-3 px-4 font-semibold">Rincian Data</th>
                  <th className="py-3 px-4 font-semibold">Catatan</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {backups.map((item) => {
                  const m = item.manifest;
                  const isDeleting = deletingFilename === item.filename;

                  return (
                    <tr
                      key={item.filename}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#0066FF] shrink-0" />
                          <span className="truncate max-w-[220px]" title={item.filename}>
                            {item.filename}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                        <div>{new Date(item.createdAt).toLocaleString("id-ID")}</div>
                        <div className="text-[10px] text-zinc-400">
                          {formatRelativeTime(item.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                        {formatBytes(item.sizeBytes)}
                      </td>
                      <td className="py-3 px-4">
                        {m ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md">
                              {m.counts.tickets} Tiket
                            </span>
                            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md">
                              {m.counts.users} Akun
                            </span>
                            {m.includedFiles && (
                              <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md">
                                {m.counts.filesCount} Foto/Lampiran
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px] italic">Arsip ZIP Cadangan</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-[11px] max-w-[180px] truncate">
                        {m?.note || "-"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/api/admin/backup/${item.filename}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
                            title="Unduh berkas cadangan ke komputer"
                          >
                            <Download className="h-3 w-3" />
                            <span>Unduh</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => openRestoreForFile(item.filename)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-2xs"
                            title="Pulihkan data dari cadangan ini"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(item.filename)}
                            disabled={isDeleting}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Hapus cadangan dari server"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Security & Architecture Information Box ── */}
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-5 space-y-3">
        <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Info className="h-4 w-4 text-[#0066FF]" />
          Informasi &amp; Keamanan Cadangan Data
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <div className="space-y-1">
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold block">
              1. Khusus Data Aplikasi (Non-Code)
            </strong>
            <p>
              Cadangan hanya mencakup data operasional: tiket, riwayat status, chat tim, akun pengguna, kebijakan SLA, serta berkas foto/lampiran. Source code web tetap aman dikelola via GitHub.
            </p>
          </div>
          <div className="space-y-1">
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold block">
              2. Kredensial &amp; Password Terenkripsi
            </strong>
            <p>
              Kata sandi pengguna tetap tersimpan dalam format hash Bcrypt yang aman. Pengguna dapat langsung login dengan kata sandi lama setelah proses restore.
            </p>
          </div>
          <div className="space-y-1">
            <strong className="text-zinc-900 dark:text-zinc-100 font-semibold block">
              3. Format Standar ZIP, JSON, &amp; SQL
            </strong>
            <p>
              Arsip cadangan dapat diekstrak di Windows, Mac, atau Linux. Di dalamnya terdapat <code>database.json</code>, <code>database.sql</code>, dan folder <code>uploads/</code> yang kompatibel dengan berbagai skenario DBA.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: BUAT CADANGAN BARU
         ===================================================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center">
                  <Archive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    Buat Cadangan Data Aplikasi
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Mencadangkan database PostgreSQL dan seluruh berkas foto/lampiran
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isCreating && setIsCreateOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBackup} className="space-y-4">
              {/* Note / Label */}
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Catatan / Label Cadangan (Opsional)
                </label>
                <input
                  type="text"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  placeholder="Misal: Backup sebelum pembaruan server atau Rutin mingguan"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

              {/* Options */}
              <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 space-y-3">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFiles}
                    onChange={(e) => setIncludeFiles(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#0066FF]"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                      Sertakan Foto Dokumentasi &amp; Lampiran ({stats?.totalFilesCount ?? 0} berkas)
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Menyertakan seluruh foto profil, dokumentasi sebelum/sesudah tiket, dan lampiran berkas dari folder <code>uploads/</code>.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 text-xs cursor-pointer border-t border-zinc-200/60 dark:border-zinc-800 pt-2.5">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#0066FF]"
                  />
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 block">
                      Unduh Otomatis ke Komputer Setelah Selesai
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Berkas ZIP akan langsung terunduh ke komputer Anda dan salinannya tetap disimpan di server.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isCreating}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Mulai Pencadangan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: PULIHKAN DATA (RESTORE)
         ===================================================================== */}
      {isRestoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    Pemulihan Data Aplikasi (Restore)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Memulihkan tiket, akun, pesan, dan foto dari berkas cadangan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isRestoring && setIsRestoreOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {restoreResult ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-900 dark:text-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Pemulihan Selesai Berhasil!</span>
                  </div>
                  <p className="text-[11px]">
                    Sumber: <b>{restoreResult.sourceName}</b> ({restoreResult.mode})
                  </p>
                  <div className="text-[11px] pt-1 border-t border-emerald-200 dark:border-emerald-800/80 grid grid-cols-2 gap-2">
                    <div>
                      Tiket: <b>{restoreResult.restoredCounts?.tickets ?? 0}</b>
                    </div>
                    <div>
                      Akun: <b>{restoreResult.restoredCounts?.users ?? 0}</b>
                    </div>
                    <div>
                      Pesan: <b>{restoreResult.restoredCounts?.ticket_messages ?? 0}</b>
                    </div>
                    <div>
                      Foto/Berkas: <b>{restoreResult.restoredFilesCount ?? 0}</b>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsRestoreOpen(false);
                      setRestoreResult(null);
                    }}
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteRestore} className="space-y-4">
                {/* Source Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Pilih Sumber Berkas Cadangan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreSource("server")}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        restoreSource === "server"
                          ? "border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5 mb-1" />
                      <div>Cadangan di Server</div>
                      <div className="text-[10px] text-zinc-500 font-normal">
                        Pilih dari daftar server
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreSource("upload")}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        restoreSource === "upload"
                          ? "border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <UploadCloud className="h-3.5 w-3.5 mb-1" />
                      <div>Upload dari Laptop</div>
                      <div className="text-[10px] text-zinc-500 font-normal">
                        Unggah berkas .zip / .json
                      </div>
                    </button>
                  </div>
                </div>

                {/* Source Input */}
                {restoreSource === "server" ? (
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                      Berkas Cadangan di Server
                    </label>
                    <select
                      value={selectedServerFilename}
                      onChange={(e) => setSelectedServerFilename(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                    >
                      <option value="">-- Pilih Berkas Cadangan --</option>
                      {backups.map((b) => (
                        <option key={b.filename} value={b.filename}>
                          {b.filename} ({formatBytes(b.sizeBytes)}) &bull;{" "}
                          {new Date(b.createdAt).toLocaleDateString("id-ID")}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                      Pilih Berkas Cadangan (.zip atau .json)
                    </label>
                    <input
                      type="file"
                      accept=".zip,.json"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      required
                      className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {uploadFile && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                        Terpilih: {uploadFile.name} ({formatBytes(uploadFile.size)})
                      </p>
                    )}
                  </div>
                )}

                {/* Restore Mode */}
                <div>
                  <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    Metode Pemulihan Data
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="overwrite"
                        checked={restoreMode === "overwrite"}
                        onChange={() => setRestoreMode("overwrite")}
                        className="mt-0.5 accent-[#0066FF]"
                      />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs block">
                          Mode Pemulihan Penuh / Timpa (Clean Overwrite) &mdash; Direkomendasikan
                        </span>
                        <span className="text-[11px] text-zinc-500 block">
                          Mengganti data lama dengan data cadangan secara rapi dan sinkron (cocok untuk pemulihan bencana).
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                        className="mt-0.5 accent-[#0066FF]"
                      />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs block">
                          Mode Gabung / Impor Tambahan (Append / Merge)
                        </span>
                        <span className="text-[11px] text-zinc-500 block">
                          Menambahkan data tanpa menghapus data baru yang sudah ada di database saat ini.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Caution Alert */}
                <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Pastikan Anda memahami bahwa proses pemulihan akan memperbarui database operasional aplikasi. Disarankan untuk membuat cadangan terlebih dahulu sebelum melanjutkan.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRestoreOpen(false)}
                    disabled={isRestoring}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Batal
                  </button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    isLoading={isRestoring}
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Mulai Pemulihan Data
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
