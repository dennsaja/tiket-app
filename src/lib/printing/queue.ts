import type { PrintJob, PrintableTicket, StorageLike } from "./types";

const KEY = "tiket.usb-print-jobs.v1";
export function recoverPrintJobs(storage: StorageLike): PrintJob[] {
  const rows: PrintJob[] = JSON.parse(storage.getItem(KEY) || "[]");
  return rows.map<PrintJob>(job => ["sending", "awaiting_confirmation"].includes(job.state)
    ? { ...job, state: "unknown", message: "Sesi terputus. Periksa kertas sebelum mencetak ulang." }
    : job.state === "queued" ? { ...job, state: "failed", message: "Antrean sesi sebelumnya dibatalkan sebelum pengiriman." } : job);
}
export interface JobExecution {
  prepare(): Promise<void>;
  print(waiting: () => void): Promise<void>;
}
export class PrintQueue {
  jobs: PrintJob[] = [];
  private pending = new Map<string, JobExecution>();
  private running = false;
  storageError?: string;
  constructor(private storage: StorageLike, private changed: () => void) {
    this.jobs = recoverPrintJobs(storage);
    this.persist();
  }
  private persist() { this.storage.setItem(KEY, JSON.stringify(this.jobs)); }
  private publish() { this.persist(); this.changed(); }
  private unresolved() { return this.jobs.some(job => job.state === "unknown" && !job.resolution); }
  enqueue(ticket: PrintableTicket, execution: JobExecution, reprintOf?: string, requestId?: string) {
    const key = reprintOf ? `reprint:${reprintOf}:${requestId || crypto.randomUUID()}` : `ticket:${ticket.id}`;
    const duplicate = this.jobs.find(job => job.key === key);
    if (duplicate) return duplicate;
    if (this.storageError) throw new Error(this.storageError);
    if (this.unresolved()) throw new Error("Selesaikan hasil cetak yang belum terkonfirmasi terlebih dahulu.");
    const job: PrintJob = {
      id: crypto.randomUUID(), key, ticketId: ticket.id, ticketNumber: String(ticket.ticketNumber),
      createdAt: new Date().toISOString(), state: "queued", reprintOf,
    };
    this.jobs.push(job);
    try { this.publish(); } catch (error) { this.jobs.pop(); throw error; }
    this.pending.set(job.id, execution);
    this.startDrain();
    return job;
  }
  acknowledge(id: string) {
    const job = this.jobs.find(item => item.id === id);
    if (!job || job.state !== "unknown") return;
    job.state = "confirmed"; job.confirmation = "user";
    job.message = "Ditandai sudah tercetak oleh pengguna; bukan konfirmasi printer.";
    this.publish(); this.startDrain();
  }
  allowReprint(id: string) {
    const job = this.jobs.find(item => item.id === id);
    if (!job || !["unknown", "failed", "confirmed"].includes(job.state)) throw new Error("Pekerjaan masih berjalan.");
    if (job.state === "unknown") {
      job.resolution = "reprint_authorized";
      job.message = "Pengguna memilih cetak ulang setelah memeriksa kertas; hasil sebelumnya tetap tidak diketahui.";
      this.publish();
    }
  }
  private startDrain() {
    void this.drain().catch(error => {
      this.storageError = `Antrean dihentikan: riwayat tidak dapat disimpan. ${error instanceof Error ? error.message : String(error)}`;
      this.changed();
    });
  }
  get busy() { return this.running; }
  private async drain() {
    if (this.running) return;
    this.running = true;
    this.changed();
    try {
      for (const job of this.jobs) {
        if (this.unresolved() || this.storageError) break;
        const execution = this.pending.get(job.id);
        if (job.state !== "queued" || !execution) continue;
        let mayHavePrinted = false;
        try {
          await execution.prepare();
          job.state = "sending";
          // Persist before any printer mutation. A storage failure must stop dispatch.
          this.publish();
          mayHavePrinted = true;
          await execution.print(() => { job.state = "awaiting_confirmation"; this.publish(); });
          job.state = "confirmed"; job.confirmation = "printer";
          job.message = "Printer melaporkan penyelesaian 1 dari 1 halaman.";
        } catch (error) {
          job.state = mayHavePrinted ? "unknown" : "failed";
          job.message = `${error instanceof Error ? error.message : String(error)}${mayHavePrinted ? " Periksa kertas. Tidak diulang otomatis." : ""}`;
        } finally {
          this.pending.delete(job.id);
          this.publish();
        }
      }
    } finally { this.running = false; this.changed(); }
  }
}
