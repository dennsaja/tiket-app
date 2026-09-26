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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2 dark:text-zinc-50">
            <ArrowUpCircle className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
            Pembaruan Sistem (System Updates)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Periksa dan terapkan pembaruan kode aplikasi langsung dari repositori GitHub resmi.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => checkUpdates(false)}
          isLoading={isChecking}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          className="text-xs self-start sm:self-auto border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Periksa Pembaruan
        </Button>
      </div>

      {/* Current Version & Repository Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <GitCommit className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
            Commit Terpasang
          </p>
          <p className="mt-1 font-mono text-base font-bold text-zinc-900 dark:text-zinc-50">
            {info?.currentCommit || "Memuat..."}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Branch: <span className="font-mono text-zinc-600 dark:text-zinc-300">{info?.currentBranch || "main"}</span>
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
            Repositori GitHub
          </p>
          <p className="mt-1 truncate font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-50">
            {info?.repository?.replace("https://github.com/", "") || "dennsaja/tiket-app"}
          </p>
          {info?.repository && (
            <a
              href={info.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-900 hover:underline dark:text-zinc-200 font-medium"
            >
              Lihat di GitHub <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
            Terakhir Diperiksa
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-900 dark:text-zinc-50">
            {info?.checkedAt ? formatDateTime(info.checkedAt) : "Belum diperiksa"}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="h-3 w-3" /> Auto-sync enabled
          </p>
        </div>
      </div>

      {/* Main Status Panel */}
      {info?.hasUpdate ? (
        /* Update Available Card */
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 text-white dark:border-zinc-700 dark:bg-zinc-900 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-black dark:bg-white dark:text-black">
                <Zap className="h-3 w-3" /> Pembaruan Baru Tersedia!
              </div>

              <h2 className="text-base font-bold text-white tracking-tight">
                Versi Baru ({info.latestCommit}) Tersedia di GitHub
              </h2>

              <div className="rounded-lg border border-zinc-800 bg-black/60 p-3 text-xs text-zinc-300 space-y-1.5">
                <p className="font-medium text-white">
                  {info.commitMessage}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                  <span>Author: <strong className="text-zinc-200">{info.commitAuthor}</strong></span>
                  {info.commitDate && (
                    <span>Tanggal: {formatDateTime(info.commitDate)}</span>
                  )}
                  {info.commitUrl && (
                    <a
                      href={info.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline inline-flex items-center gap-1 font-medium"
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
              className="bg-white text-black hover:bg-zinc-200 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shrink-0 font-medium"
            >
              Perbarui Sekarang
            </Button>
          </div>
        </div>
      ) : (
        /* Up to date Card */
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Aplikasi Anda Sudah Menggunakan Versi Terbaru
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Tidak ada commit baru yang ditemukan di repositori GitHub ({info?.repository || "dennsaja/tiket-app"}). Seluruh fitur dan skema database sudah mutakhir.
          </p>
        </div>
      )}

      {/* Manual CLI Fallback Helper */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-950 space-y-2">
        <p className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-zinc-500" /> Alternatif Pembaruan Manual via Terminal Server:
        </p>
        <div className="rounded-lg bg-black border border-zinc-800 p-3 font-mono text-[11px] text-zinc-200 select-all">
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
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Sedang memproses git pull &amp; sinkronisasi...
              </p>
              <p className="text-[11px] text-zinc-500 text-center max-w-xs">
                Mohon tunggu beberapa detik hingga file terbaru berhasil disinkronkan.
              </p>
            </div>
          ) : updateResult?.success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-2">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {updateResult.message}
              </p>
              {updateResult.newCommit && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                  Versi aktif: #{updateResult.newCommit}
                </p>
              )}
            </div>
          ) : updateResult && !updateResult.success ? (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-center dark:border-red-900/60 dark:bg-red-950/20 space-y-2">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                Gagal Memperbarui Aplikasi
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                {updateResult.message}
              </p>
            </div>
          ) : null}

          {/* Logs Output */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Terminal className="h-3 w-3" /> Log Eksekusi:
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-black border border-zinc-800 p-3 font-mono text-[11px] text-zinc-300 space-y-1">
              {updateLogs.map((log, i) => (
                <div key={i} className="leading-tight">
                  <span className="text-zinc-500">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {updateResult?.success ? (
              <Button
                size="sm"
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-medium"
              >
                Muat Ulang Halaman
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUpdateModalOpen(false)}
                disabled={isUpdating}
                className="border-zinc-200 dark:border-zinc-800"
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
