"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Send, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
const phases: Record<string, string> = { offered: "Update tersedia", downloading: "Mengunduh", verified: "APK terverifikasi", installing: "Menunggu pemasangan Android", installed: "Terpasang", failed: "Gagal", cancelled: "Dibatalkan" };
export function ApkPublisher() {
  const [data, setData] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const res = await fetch("/api/admin/mobile-console/apk", { cache: "no-store" }); if (!res.ok) throw new Error("Status APK belum dapat dimuat"); setData(await res.json()); setError(""); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  async function publish() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/mobile-console/apk", { method: "POST" }); const release = await res.json();
      if (!res.ok) throw new Error(release.error || "Update belum dapat dikirim");
      toast.success("APK " + release.versionName + " dipublikasikan. Aplikasi yang online akan menerima pemberitahuan."); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="rounded-[28px] border border-blue-500/30 bg-[#17171c] p-6 space-y-5">
    <div><p className="text-xs text-blue-400 mb-2">PEMBARUAN APLIKASI</p><h2 className="text-xl font-semibold">Kirim APK terbaru ke tim</h2><p className="mt-2 text-sm text-zinc-400">Perbarui web dari GitHub, lalu publikasikan APK yang sudah disertakan dalam rilis. Perubahan kode Android memerlukan APK baru. Pengguna menyetujui pemasangan melalui Android.</p></div>
    {error && <p className="text-sm text-red-400 flex gap-2"><AlertCircle className="h-4 w-4" />{error}</p>}
    <div className="flex flex-wrap items-center gap-4"><span className="text-sm">APK di server: <strong>{data?.available?.versionName || "Memuat…"}</strong></span><span className="text-sm text-zinc-400">Terpublikasi: {data?.published?.versionName || "Belum ada"}</span>
      <Button disabled={busy || !data} isLoading={busy} onClick={publish} leftIcon={<Send className="h-4 w-4" />}>{busy ? "Memverifikasi dan memublikasikan…" : "Push update APK terbaru"}</Button>
      <a className="text-sm text-blue-400 inline-flex gap-2" href="/download"><Download className="h-4 w-4" />Pasang dukungan updater pertama kali</a></div>
    <p className="text-xs text-zinc-500">Status di bawah dilaporkan oleh aplikasi untuk akun yang login. Unduhan menampilkan progres berdasarkan byte; pemasangan menampilkan status asli Android. Aplikasi menerima pemberitahuan saat sedang dibuka atau dibuka kembali.</p>
    {!!data?.receipts?.length && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-zinc-500 text-left"><th className="py-2">Akun</th><th>Versi tujuan</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>{data.receipts.map((row: any) => <tr key={row.userId} className="border-t border-white/10"><td className="py-3">{row.name}</td><td>{row.versionCode}</td><td>{row.revision !== data.published?.revision ? "Rilis sebelumnya" : phases[row.phase] || row.phase}</td><td className="text-xs text-zinc-400">{row.message || new Date(row.updatedAt).toLocaleString("id-ID")}</td></tr>)}</tbody></table></div>}
  </section>;
}
