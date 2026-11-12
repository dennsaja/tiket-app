/// <reference types="w3c-web-serial" />

export type ConnectionState = "disconnected" | "connecting" | "ready" | "printing" | "error";
export type PrinterTransport = "USB" | "Bluetooth";
export type SizeSource = "printer" | "mapping" | "manual";
export const SIZE_SOURCES: Record<SizeSource, string> = {
  printer: "Terdeteksi dari printer", mapping: "Pemetaan kode roll", manual: "Diatur manual",
};
export interface PrinterIdentity {
  model: "D110" | "D110_M";
  modelId: number;
  firmware?: string;
  serial?: string;
  protocol: number;
  dpi: number;
  headPixels: number;
  geometrySource: string;
  task: "D110" | "B1" | "D110M_V4";
}
export interface LabelSize { widthMm: number; lengthMm: number }
export interface PaperReading {
  checkedAt: string;
  inserted?: boolean;
  lidClosed?: boolean;
  rollId?: string;
  productCode?: string;
  labelType?: number;
  dimensions?: LabelSize;
  notes: string[];
  raw?: unknown;
}
export interface LabelProfile extends LabelSize {
  source: SizeSource;
  productCode?: string;
  folded?: boolean;
  measuredAtConfirmation?: LabelSize;
  rollId?: string;
  labelType: number;
  confirmed: boolean;
  sourceDetail: string;
}
export interface LayoutSettings {
  marginMm: number;
  offsetXmm: number;
  offsetYmm: number;
  minFontPx: number;
  orientation: "landscape" | "portrait";
  template: "auto" | "full" | "compact";
  qr: boolean;
}
export const DEFAULT_LAYOUT: LayoutSettings = {
  marginMm: 0.75, offsetXmm: 0, offsetYmm: 0, minFontPx: 11,
  orientation: "landscape", template: "auto", qr: false,
};
export interface PrintableTicket {
  id: string;
  ticketNumber: number | string;
  title: string;
  ticketType?: string;
  priority?: string;
  reporterName?: string | null;
  reporterPhone?: string | null;
  transactionCode?: string | null;
}
export type JobState = "queued" | "sending" | "awaiting_confirmation" | "confirmed" | "failed" | "unknown";
export interface PrintJob {
  id: string;
  key: string;
  ticketId: string;
  ticketNumber: string;
  createdAt: string;
  state: JobState;
  message?: string;
  confirmation?: "printer" | "user";
  reprintOf?: string;
  resolution?: "reprint_authorized";
}
export const JOB_LABELS: Record<JobState, string> = {
  queued: "Antre", sending: "Mengirim", awaiting_confirmation: "Menunggu konfirmasi",
  confirmed: "Selesai terkonfirmasi", failed: "Gagal", unknown: "Belum terkonfirmasi",
};
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
