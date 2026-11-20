"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { renderLabel, type RenderedLabel } from "@/lib/printing/layout";
import { createPrintTest } from "@/lib/printing/test-label";
import { JOB_LABELS, type ConnectionState, type LabelProfile, type LayoutSettings, type PrintableTicket, type PrintJob, type PrinterIdentity } from "@/lib/printing/types";

interface Props {
  identity: PrinterIdentity; profile?: LabelProfile; settings: LayoutSettings;
  state: ConnectionState; busy: boolean; jobs: PrintJob[];
  onPrint(ticket: PrintableTicket, preview: RenderedLabel): Promise<unknown>;
}
export function PrinterTestPanel({ identity, profile, settings, state, busy, jobs, onPrint }: Props) {
  const [sample, setSample] = React.useState(createPrintTest);
  const [preview, setPreview] = React.useState<RenderedLabel>();
  const [error, setError] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [lastId, setLastId] = React.useState<string>();
  const pending = React.useRef(false);
  React.useEffect(() => {
    let cancelled = false;
    setPreview(undefined); setError("");
    if (profile) void renderLabel(sample, profile, identity, settings)
      .then(result => { if (!cancelled) setPreview(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [sample, profile, identity, settings]);
  async function print() {
    if (pending.current || busy || state !== "ready" || !profile?.confirmed || !preview) return;
    pending.current = true; setSending(true); setError("");
    try {
      await onPrint(sample, preview);
      setLastId(sample.id); setSample(createPrintTest());
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { pending.current = false; setSending(false); }
  }
  const lastJob = jobs.find(job => job.ticketId === lastId);
  return <section aria-labelledby="printer-test-title" className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20">
    <strong id="printer-test-title">Uji coba cetak</strong>
    <p className="text-xs">Cetak satu label berisi teks uji, bingkai batas cetak, dan penggaris bertanda tiap 5 mm. Tidak membuat tiket baru. Untuk label kabel, bagian ekor dibiarkan kosong.</p>
    {!profile?.confirmed && <p className="text-xs text-amber-700 dark:text-amber-300">Cocokkan ukuran dan posisi ekor dengan label fisik, lalu tekan Konfirmasi ukuran dan bentuk label sebelum mencetak.</p>}
    {preview && <div className="overflow-auto rounded-lg bg-zinc-200 p-3">
      <img src={preview.previewUrl} width={preview.canvas.width} height={preview.canvas.height} style={{ imageRendering: "pixelated", maxWidth: "none" }} alt="Preview label uji: teks, bingkai, dan penggaris 5 mm" />
      <p className="mt-2 text-xs text-zinc-700">{preview.canvas.width} × {preview.canvas.height} piksel · preview sesuai gambar yang dikirim ke printer</p>
    </div>}
    {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    <Button size="sm" disabled={sending || busy || state !== "ready" || !profile?.confirmed || !preview} onClick={() => void print()}>{sending ? "Menyiapkan label uji…" : "Cetak 1 label uji"}</Button>
    {lastJob && <p role="status" className="text-xs">Label uji · {JOB_LABELS[lastJob.state]}{lastJob.message && <span className="block">{lastJob.message}</span>}</p>}
  </section>;
}
