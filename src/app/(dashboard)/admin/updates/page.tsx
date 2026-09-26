"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowUpCircle,
  RefreshCw,
  GitBranch,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";

interface UpdateInfo {
  currentCommit: string;
  currentCommitFull?: string;
  currentBranch: string;
  latestCommit?: string;
  latestCommitFull?: string;
  hasUpdate: boolean;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
  commitUrl?: string;
  repository: string;
  checkedAt: string;
  note?: string;
}

export default function AdminUpdatesPage() {
  const [info, setInfo] = React.useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [updateLogs, setUpdateLogs] = React.useState<string[]>([]);
  const [updateResult, setUpdateResult] = React.useState<{
    success?: boolean;
    message?: string;
    newCommit?: string;
  } | null>(null);

  const checkUpdates = React.useCallback(async (silent = false) => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/admin/system/update");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memeriksa pembaruan");
      }
      const data = await res.json();
      setInfo(data);
      if (!silent) {
        if (data.hasUpdate) {
          toast.success("Pembaruan baru tersedia dari GitHub!");
        } else {
          toast.success("Aplikasi Anda sudah dalam versi terbaru.");
        }
      }
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Gagal menghubungi server");
    } finally {
      setIsChecking(false);
    }
  }, []);

  React.useEffect(() => {
    checkUpdates(true);
  }, [checkUpdates]);

  const handleStartUpdate = async () => {
    setIsUpdating(true);
    setUpdateLogs([
      "Memulai proses pembaruan aplikasi...",
      "Menghubungkan ke GitHub repository...",
    ]);
    setUpdateResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("/api/admin/system/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || `Pembaruan gagal dengan status ${res.status}`
        );
      }

      setUpdateLogs(data.logs || ["Pembaruan selesai."]);
      setUpdateResult({
        success: true,
        message: data.message || "Pembaruan berhasil diterapkan!",
        newCommit: data.newCommit,
      });
      toast.success("Pembaruan berhasil diterapkan!");
      checkUpdates(true);
    } catch (err: any) {
      const isAbort = err.name === "AbortError";
      const errorMsg = isAbort
        ? "Waktu tunggu habis (timeout). Server mungkin sedang memproses di latar belakang."
        : err.message || "Terjadi kesalahan jaringan saat memperbarui";

      setUpdateLogs((prev) => [...prev, `[ERROR] ${errorMsg}`]);
      setUpdateResult({
        success: false,
        message: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 dark:text-gray-100">
            <ArrowUpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Pembaruan Sistem (System Updates)
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Periksa dan terapkan pembaruan kode aplikasi langsung dari repositori GitHub resmi.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => checkUpdates(false)}
          isLoading={isChecking}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          className="text-xs self-start sm:self-auto"
        >
          Periksa Pembaruan
        </Button>
      </div>

      {/* Current Version & Repository Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Commit Terpasang
          </p>
          <p className="mt-1 font-mono text-base font-bold text-gray-900 dark:text-gray-100">
            {info?.currentCommit || "Memuat..."}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Branch: <span className="font-mono text-gray-600 dark:text-gray-300">{info?.currentBranch || "main"}</span>
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Repositori GitHub
          </p>
          <p className="mt-1 truncate font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
            {info?.repository?.replace("https://github.com/", "") || "dennsaja/tiket-app"}
          </p>
          {info?.repository && (
            <a
              href={info.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Lihat di GitHub <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Terakhir Diperiksa
          </p>
          <p className="mt-1 text-xs font-medium text-gray-900 dark:text-gray-100">
            {info?.checkedAt ? formatDateTime(info.checkedAt) : "Belum diperiksa"}
          </p>
          <p className="mt-0.5 text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Auto-sync enabled
          </p>
        </div>
      </div>

      {/* Main Status Panel */}
      {info?.hasUpdate ? (
        /* Update Available Card */
        <div className="rounded-lg border-2 border-indigo-500 bg-indigo-50/50 p-6 shadow-sm dark:border-indigo-600 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                <Zap className="h-3.5 w-3.5" /> Pembaruan Baru Tersedia!
              </div>

              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Versi Baru ({info.latestCommit}) Tersedia di GitHub
              </h2>

              <div className="rounded-md border border-indigo-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800 space-y-1.5">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {info.commitMessage}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>Author: <strong>{info.commitAuthor}</strong></span>
                  {info.commitDate && (
                    <span>Tanggal: {formatDateTime(info.commitDate)}</span>
                  )}
                  {info.commitUrl && (
                    <a
                      href={info.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline dark:text-indigo-400 inline-flex items-center gap-1"
                    >
                      Detail Commit <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <Button
              size="md"
              onClick={() => {
                setUpdateModalOpen(true);
                handleStartUpdate();
              }}
              leftIcon={<ArrowUpCircle className="h-4 w-4" />}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              Perbarui Sekarang
            </Button>
          </div>
        </div>
      ) : (
        /* Up to date Card */
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-6 text-center dark:border-green-900/50 dark:bg-green-950/20 space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-base font-bold text-green-900 dark:text-green-300">
            Aplikasi Anda Sudah Menggunakan Versi Terbaru
          </h2>
          <p className="text-xs text-green-700 dark:text-green-400 max-w-md mx-auto">
            Tidak ada commit baru yang ditemukan di repositori GitHub ({info?.repository || "dennsaja/tiket-app"}). Seluruh fitur dan skema database sudah mutakhir.
          </p>
        </div>
      )}

      {/* Manual CLI Fallback Helper */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-gray-500" /> Alternatif Pembaruan Manual via Terminal Server:
        </p>
        <div className="rounded bg-gray-900 p-2.5 font-mono text-[11px] text-gray-200 select-all">
          cd /opt/helpdesk/app &amp;&amp; git pull origin main &amp;&amp; npm run build &amp;&amp; systemctl restart helpdesk
        </div>
      </div>

      {/* Update Process Modal */}
      <Modal
        open={updateModalOpen}
        onOpenChange={(open) => {
          if (!isUpdating) setUpdateModalOpen(open);
        }}
        title="Proses Pembaruan Sistem"
        description="Aplikasi sedang mengunduh pembaruan dari GitHub dan menyinkronkan data."
      >
        <div className="space-y-4 pt-2">
          {isUpdating ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <Spinner size="lg" />
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Sedang memproses git pull &amp; sinkronisasi...
              </p>
              <p className="text-[11px] text-gray-500 text-center max-w-xs">
                Mohon tunggu beberapa detik hingga file terbaru berhasil disinkronkan.
              </p>
            </div>
          ) : updateResult?.success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/30 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
              <p className="text-sm font-bold text-green-900 dark:text-green-300">
                {updateResult.message}
              </p>
              {updateResult.newCommit && (
                <p className="text-xs text-green-700 dark:text-green-400 font-mono">
                  Versi aktif: #{updateResult.newCommit}
                </p>
              )}
            </div>
          ) : updateResult && !updateResult.success ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/30 space-y-2">
              <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
              <p className="text-sm font-bold text-red-900 dark:text-red-300">
                Gagal Memperbarui Aplikasi
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                {updateResult.message}
              </p>
            </div>
          ) : null}

          {/* Logs Output */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Terminal className="h-3 w-3" /> Log Eksekusi:
            </p>
            <div className="max-h-48 overflow-y-auto rounded bg-gray-900 p-3 font-mono text-[11px] text-gray-200 space-y-1">
              {updateLogs.map((log, i) => (
                <div key={i} className="leading-tight">
                  <span className="text-indigo-400">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            {updateResult?.success ? (
              <Button
                size="sm"
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Muat Ulang Halaman
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUpdateModalOpen(false)}
                disabled={isUpdating}
              >
                Tutup
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
