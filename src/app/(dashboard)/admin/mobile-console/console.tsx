"use client";

import { useEffect, useState } from "react";
import { Smartphone, Send, Save, RotateCcw, RefreshCw, Radio } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { MobileConfig, MobileConsoleState, ConsoleAction, defaultMobileConfig } from "@/lib/mobile-console/config";

const panel = "rounded-[28px] border border-white/10 bg-[#17171c] p-6";
const input = "mt-2 w-full rounded-2xl border border-white/10 bg-[#0c0c0f] px-4 py-3 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50";
export function MobileConsole({ apkVersion, apkSupportsConsole }: { apkVersion: string; apkSupportsConsole: boolean }) {
  const [state, setState] = useState<MobileConsoleState | null>(null);
  const [draft, setDraft] = useState<MobileConfig>({ ...defaultMobileConfig });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = !!state && JSON.stringify(draft) !== JSON.stringify(state.draft);
  const unpublished = !!state && JSON.stringify(state.draft) !== JSON.stringify(state.published?.config);
  function receive(data: MobileConsoleState) { setState(data); setDraft({ ...data.draft }); setError(""); }
  async function reload() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-console", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Console gagal dimuat.");
      receive(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Console gagal dimuat."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function submit(action: ConsoleAction) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-console", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Perubahan gagal disimpan.");
      receive(data);
      if (action.action !== "save") setNote("");
      toast.success(action.action === "save" ? "Draft tersimpan. Belum dikirim ke aplikasi." : "Konfigurasi diterbitkan. Aplikasi yang mendukung akan mengambilnya saat online.");
    } catch (e) { const message = e instanceof Error ? e.message : "Perubahan gagal disimpan."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  function update<K extends keyof MobileConfig>(key: K, value: MobileConfig[K]) { setDraft(current => ({ ...current, [key]: value })); }
  return <div className="mx-auto max-w-7xl space-y-6 pb-10 text-[#f6f6f8]">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-2 text-xs tracking-[.2em] text-blue-400">HELPDESK / ANDROID</p><h1 className="text-3xl font-semibold tracking-tight">Console aplikasi</h1><p className="mt-2 text-sm text-zinc-400">Atur pengalaman tim, tanpa mengirim APK untuk setiap perubahan.</p></div>
      <Button variant="secondary" disabled={busy} onClick={() => { if (!dirty || window.confirm("Muat ulang dan buang perubahan draft yang belum disimpan?")) void reload(); }}><RefreshCw className="h-4 w-4" />Muat ulang</Button>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-[28px] bg-white p-6 text-zinc-950"><Radio className="mb-5 h-6 w-6 text-blue-600" /><p className="text-sm">Konfigurasi diterbitkan</p><p className="mt-2 text-3xl font-semibold">{state ? state.published ? `v${state.published.version}` : "Default" : "—"}</p><p className="mt-2 text-xs text-zinc-500">Status publikasi server; bukan konfirmasi semua perangkat.</p></div>
      <div className={panel}><Smartphone className="mb-5 h-6 w-6 text-blue-400" /><p className="text-sm text-zinc-400">Dukungan aplikasi</p><p className="mt-2 text-2xl font-semibold">Mulai versi 3.3.0</p><p className="mt-2 text-xs text-zinc-400">Perlu satu kali memasang APK pendukung. APK 3.2.0 belum membaca konfigurasi ini.</p></div>
      <div className={panel}><p className="text-sm text-zinc-400">Penerapan otomatis</p><p className="mt-2 text-2xl font-semibold">Saat online</p><p className="mt-3 text-sm leading-relaxed text-zinc-400">Diperiksa saat membuka aplikasi dan setiap 60 detik di layar utama. Saat offline, pengaturan terakhir tetap digunakan.</p></div>
    </div>
    <p className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-sm leading-relaxed text-blue-100">Console ini mengubah konten dan pengaturan yang sudah didukung aplikasi. Perubahan kode GPS, login, layar baru, atau perbaikan native tetap memerlukan APK. {apkSupportsConsole ? `APK ${apkVersion} di halaman unduh sudah mendukung console.` : `APK unduhan saat ini ${apkVersion}. Dukungan console baru tersedia setelah APK 3.3.0 atau lebih baru dibangun dan diterbitkan.`}</p>
    {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
    {!state && !error && <p role="status" className="text-zinc-400">Memuat console…</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form className={panel + " space-y-5"} onSubmit={event => { event.preventDefault(); if (state) void submit({ action: "save", revision: state.revision, config: draft }); }}>
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Rancang pembaruan</h2><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">{dirty ? "Belum disimpan" : "Draft"}</span></div>
        <fieldset disabled={busy || !state} className="space-y-5 disabled:opacity-60">
          <label className="block text-sm">Teks beranda<input required maxLength={140} className={input} value={draft.homeSubtitle} onChange={e => update("homeSubtitle", e.target.value)} /></label>
          <label className="block text-sm">Judul pengumuman<input maxLength={80} className={input} value={draft.announcementTitle} placeholder="Informasi untuk tim" onChange={e => update("announcementTitle", e.target.value)} /></label>
          <label className="block text-sm">Isi pengumuman<textarea maxLength={600} rows={4} className={input} value={draft.announcementBody} placeholder="Kosongkan untuk menyembunyikan pengumuman." onChange={e => update("announcementBody", e.target.value)} /></label>
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-4 text-sm">Tampilkan grafik aktivitas<input type="checkbox" className="h-5 w-5 accent-blue-500" checked={draft.showActivityChart} onChange={e => update("showActivityChart", e.target.checked)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Jumlah tiket di beranda<input required type="number" min={1} max={8} className={input} value={draft.recentTicketLimit} onChange={e => update("recentTicketLimit", Number(e.target.value))} /></label>
            <label className="text-sm">Penyegaran data (detik)<input required type="number" min={15} max={120} className={input} value={draft.refreshIntervalSeconds} onChange={e => update("refreshIntervalSeconds", Number(e.target.value))} /></label>
          </div>
          <p className="text-xs text-zinc-400">Interval ini berlaku untuk daftar tiket dan chat di layar utama. Pengiriman GPS tetap mengikuti aturan aplikasi.</p>
          <Button type="submit" disabled={!dirty || busy}><Save className="h-4 w-4" />Simpan draft</Button>
          <Button type="button" variant="secondary" className="ml-2" onClick={() => setDraft({ ...defaultMobileConfig })}>Gunakan pengaturan bawaan</Button>
        </fieldset>
      </form>
      <div className="space-y-6">
        <div className={panel}><p className="mb-4 text-xs tracking-widest text-zinc-500">PRATINJAU KONTEN BERANDA</p><h2 className="text-2xl font-semibold">Halo, Tim.</h2><p className="mt-2 break-words text-sm text-zinc-400">{draft.homeSubtitle}</p>
          {draft.announcementBody.trim() && <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4"><p className="break-words font-medium text-blue-200">{draft.announcementTitle.trim() || "Informasi tim"}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">{draft.announcementBody}</p></div>}
          <div className="mt-5 rounded-2xl bg-white p-5 text-zinc-900"><p className="text-sm">Tiket terbaru</p><p className="mt-1 text-2xl font-semibold">Maks. {draft.recentTicketLimit}</p></div>
          {draft.showActivityChart && <div className="mt-4 rounded-2xl border border-white/10 p-4 text-sm text-zinc-400">Grafik aktivitas ditampilkan</div>}
          <p className="mt-4 text-xs text-zinc-500">Pratinjau isi draft. Data tiket asli tampil di aplikasi.</p>
        </div>
        <div className={panel}><h2 className="text-lg font-semibold">Terbitkan untuk tim</h2><p className="mt-2 text-sm text-zinc-400">Simpan draft terlebih dahulu. Publikasi tersedia untuk semua akun staf di aplikasi yang mendukung.</p>
          <label className="mt-4 block text-sm">Catatan perubahan<input maxLength={240} className={input} disabled={busy || !state} value={note} onChange={e => setNote(e.target.value)} placeholder="Contoh: Pengumuman jadwal pemeliharaan" /></label>
          <Button className="mt-4 w-full" disabled={busy || !state || dirty || !unpublished || !note.trim()} onClick={() => state && void submit({ action: "publish", revision: state.revision, note })}><Send className="h-4 w-4" />Terbitkan pembaruan</Button>
        </div>
      </div>
    </div>
    <section className={panel}><h2 className="text-xl font-semibold">Riwayat publikasi</h2><p className="mt-2 text-sm text-zinc-400">20 publikasi terakhir. Pemulihan menerbitkan konfigurasi lama sebagai versi baru.</p>
      {!state?.history.length && <p className="py-8 text-sm text-zinc-500">Belum ada pembaruan yang diterbitkan.</p>}
      <div className="mt-5 divide-y divide-white/10">{state?.history.map(release => <div key={release.version} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="min-w-0"><p className="break-words font-medium"><span className="mr-3 text-blue-400">v{release.version}</span>{release.note}</p><p className="mt-1 text-xs text-zinc-500">{release.publishedBy} · {new Date(release.publishedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB{release.version === state.published?.version ? " · Aktif" : ""}</p></div>
        {release.version !== state.published?.version && <Button variant="secondary" disabled={busy || dirty} onClick={() => { if (window.confirm(`Terbitkan kembali konfigurasi v${release.version}? Draft tersimpan juga akan diganti dengan konfigurasi ini.`)) void submit({ action: "rollback", revision: state.revision, version: release.version }); }}><RotateCcw className="h-4 w-4" />Pulihkan</Button>}
      </div>)}</div>
    </section>
  </div>;
}
