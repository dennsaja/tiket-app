"use client";

import { useEffect, useState, useRef } from "react";
import {
  Smartphone,
  Send,
  Save,
  RotateCcw,
  RefreshCw,
  Radio,
  GitBranch,
  GitCommit,
  ArrowUpCircle,
  CheckCircle2,
  AlertCircle,
  Terminal,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  MobileConfig,
  MobileConsoleState,
  ConsoleAction,
  defaultMobileConfig,
} from "@/lib/mobile-console/config";

const panel = "rounded-[28px] border border-white/10 bg-[#17171c] p-6";
const input =
  "mt-2 w-full rounded-2xl border border-white/10 bg-[#0c0c0f] px-4 py-3 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50";

interface GitUpdateInfo {
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
  repository?: string;
  checkedAt?: string;
}

export function MobileConsole({
  apkVersion,
  apkSupportsConsole,
}: {
  apkVersion: string;
  apkSupportsConsole: boolean;
}) {
  const [state, setState] = useState<MobileConsoleState | null>(null);
  const [receipts, setReceipts] = useState<NonNullable<MobileConsoleState["receipts"]>>([]);
  const [draft, setDraft] = useState<MobileConfig>({ ...defaultMobileConfig });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = !!state && JSON.stringify(draft) !== JSON.stringify(state.draft);

  // Git update state
  const [gitInfo, setGitInfo] = useState<GitUpdateInfo | null>(null);
  const [checkingGit, setCheckingGit] = useState(false);
  const [updatingGit, setUpdatingGit] = useState(false);
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [gitLogs, setGitLogs] = useState<string[]>([]);
  const [gitStatusMessage, setGitStatusMessage] = useState("");
  const [gitCountdown, setGitCountdown] = useState<number | null>(null);
  const [gitUpdateResult, setGitUpdateResult] = useState<{
    success: boolean;
    message: string;
    newCommit?: string;
  } | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  function receive(data: MobileConsoleState) {
    setState(data);
    setDraft({ ...data.draft });
    if (data.receipts) setReceipts(data.receipts);
    setError("");
  }

  async function reload() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-console", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Console gagal dimuat.");
      receive(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Console gagal dimuat.");
    } finally {
      setBusy(false);
    }
  }

  async function checkGitUpdate(silent = false) {
    setCheckingGit(true);
    try {
      const res = await fetch("/api/admin/system/update");
      if (!res.ok) throw new Error("Gagal memeriksa git update");
      const data = await res.json();
      setGitInfo(data);
      if (!silent) {
        if (data.hasUpdate) {
          toast.success(`Ada pembaruan kode baru (${data.latestCommit?.slice(0, 7)})!`);
        } else {
          toast.success("Kode sistem sudah versi terbaru.");
        }
      }
    } catch (err: any) {
      if (!silent) toast.error("Gagal memeriksa update: " + err.message);
    } finally {
      setCheckingGit(false);
    }
  }

  async function startGitUpdate() {
    setUpdatingGit(true);
    setGitModalOpen(true);
    setGitLogs([]);
    setGitUpdateResult(null);
    setGitCountdown(null);
    setGitStatusMessage("Menghubungi server dan menyiapkan pembaruan...");

    try {
      const res = await fetch("/api/admin/system/update", { method: "POST" });
      if (!res.ok && !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming respon tidak didukung browser.");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "log") {
              const formatted = data.prefix ? `[${data.prefix}] ${data.message}` : data.message;
              setGitLogs((prev) => [...prev, formatted]);
            } else if (data.type === "status") {
              setGitStatusMessage(data.message || "Memproses...");
            } else if (data.type === "restart") {
              setGitStatusMessage("Me-restart service aplikasi...");
              setGitCountdown(5);
            } else if (data.type === "complete") {
              setGitUpdateResult({
                success: true,
                message: data.message || "Pembaruan kode berhasil diterapkan!",
                newCommit: data.newCommit,
              });
              toast.success("Pembaruan kode berhasil diselesaikan!");
              void checkGitUpdate(true);
              void reload();
            } else if (data.type === "error") {
              setGitUpdateResult({
                success: false,
                message: data.error || "Gagal memperbarui aplikasi",
              });
              toast.error(data.error || "Pembaruan kode gagal");
            }
          } catch {
            setGitLogs((prev) => [...prev, line]);
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || "Terjadi kesalahan koneksi";
      setGitLogs((prev) => [...prev, `[ERROR] ${msg}`]);
      setGitUpdateResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setUpdatingGit(false);
    }
  }

  useEffect(() => {
    void reload();
    void checkGitUpdate(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/admin/mobile-console", { cache: "no-store" })
        .then(async (res) => {
          if (res.ok) {
            const data: MobileConsoleState = await res.json();
            setReceipts(data.receipts ?? []);
          }
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (gitCountdown === null) return;
    if (gitCountdown <= 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => {
      setGitCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [gitCountdown]);

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gitLogs]);

  async function submit(action: ConsoleAction) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Perubahan gagal disimpan.");
      receive(data);
      if (action.action !== "save") setNote("");
      toast.success(
        action.action === "save"
          ? "Draft tersimpan. Belum dikirim ke aplikasi."
          : "Pembaruan diterbitkan. Popup dikirim ke aplikasi yang terhubung; lihat status penerimaan di bawah."
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Perubahan gagal disimpan.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof MobileConfig>(key: K, value: MobileConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 text-[#f6f6f8]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[.2em] text-blue-400">HELPDESK / ANDROID CONSOLE</p>
          <h1 className="text-3xl font-semibold tracking-tight">Console &amp; Pembaruan Aplikasi</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Pusat kendali aplikasi: tarik pembaruan kode/fix via Git dan atur pengalaman teknisi secara remote.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={checkingGit || updatingGit}
            onClick={() => void checkGitUpdate(false)}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
          >
            <GitBranch className="h-4 w-4" />
            {checkingGit ? "Memeriksa Git..." : "Periksa Pembaruan Git"}
          </Button>
          <a
            href="/downloads/helpdesk-teknisi.apk"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Smartphone className="h-4 w-4" />
            Unduh APK {apkVersion}
          </a>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("Muat ulang dan buang perubahan draft yang belum disimpan?")) {
                void reload();
                void checkGitUpdate(true);
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </Button>
        </div>
      </div>

      {/* Grid Status Cards (4 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Git & Code Update Status */}
        <div className="rounded-[28px] border border-blue-500/30 bg-blue-500/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <GitCommit className="h-6 w-6 text-blue-400" />
              {gitInfo?.hasUpdate ? (
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300 animate-pulse border border-emerald-500/30">
                  Update Tersedia
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-zinc-300">
                  Kode Terkini
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-300">Pembaruan Kode Git</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">
              #{gitInfo?.currentCommit || "..."}
            </p>
            <p className="mt-1 text-xs text-zinc-400 truncate">
              {gitInfo?.hasUpdate
                ? `Tersedia: #${gitInfo.latestCommit?.slice(0, 7)} · ${gitInfo.commitMessage || "Perbaikan baru"}`
                : `Branch: ${gitInfo?.currentBranch || "main"} · Repositori sinkron`}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10">
            <Button
              size="sm"
              disabled={updatingGit}
              onClick={() => void startGitUpdate()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs gap-1.5"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              {updatingGit ? "Sedang Update..." : gitInfo?.hasUpdate ? "Tarik & Terapkan Update" : "Tarik Ulang / Update Kode"}
            </Button>
          </div>
        </div>

        {/* Card 2: Remote Config Version */}
        <div className="rounded-[28px] bg-white p-6 text-zinc-950 flex flex-col justify-between">
          <div>
            <Radio className="mb-4 h-6 w-6 text-blue-600" />
            <p className="text-sm font-medium text-zinc-600">Konfigurasi Remote</p>
            <p className="mt-1 text-3xl font-bold">
              {state ? (state.published ? `v${state.published.version}` : "Default") : "—"}
            </p>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Tersimpan di server &amp; disinkronkan ke perangkat.
          </p>
        </div>

        {/* Card 3: APK Release Version */}
        <div className={panel + " flex flex-col justify-between"}>
          <div>
            <Smartphone className="mb-4 h-6 w-6 text-blue-400" />
            <p className="text-sm text-zinc-400">Versi APK Resmi</p>
            <p className="mt-1 text-2xl font-bold">v{apkVersion}</p>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {apkSupportsConsole
              ? "Mendukung popup update & remote config console."
              : "Versi lama memerlukan instalasi APK baru."}
          </p>
        </div>

        {/* Card 4: Device Adoption */}
        <div className={panel + " flex flex-col justify-between"}>
          <div>
            <CheckCircle2 className="mb-4 h-6 w-6 text-emerald-400" />
            <p className="text-sm text-zinc-400">Penerapan Teknisi</p>
            <p className="mt-1 text-2xl font-bold">
              {state?.published
                ? receipts.filter((item) => item.version === state.published!.version).length
                : receipts.length}{" "}
              akun
            </p>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Diterapkan otomatis saat aplikasi teknisi terhubung.
          </p>
        </div>
      </div>

      {/* Banner Notice */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-sm leading-relaxed text-blue-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>Fitur Pembaruan Kode &amp; Remote Console Aktif:</strong> Anda dapat menarik pembaruan kode Git, migrasi, dan perbaikan server langsung via tombol <em>&quot;Tarik &amp; Terapkan Update&quot;</em> di atas. Pengaturan tampilan, interval GPS 5 menit, dan pengumuman dapat disesuaikan langsung di bawah tanpa compile ulang.
        </div>
        {gitInfo?.hasUpdate && (
          <Button
            size="sm"
            onClick={() => void startGitUpdate()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shrink-0"
          >
            Terapkan Pembaruan #{gitInfo.latestCommit?.slice(0, 7)}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {!state && !error && <p role="status" className="text-zinc-400">Memuat console…</p>}

      {/* Two Column Console Configuration Designer */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form
          className={panel + " space-y-5"}
          onSubmit={(event) => {
            event.preventDefault();
            if (state) void submit({ action: "save", revision: state.revision, config: draft });
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Rancang Pembaruan Remote</h2>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {dirty ? "Belum disimpan" : "Draft"}
            </span>
          </div>

          <fieldset disabled={busy || !state} className="space-y-5 disabled:opacity-60">
            <label className="block text-sm">
              Teks beranda
              <input
                required
                maxLength={140}
                className={input}
                value={draft.homeSubtitle}
                onChange={(e) => update("homeSubtitle", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Judul pengumuman
              <input
                maxLength={80}
                className={input}
                value={draft.announcementTitle}
                placeholder="Informasi untuk tim"
                onChange={(e) => update("announcementTitle", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Isi pengumuman
              <textarea
                maxLength={600}
                rows={4}
                className={input}
                value={draft.announcementBody}
                placeholder="Kosongkan untuk menyembunyikan pengumuman."
                onChange={(e) => update("announcementBody", e.target.value)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4 text-sm">
              Tampilkan grafik aktivitas
              <input
                type="checkbox"
                className="h-5 w-5 accent-blue-500"
                checked={draft.showActivityChart}
                onChange={(e) => update("showActivityChart", e.target.checked)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm">
                Jumlah tiket di beranda
                <input
                  required
                  type="number"
                  min={1}
                  max={8}
                  className={input}
                  value={draft.recentTicketLimit}
                  onChange={(e) => update("recentTicketLimit", Number(e.target.value))}
                />
              </label>

              <label className="text-sm">
                Penyegaran data (detik)
                <input
                  required
                  type="number"
                  min={15}
                  max={120}
                  className={input}
                  value={draft.refreshIntervalSeconds}
                  onChange={(e) => update("refreshIntervalSeconds", Number(e.target.value))}
                />
              </label>

              <label className="text-sm">
                Interval GPS (menit)
                <input
                  required
                  type="number"
                  min={1}
                  max={60}
                  className={input}
                  value={draft.gpsIntervalMinutes ?? 5}
                  onChange={(e) => update("gpsIntervalMinutes", Number(e.target.value))}
                />
              </label>
            </div>

            <p className="text-xs text-zinc-400">
              Interval GPS 5 menit merupakan mode optimal yang menghemat baterai teknisi dan menjaga performa HP tetap dingin.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={!dirty || busy}>
                <Save className="h-4 w-4" />
                Simpan draft
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft({ ...defaultMobileConfig })}
              >
                Gunakan pengaturan bawaan
              </Button>
            </div>
          </fieldset>
        </form>

        <div className="space-y-6">
          <div className={panel}>
            <p className="mb-4 text-xs tracking-widest text-zinc-500">PRATINJAU KONTEN BERANDA</p>
            <h2 className="text-2xl font-semibold">Halo, Tim.</h2>
            <p className="mt-2 break-words text-sm text-zinc-400">{draft.homeSubtitle}</p>
            {draft.announcementBody.trim() && (
              <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                <p className="break-words font-medium text-blue-200">
                  {draft.announcementTitle.trim() || "Informasi tim"}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">
                  {draft.announcementBody}
                </p>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 text-zinc-900">
                <p className="text-xs text-zinc-600 font-medium">Tiket Terbaru</p>
                <p className="mt-1 text-xl font-bold">Maks. {draft.recentTicketLimit}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-zinc-900">
                <p className="text-xs text-zinc-600 font-medium">Interval GPS</p>
                <p className="mt-1 text-xl font-bold">{draft.gpsIntervalMinutes ?? 5} Menit</p>
              </div>
            </div>
            {draft.showActivityChart && (
              <div className="mt-4 rounded-2xl border border-white/10 p-3 text-xs text-zinc-400">
                Grafik aktivitas mingguan aktif
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-500">
              Pratinjau isi draft. Data tiket asli tampil di aplikasi teknisi.
            </p>
          </div>

          <div className={panel}>
            <h2 className="text-lg font-semibold">Terbitkan untuk tim</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Simpan draft terlebih dahulu. Publikasi akan langsung memicu notifikasi popup update ke semua teknisi yang sedang online.
            </p>
            <label className="mt-4 block text-sm">
              Catatan perubahan
              <input
                maxLength={240}
                className={input}
                disabled={busy || !state}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Pembaruan interval GPS 5 menit & perbaikan"
              />
            </label>
            <Button
              className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              disabled={busy || !state || dirty || !note.trim()}
              onClick={() => state && void submit({ action: "publish", revision: state.revision, note })}
            >
              <Send className="h-4 w-4" />
              Terbitkan ke Semua Aplikasi
            </Button>
            <p className="mt-3 text-xs text-zinc-400">
              Bisa menerbitkan ulang konfigurasi yang sama untuk mengirim sinyal update versi baru ke APK.
            </p>
          </div>
        </div>
      </div>

      {/* Receipts Section */}
      <section className={panel}>
        <h2 className="text-xl font-semibold">Penerimaan aplikasi teknisi</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Konfirmasi terakhir per akun teknisi, diperbarui setiap 15 detik. Maksimal 250 akun terakhir.
        </p>
        {!receipts.length && (
          <p className="py-6 text-sm text-amber-200">
            Belum ada konfirmasi aplikasi. Pasang APK {apkVersion}, login, lalu buka beranda aplikasi.
          </p>
        )}
        <div className="mt-4 divide-y divide-white/10">
          {receipts.map((item) => (
            <div key={item.userId} className="flex flex-wrap justify-between gap-3 py-4 text-sm">
              <div>
                <p className="font-medium text-white">{item.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  APK v{item.appVersion} (Build {item.appVersionCode}) ·{" "}
                  {new Date(item.appliedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}{" "}
                  WIB
                </p>
              </div>
              <span
                className={
                  item.version === state?.published?.version || (item.version === 0 && !state?.published)
                    ? "text-emerald-400 font-medium"
                    : "text-amber-300 font-medium"
                }
              >
                {item.version === state?.published?.version || (item.version === 0 && !state?.published)
                  ? "Diterapkan"
                  : "Menunggu update"} · v{item.version}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* History Section */}
      <section className={panel}>
        <h2 className="text-xl font-semibold">Riwayat publikasi</h2>
        <p className="mt-2 text-sm text-zinc-400">
          20 publikasi terakhir. Pemulihan menerbitkan konfigurasi lama sebagai versi baru.
        </p>
        {!state?.history.length && (
          <p className="py-8 text-sm text-zinc-500">Belum ada pembaruan yang diterbitkan.</p>
        )}
        <div className="mt-5 divide-y divide-white/10">
          {state?.history.map((release) => (
            <div
              key={release.version}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">
                  <span className="mr-3 text-blue-400">v{release.version}</span>
                  {release.note}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {release.publishedBy} ·{" "}
                  {new Date(release.publishedAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB{release.version === state.published?.version ? " · Aktif" : ""}
                </p>
              </div>
              {release.version !== state.published?.version && (
                <Button
                  variant="secondary"
                  disabled={busy || dirty}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Terbitkan kembali konfigurasi v${release.version}? Draft tersimpan juga akan diganti dengan konfigurasi ini.`
                      )
                    ) {
                      void submit({
                        action: "rollback",
                        revision: state.revision,
                        version: release.version,
                      });
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Pulihkan
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Git Update Live Modal */}
      {gitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#121216] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Terminal className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Eksekusi Pembaruan Kode (Git &amp; Hooks)</h3>
              </div>
              {!updatingGit && (
                <button
                  type="button"
                  onClick={() => setGitModalOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span>Status: <strong className="text-white">{gitStatusMessage}</strong></span>
                {gitCountdown !== null && (
                  <span className="text-amber-300 font-medium animate-pulse">
                    Memuat ulang dalam {gitCountdown} detik...
                  </span>
                )}
              </div>

              {/* Terminal Box */}
              <div className="h-80 overflow-y-auto rounded-2xl bg-[#09090c] border border-white/10 p-4 font-mono text-xs text-zinc-300 space-y-1">
                {gitLogs.map((logLine, idx) => (
                  <div key={idx} className="whitespace-pre-wrap break-words">
                    {logLine.startsWith("[ERROR]") ? (
                      <span className="text-red-400 font-bold">{logLine}</span>
                    ) : logLine.startsWith("[GIT]") || logLine.startsWith("[HOOK]") ? (
                      <span className="text-blue-300">{logLine}</span>
                    ) : logLine.startsWith("[NPM]") ? (
                      <span className="text-emerald-300">{logLine}</span>
                    ) : (
                      logLine
                    )}
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(gitLogs.join("\n"));
                    toast.success("Log pembaruan disalin ke clipboard!");
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Salin Log
              </Button>

              <div className="flex gap-2">
                {gitUpdateResult?.success && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => window.location.reload()}
                  >
                    Muat Ulang Halaman
                  </Button>
                )}
                {!updatingGit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 bg-white/5"
                    onClick={() => setGitModalOpen(false)}
                  >
                    Tutup
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
