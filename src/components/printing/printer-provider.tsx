"use client";

import * as React from "react";
import { Printer, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiFetch } from "@/lib/network/client";
import { PrintQueue, recoverPrintJobs } from "@/lib/printing/queue";
import { paperFingerprint, resolveProfile, saveProfile } from "@/lib/printing/profiles";
import { renderLabel } from "@/lib/printing/layout";
import type { RenderedLabel } from "@/lib/printing/layout";
import { DEFAULT_LAYOUT, JOB_LABELS, SIZE_SOURCES } from "@/lib/printing/types";
import type { ConnectionState, LabelProfile, LayoutSettings, PaperReading, PrintableTicket, PrintJob, PrinterIdentity } from "@/lib/printing/types";
import type { NiimbotUsbAdapter } from "@/lib/printing/adapter";
import { usePrinterPresence } from "./use-printer-presence";

const STATE_LABELS: Record<ConnectionState, string> = { disconnected: "Tidak terhubung", connecting: "Menghubungkan", ready: "Siap", printing: "Mencetak", error: "Bermasalah" };
const SAMPLE: PrintableTicket = { id: "USB-TEST", ticketNumber: "UJI-001", title: "Uji cetak USB", reporterName: "NIIMBOT", priority: "normal" };
interface PrinterContextValue {
  state: ConnectionState; statusLabel: string; autoPrint: boolean;
  setAutoPrint(value: boolean): void;
  open(ticket?: PrintableTicket): void;
  afterSaved(ticket: PrintableTicket): void;
}
const PrinterContext = React.createContext<PrinterContextValue | null>(null);
export function usePrinter() {
  const context = React.useContext(PrinterContext);
  if (!context) throw new Error("PrinterProvider belum dipasang.");
  return context;
}

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConnectionState>("disconnected");
  const [visible, setVisible] = React.useState(false);
  const [ticket, setTicket] = React.useState<PrintableTicket>(SAMPLE);
  const [identity, setIdentity] = React.useState<PrinterIdentity>();
  const sharedStatus = usePrinterPresence(!!identity);
  const statusLabel = identity ? "Terhubung · komputer ini" : sharedStatus || STATE_LABELS[state];
  const [paper, setPaper] = React.useState<PaperReading>();
  const [profile, setProfile] = React.useState<LabelProfile>();
  const [settings, setSettings] = React.useState<LayoutSettings>(DEFAULT_LAYOUT);
  const [autoPrint, updateAutoPrint] = React.useState(false);
  const [preview, setPreview] = React.useState<RenderedLabel>();
  const [layoutError, setLayoutError] = React.useState("");
  const [error, setError] = React.useState("");
  const [diagnostics, setDiagnostics] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [jobs, setJobs] = React.useState<PrintJob[]>([]);
  const [reprintOf, setReprintOf] = React.useState<string>();
  const [manual, setManual] = React.useState({ widthMm: "", lengthMm: "", labelType: "1", folded: false });
  const adapter = React.useRef<NiimbotUsbAdapter | null>(null);
  const queue = React.useRef<PrintQueue | null>(null);
  const releaseLock = React.useRef<(() => void) | null>(null);
  const connecting = React.useRef(false);
  const operation = React.useRef(false);
  const reprintIntent = React.useRef<string>("");
  const config = React.useRef({ state, profile, paper, identity, settings, autoPrint });
  config.current = { state, profile, paper, identity, settings, autoPrint };

  const report = React.useCallback((err: unknown) => { setError(err instanceof Error ? err.message : String(err)); }, []);
  React.useEffect(() => {
    try {
      updateAutoPrint(localStorage.getItem("tiket.usb-auto-print") === "true");
      setJobs(recoverPrintJobs(localStorage));
      const saved = JSON.parse(localStorage.getItem("tiket.usb-layout.v1") || "null");
      if (saved) setSettings({ ...DEFAULT_LAYOUT, ...saved });
    } catch { setError("Penyimpanan browser tidak tersedia. Cetak memerlukan penyimpanan job untuk mencegah duplikasi."); }
    return () => { void adapter.current?.disconnect().finally(() => releaseLock.current?.()); };
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    setPreview(undefined); setLayoutError("");
    if (profile && identity) void renderLabel(ticket, profile, identity, settings)
      .then(result => { if (!cancelled) setPreview(result); })
      .catch(err => { if (!cancelled) setLayoutError(String(err.message)); });
    return () => { cancelled = true; };
  }, [ticket, profile, identity, settings]);

  function open(next?: PrintableTicket) {
    setTicket(next || SAMPLE); setReprintOf(undefined); setVisible(true);
    if (!visible && adapter.current?.identity) void checkPaper();
  }
  function setAutoPrint(value: boolean) {
    try { localStorage.setItem("tiket.usb-auto-print", String(value)); updateAutoPrint(value); } catch (err) { report(err); }
  }
  function changeSettings(patch: Partial<LayoutSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { localStorage.setItem("tiket.usb-layout.v1", JSON.stringify(next)); } catch (err) { report(err); }
  }
  function displayPaper(reading: PaperReading) {
    const resolved = resolveProfile(reading, localStorage);
    setPaper(reading); setProfile(resolved);
    setManual({ widthMm: resolved ? String(resolved.widthMm) : "", lengthMm: resolved ? String(resolved.lengthMm) : "",
      labelType: String(resolved?.labelType || reading.labelType || 1), folded: !!resolved?.folded });
  }
  async function checkPaper() {
    if (!adapter.current || operation.current || queue.current?.busy) return;
    operation.current = true; setChecking(true); setError("");
    try {
      const device = adapter.current;
      const reading = await device.readPaper();
      if (adapter.current !== device || !device.client.isConnected()) return;
      displayPaper(reading);
      if (adapter.current?.client.isConnected()) setState("ready");
    } catch (err) { setProfile(undefined); report(err); setState("error"); }
    finally { operation.current = false; setChecking(false); }
  }
  async function connect() {
    if (connecting.current || adapter.current) return;
    connecting.current = true; setError(""); setState("connecting");
    try {
      if (!window.isSecureContext || !navigator.serial?.requestPort) throw new Error("Web Serial tidak tersedia. Gunakan Chrome/Edge desktop melalui HTTPS atau localhost. USB yang hanya mengisi daya tidak dapat dipakai mencetak.");
      if (!navigator.locks) throw new Error("Browser tidak mendukung penguncian printer antar-tab. Gunakan Chrome/Edge desktop terbaru.");
      // Must run in the click handler before lazy loading or other awaits.
      const port = await navigator.serial.requestPort();
      const portInfo = port.getInfo();
      setDiagnostics(JSON.stringify({ transport: "USB serial", port: portInfo, secureContext: window.isSecureContext, browser: navigator.userAgent }, null, 2));
      if (portInfo.usbVendorId === undefined || portInfo.usbProductId === undefined) throw new Error("Port terpilih tidak memiliki VID/PID USB. Hanya perangkat USB serial yang diizinkan.");
      await new Promise<void>((resolve, reject) => {
        void navigator.locks.request("tiket-niimbot-usb-printer", { ifAvailable: true }, async lock => {
          if (!lock) { reject(new Error("Printer sedang dikendalikan tab lain. Putuskan di tab tersebut terlebih dahulu.")); return; }
          await new Promise<void>(release => { releaseLock.current = release; resolve(); });
        }).catch(reject);
      });
      queue.current = new PrintQueue(localStorage, () => {
        setJobs([...(queue.current?.jobs || [])]);
        if (queue.current?.storageError) setError(queue.current.storageError);
      });
      setJobs([...queue.current.jobs]);
      const { NiimbotUsbAdapter } = await import("@/lib/printing/adapter");
      const device = new NiimbotUsbAdapter(port);
      adapter.current = device;
      device.client.on("disconnect", () => {
        setState("disconnected"); setProfile(undefined); setIdentity(undefined); setPaper(undefined);
        adapter.current = null;
        releaseLock.current?.(); releaseLock.current = null;
      });
      const result = await device.connect();
      setIdentity(result.identity); setState("ready");
      setDiagnostics(previous => `${previous}\n${JSON.stringify(result, null, 2)}`);
      await checkPaper();
    } catch (err) {
      const { usbError } = await import("@/lib/printing/usb-connection");
      const message = usbError(err); setError(message); setState("error");
      setDiagnostics(previous => `${previous}\n${new Date().toISOString()} ${message}`);
      await adapter.current?.disconnect(); adapter.current = null;
      releaseLock.current?.(); releaseLock.current = null;
    } finally { connecting.current = false; }
  }
  async function disconnect() {
    try { await adapter.current?.disconnect(); }
    catch (err) { report(err); }
    finally { adapter.current = null; releaseLock.current?.(); releaseLock.current = null; setProfile(undefined); setIdentity(undefined); setPaper(undefined); setState("disconnected"); }
  }
  function confirmManual() {
    if (!paper || paper.inserted === false || checking || queue.current?.busy) return;
    try {
      const next: LabelProfile = {
        widthMm: Number(manual.widthMm), lengthMm: Number(manual.lengthMm), labelType: Number(manual.labelType),
        source: "manual", sourceDetail: "Ukuran dikonfirmasi pengguna", confirmed: true, rollId: paper.rollId,
        productCode: paper.productCode, folded: manual.folded, measuredAtConfirmation: paper.dimensions,
      };
      saveProfile(next, localStorage); setProfile(next); setError("");
    } catch (err) { report(err); }
  }
  function editManual(patch: Partial<typeof manual>) {
    setManual(previous => ({ ...previous, ...patch }));
    setProfile(previous => previous ? { ...previous, confirmed: false } : previous);
  }
  async function submit(nextTicket: PrintableTicket, rendered?: RenderedLabel, previousJob?: string) {
    const current = config.current;
    const device = adapter.current, currentQueue = queue.current;
    const existing = !previousJob && currentQueue?.jobs.find(job => job.key === `ticket:${nextTicket.id}`);
    if (existing) {
      if (rendered) throw new Error(`Tiket ini sudah memiliki pekerjaan: ${JOB_LABELS[existing.state]}. Gunakan Cetak ulang pada riwayat jika diperlukan.`);
      return;
    }
    if (current.state !== "ready" && current.state !== "printing") throw new Error("USB belum siap. Hubungkan melalui tombol Hubungkan USB.");
    if (!device || !currentQueue || !current.identity || !current.profile?.confirmed || !current.paper) throw new Error("Periksa kertas dan konfirmasikan ukuran sebelum mencetak.");
    if (operation.current) throw new Error("Pemeriksaan kertas masih berjalan.");
    const selectedProfile = current.profile, selectedPaper = current.paper;
    const bitmap = rendered || await renderLabel(nextTicket, selectedProfile, current.identity, current.settings);
    if (bitmap.signature !== JSON.stringify([nextTicket, selectedProfile, current.identity, current.settings])) throw new Error("Preview sedang dihitung ulang. Tunggu sebelum mencetak.");
    if (previousJob) currentQueue.allowReprint(previousJob);
    currentQueue.enqueue(nextTicket, {
      prepare: async () => {
        if (!device.client.isConnected()) throw new Error("USB terputus sebelum pengiriman.");
        const reading = await device.readPaper();
        // A manual choice is valid for this session only while identity and dimensions agree.
        const observedSizeChanged = reading.dimensions?.widthMm !== selectedPaper.dimensions?.widthMm ||
          reading.dimensions?.lengthMm !== selectedPaper.dimensions?.lengthMm;
        if (reading.inserted === false || observedSizeChanged || paperFingerprint(reading, selectedProfile) !== paperFingerprint(selectedPaper, selectedProfile)
          || (reading.labelType !== undefined && reading.labelType !== selectedProfile.labelType)) {
          if (adapter.current === device) displayPaper(reading);
          throw new Error("Informasi roll/ukuran berubah. Periksa Kertas, konfirmasikan ukuran, lalu tinjau preview baru.");
        }
        await device.preflight(selectedProfile);
      },
      print: async waiting => {
        setState("printing");
        try { await device.print(bitmap.canvas, selectedProfile, waiting); if (device.client.isConnected()) setState("ready"); }
        catch (err) { setState(device.client.isConnected() ? "error" : "disconnected"); throw err; }
      },
    }, previousJob, previousJob ? reprintIntent.current : undefined);
  }
  function afterSaved(next: PrintableTicket) {
    if (!config.current.autoPrint) return;
    if (config.current.state !== "ready") { setError("Tiket tersimpan. Cetak otomatis dilewati karena USB belum siap."); open(next); return; }
    void submit(next).catch(err => { report(err); open(next); });
  }
  async function chooseReprint(job: PrintJob) {
    try {
      const response = await apiFetch(`/api/tickets/${encodeURIComponent(job.ticketId)}`);
      if (!response.ok) throw new Error("Tiket untuk cetak ulang tidak dapat dimuat atau izin akses ditolak.");
      reprintIntent.current = crypto.randomUUID();
      setTicket(await response.json()); setReprintOf(job.id);
    } catch (err) { report(err); }
  }
  async function acknowledgeJob(id: string) {
    try {
      if (adapter.current) { queue.current?.acknowledge(id); return; }
      await navigator.locks.request("tiket-niimbot-usb-printer", { ifAvailable: true }, lock => {
        if (!lock) throw new Error("Riwayat sedang digunakan tab lain.");
        queue.current = new PrintQueue(localStorage, () => setJobs([...(queue.current?.jobs || [])]));
        queue.current.acknowledge(id);
        setJobs([...queue.current.jobs]);
      });
    } catch (err) { report(err); }
  }
  const busy = checking || state === "connecting" || !!queue.current?.busy;
  const canPrint = (state === "ready" || state === "printing") && !!profile?.confirmed && !!preview && !checking;
  const displayedJobs = [...jobs].reverse().filter((job, index) => index < 30 || ["unknown", "queued", "sending", "awaiting_confirmation"].includes(job.state));
  return <PrinterContext.Provider value={{ state, statusLabel, autoPrint, setAutoPrint, open, afterSaved }}>
    {children}
    <Modal open={visible} onOpenChange={setVisible} title="Printer label USB · NIIMBOT D110" description="Koneksi dan antrean cetak pada browser ini" size="xl">
      <div className="space-y-5 text-sm">
        <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2">
          <strong>{statusLabel}</strong>
          {identity && <span>{STATE_LABELS[state]}</span>}
          <Button size="sm" onClick={() => void connect()} disabled={state === "connecting" || !!adapter.current}>Hubungkan USB</Button>
          <Button size="sm" variant="outline" onClick={() => void disconnect()} disabled={!adapter.current}>Putuskan</Button>
          <Button size="sm" variant="outline" onClick={() => void checkPaper()} disabled={busy || !adapter.current}>Periksa Kertas</Button>
          <Button size="sm" variant="outline" onClick={() => { setTicket({ ...SAMPLE, id: `USB-TEST-${crypto.randomUUID()}` }); setReprintOf(undefined); }} disabled={busy}>Cetak Uji</Button>
        </div>
        <p className="text-xs text-zinc-500">Admin dan NOC dapat melihat status USB dari komputer lain. Jalankan pencetakan di komputer yang memegang koneksi USB melalui Chrome atau Edge.</p>
        {identity && <div className="rounded-lg border p-3 text-xs space-y-1"><p>{identity.model} · ID {identity.modelId} · firmware {identity.firmware || "tidak dilaporkan"} · protokol {identity.protocol} · SN {identity.serial || "tidak dilaporkan"}</p><p>{identity.dpi} DPI · kepala cetak {identity.headPixels}px (≈{(identity.headPixels * 25.4 / identity.dpi).toFixed(2)} mm)</p><p className="text-zinc-500">{identity.geometrySource}</p></div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {identity && <><section className="space-y-3 rounded-lg border p-3">
          <strong>Kertas dan ukuran</strong>
          {paper && <p>{paper.inserted === true ? "Kertas terdeteksi" : paper.inserted === false ? "Sensor printer melaporkan kertas kosong" : "Printer belum melaporkan keberadaan kertas"}</p>}
          {paper && <div className="text-xs space-y-1"><p>Roll: {paper.rollId || "identitas tidak tersedia"} · kode produk: {paper.productCode || "tidak tersedia"}</p><p>Diperiksa: {new Date(paper.checkedAt).toLocaleString("id-ID")}</p>{paper.notes.map(note => <p key={note}>{note}</p>)}</div>}
          <p className="text-xs">{profile ? `${SIZE_SOURCES[profile.source]}: ${profile.widthMm} × ${profile.lengthMm} mm · ${profile.confirmed ? "dikonfirmasi" : "perlu konfirmasi"}. ${profile.sourceDetail}` : "Ukuran belum diketahui. Masukkan ukuran pada kemasan atau ukur label, lalu konfirmasikan."}</p>
          <div className="grid grid-cols-2 gap-3">
            <label>Lebar melintang (mm)<input className="mt-1 w-full rounded border p-2 bg-transparent" type="number" min="5" max="15" step="0.1" value={manual.widthMm} disabled={busy} onChange={event => editManual({ widthMm: event.target.value })} /></label>
            <label>Panjang searah feed (mm)<input className="mt-1 w-full rounded border p-2 bg-transparent" type="number" min="10" max="200" step="0.1" value={manual.lengthMm} disabled={busy} onChange={event => editManual({ lengthMm: event.target.value })} /></label>
          </div>
          <label className="block">Jenis label <select className="rounded border p-2 bg-transparent" value={manual.labelType} disabled={busy} onChange={event => editManual({ labelType: event.target.value })}><option value="1">Bercelah</option><option value="5">Transparan</option></select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={manual.folded} disabled={busy} onChange={event => editManual({ folded: event.target.checked })} />Label lipat dua panel</label>
          {manual.folded && <p className="text-xs">Masukkan panjang seluruh strip sebelum dilipat. Kedua panel dibagi rata sepanjang strip. Panel kedua diputar 180°.</p>}
          <Button size="sm" variant="outline" onClick={confirmManual} disabled={!paper || paper.inserted === false || busy}>Simpan ukuran dan bentuk label</Button>
          <p className="text-xs text-zinc-500">Ukuran dan bentuk dapat digunakan kembali pada browser ini untuk roll atau kode produk yang sama.</p>
        </section>
        <section className="space-y-3">
          <div className="flex gap-3 flex-wrap"><label>Template <select className="rounded border p-1 bg-transparent" value={settings.template} onChange={event => changeSettings({ template: event.target.value as LayoutSettings["template"] })}><option value="auto">Otomatis sesuai ukuran</option><option value="full">Lengkap</option><option value="compact">Ringkas: nomor & transaksi</option></select></label><label>Orientasi <select className="rounded border p-1 bg-transparent" value={settings.orientation} onChange={event => changeSettings({ orientation: event.target.value as LayoutSettings["orientation"] })}><option value="landscape">Mendatar</option><option value="portrait">Tegak</option></select></label></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{([
            ["marginMm", "Margin (mm)", 0.25, 5, 0.25], ["minFontPx", "Font minimum (px)", 8, 24, 1],
            ["offsetXmm", "Offset X (mm)", -5, 5, 0.1], ["offsetYmm", "Offset Y (mm)", -5, 5, 0.1],
          ] as const).map(([key, label, min, max, step]) => <label key={key} className="text-xs">{label}<input className="mt-1 w-full rounded border p-2 bg-transparent" type="number" min={min} max={max} step={step} value={settings[key]} onChange={event => changeSettings({ [key]: Number(event.target.value) })} /></label>)}</div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.qr} onChange={event => changeSettings({ qr: event.target.checked })} />Sertakan QR identitas tiket (jika area cukup)</label>
          <p className="text-xs">Preview tiket #{ticket.ticketNumber}. Lebar fisik roll dapat melebihi area kepala cetak. Preview menampilkan bitmap area cetak yang sama persis dengan data yang dikirim; tanpa peregangan bitmap.</p>
          {layoutError && <p role="alert" className="text-amber-700 dark:text-amber-300">{layoutError}</p>}
          {preview && <div className="overflow-auto rounded-lg bg-zinc-200 p-4"><img src={preview.previewUrl} width={preview.canvas.width} height={preview.canvas.height} style={{ imageRendering: "pixelated", maxWidth: "none" }} alt={`Preview label tiket ${ticket.ticketNumber}`} /><p className="mt-2 text-xs text-zinc-700">{preview.canvas.width} × {preview.canvas.height} piksel · {preview.plan.compact ? "Ringkas: judul, PIC, telepon, jenis, dan prioritas tidak dicantumkan." : "Lengkap"}</p></div>}
          <Button size="sm" disabled={!canPrint} onClick={() => {
            if (reprintOf && !window.confirm("Cetak ulang dapat menghasilkan label ganda. Sudah memeriksa kertas dan ingin mencetak ulang?")) return;
            void submit(ticket, preview, reprintOf).then(() => setReprintOf(undefined)).catch(report);
          }}>{reprintOf ? "Konfirmasi Cetak ulang" : ticket.id.startsWith("USB-TEST") ? "Kirim cetak uji" : "Cetak Tiket"}</Button>
          <AutoPrintToggle />
        </section></>}
        <section className="space-y-2"><strong>Antrean dan riwayat browser ini</strong>{jobs.length === 0 && <p className="text-xs">Belum ada pekerjaan pada browser ini.</p>}{displayedJobs.map(job => <div key={job.id} className="rounded border p-2 text-xs space-y-1"><p>#{job.ticketNumber} · {JOB_LABELS[job.state]}{job.confirmation === "user" ? " (ditandai pengguna)" : ""}</p><p className="font-mono break-all">Job {job.id}</p>{job.message && <p>{job.message}</p>}{job.state === "unknown" && <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm("Anda sudah memeriksa dan memastikan label ini tercetak?")) void acknowledgeJob(job.id); }}>Tandai sudah tercetak</Button>}{["unknown", "confirmed", "failed"].includes(job.state) && <Button size="sm" variant="outline" disabled={!adapter.current || busy} onClick={() => void chooseReprint(job)}>Cetak ulang</Button>}</div>)}</section>
        <details><summary>Diagnostik USB</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{diagnostics || "Belum ada port yang dipilih. Batal/tidak muncul di pemilih port belum cukup untuk menyimpulkan USB unit hanya untuk pengisian daya."}</pre>{paper && <pre className="mt-2 max-h-60 overflow-auto text-xs">{JSON.stringify(paper.raw, null, 2)}</pre>}</details>
      </div>
    </Modal>
  </PrinterContext.Provider>;
}
export function PrinterSettingsButton() {
  const printer = usePrinter();
  return <Button variant="ghost" size="sm" onClick={() => printer.open()} leftIcon={<Usb className="h-4 w-4" />}>Printer USB · {printer.statusLabel}</Button>;
}
export function PrintTicketButton({ ticket }: { ticket: PrintableTicket }) {
  const printer = usePrinter();
  return <Button variant="outline" size="sm" onClick={() => printer.open(ticket)} leftIcon={<Printer className="h-4 w-4" />}>Cetak Tiket</Button>;
}
export function AutoPrintToggle() {
  const printer = usePrinter();
  return <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={printer.autoPrint} onChange={event => printer.setAutoPrint(event.target.checked)} />Cetak otomatis setelah tiket tersimpan (hanya saat USB siap)</label>;
}
