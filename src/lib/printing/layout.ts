import QRCode from "qrcode";
import type { LabelProfile, LayoutSettings, PrintableTicket, PrinterIdentity } from "./types";
import { validProfile } from "./profiles";
import { isPrintTest, printTestLines } from "./test-label";
import { customerLabelName, isInstallationTicketType } from "@/lib/tickets/customer-name";

export const mmToPixels = (mm: number, dpi: number) => Math.round(mm * dpi / 25.4);
export type MeasureText = (text: string, size: number) => { width: number; ascent: number; descent: number };
interface Line { text: string; x: number; baseline: number; size: number }
export interface LayoutPlan {
  width: number; height: number; lines: Line[];
  bodyX: number; bodyWidth: number; panelWidth: number;
  compact?: boolean;
  customerLabel?: boolean;
  testPattern?: { x: number; y: number; width: number; height: number; rulerStep: number };
  qr?: { x: number; y: number; moduleSize: number; size: number; data: Uint8Array };
  error?: string;
}
export function ticketLines(ticket: PrintableTicket, compact: boolean): string[] {
  if (isInstallationTicketType(ticket.ticketType)) {
    const name = customerLabelName(ticket.reporterName);
    return name ? [name] : [];
  }
  const lines = [`TIKET #${ticket.ticketNumber}`];
  if (ticket.transactionCode) lines.push(`Transaksi: ${ticket.transactionCode}`);
  // Number and transaction code are mandatory even in compact mode.
  if (!compact) {
    lines.push(ticket.title);
    if (ticket.ticketType) lines.push(ticket.ticketType.replaceAll("_", " "));
    if (ticket.reporterName) lines.push(`PIC: ${ticket.reporterName}`);
    if (ticket.reporterPhone) lines.push(`Tel: ${ticket.reporterPhone}`);
    if (ticket.priority) lines.push(`Prioritas: ${ticket.priority}`);
  }
  return lines;
}
function wrap(text: string, width: number, fontSize: number, measure: MeasureText): string[] | undefined {
  const lines: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/u)) {
    const joined = current ? `${current} ${word}` : word;
    if (measure(joined, fontSize).width <= width) { current = joined; continue; }
    if (current) { lines.push(current); current = ""; }
    for (const letter of Array.from(word)) {
      if (measure(letter, fontSize).width > width) return;
      if (measure(current + letter, fontSize).width > width) { lines.push(current); current = ""; }
      current += letter;
    }
  }
  if (current) lines.push(current);
  return lines;
}
export function planLabel(ticket: PrintableTicket, profile: LabelProfile, printer: PrinterIdentity, settings: LayoutSettings, measure: MeasureText): LayoutPlan {
  const width = mmToPixels(profile.lengthMm, printer.dpi);
  // Source bitmap is landscape; the library rotates it for D110's left feed.
  // Byte-align downward so encoder padding never exceeds the printhead.
  const height = Math.floor(Math.min(mmToPixels(profile.widthMm, printer.dpi), printer.headPixels) / 8) * 8;
  const tail = mmToPixels(profile.tailLengthMm ?? 0, printer.dpi);
  const bodyX = profile.tailPosition === "start" ? tail : 0;
  const bodyWidth = width - tail;
  const panelWidth = profile.folded ? Math.floor(bodyWidth / 2) : bodyWidth;
  const test = isPrintTest(ticket.id);
  const customerLabel = !test && isInstallationTicketType(ticket.ticketType);
  const plan: LayoutPlan = { width, height, bodyX, bodyWidth, panelWidth, customerLabel, lines: [] };
  const fail = (error: string) => ({ ...plan, error });
  if (customerLabel && !customerLabelName(ticket.reporterName)) return fail("Nama pelanggan pada tiket pemasangan belum diisi. Lengkapi nama pelanggan sebelum mencetak.");
  if (!validProfile(profile) || ![203].includes(printer.dpi) || printer.headPixels !== 96) return fail("Ukuran/geometri printer tidak valid. Periksa panjang total dan ekor label.");
  const minimumFont = customerLabel ? settings.customerMinFontPx ?? 8 : settings.minFontPx;
  if (!Object.values(settings).every(value => typeof value !== "number" || Number.isFinite(value))
    || settings.marginMm < 0.25 || minimumFont < 8 || minimumFont > 24) return fail("Margin minimum 0,25 mm; font minimum 8–24 piksel.");
  const logicalWidth = settings.orientation === "portrait" ? height : panelWidth;
  const logicalHeight = settings.orientation === "portrait" ? panelWidth : height;
  const margin = Math.ceil(settings.marginMm * printer.dpi / 25.4);
  const ox = mmToPixels(settings.offsetXmm, printer.dpi), oy = mmToPixels(settings.offsetYmm, printer.dpi);
  const padding = test ? 3 : 0;
  const left = margin + Math.abs(ox) + ox + padding, top = margin + Math.abs(oy) + oy + padding;
  let availableWidth = logicalWidth - margin * 2 - Math.abs(ox) * 2 - padding * 2;
  const availableHeight = logicalHeight - margin * 2 - Math.abs(oy) * 2 - padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) return fail("Margin/offset menyisakan area cetak terlalu kecil.");
  if (test) plan.testPattern = { x: left - padding, y: top - padding, width: availableWidth + padding * 2,
    height: availableHeight + padding * 2, rulerStep: mmToPixels(5, printer.dpi) };
  const textHeight = availableHeight - (test ? 16 : 0);
  if (settings.qr && !test && !customerLabel) {
    const qr = QRCode.create(ticket.id, { errorCorrectionLevel: "M" });
    const moduleSize = Math.max(3, Math.ceil(printer.dpi * 0.33 / 25.4));
    const extent = (qr.modules.size + 8) * moduleSize; // Four-module quiet zone each side.
    if (extent > availableHeight || extent + margin + 30 > availableWidth) return fail("QR tidak muat dengan modul minimum dan quiet zone. Gunakan label lebih besar, ubah orientasi, atau nonaktifkan QR.");
    plan.qr = { x: left + availableWidth - extent, y: top, moduleSize, size: qr.modules.size, data: qr.modules.data };
    availableWidth -= extent + margin;
  }
  const variants = test ? [printTestLines(profile, printer), ["UJI CETAK", `${profile.widthMm} x ${profile.lengthMm} mm`], ["UJI"]]
    : [ticketLines(ticket, settings.template === "compact")];
  for (const content of variants) for (let size = customerLabel ? 64 : 24; size >= Math.ceil(minimumFont); size--) {
    const lines: Line[] = [];
    let y = top;
    let fits = true;
    for (const text of content) {
      const wrapped = wrap(text, availableWidth, size, measure);
      if (!wrapped) { fits = false; break; }
      for (const line of wrapped) {
        const metrics = measure(line, size);
        const ascent = Math.ceil(metrics.ascent), descent = Math.ceil(metrics.descent);
        const lineHeight = Math.max(Math.ceil(size * 1.2), ascent + descent + 1);
        if (y + lineHeight > top + textHeight) { fits = false; break; }
        lines.push({ text: line, x: left, baseline: y + ascent, size });
        y += lineHeight;
      }
      if (!fits) break;
    }
    if (fits) {
      if (customerLabel) {
        const inkTop = Math.min(...lines.map(line => line.baseline - measure(line.text, line.size).ascent));
        const inkBottom = Math.max(...lines.map(line => line.baseline + measure(line.text, line.size).descent));
        const shiftY = Math.floor(top + (textHeight - (inkBottom - inkTop)) / 2 - inkTop);
        for (const line of lines) {
          line.x += Math.floor((availableWidth - measure(line.text, line.size).width) / 2);
          line.baseline += shiftY;
        }
      }
      return { ...plan, lines, compact: !test && !customerLabel && settings.template === "compact" };
    }
  }
  if (customerLabel) return fail("Nama pelanggan tidak muat pada ukuran kertas dan batas font minimum. Gunakan area label lebih besar, kurangi margin/offset, atau turunkan font minimum nama. Nama tidak dipotong dan cetak diblokir.");
  if (!test && settings.template === "auto") return planLabel(ticket, profile, printer, { ...settings, template: "compact" }, measure);
  return fail("Isi tiket tidak muat pada batas font minimum. Pilih template ringkas (nomor tiket dan kode transaksi), atau ukuran label lain. Cetak diblokir.");
}
export interface RenderedLabel { canvas: HTMLCanvasElement; previewUrl: string; plan: LayoutPlan; signature: string }
export async function renderLabel(ticket: PrintableTicket, profile: LabelProfile, printer: PrinterIdentity, settings: LayoutSettings): Promise<RenderedLabel> {
  await document.fonts.load('24px Arial');
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak mendukung canvas label.");
  const measure: MeasureText = (text, size) => {
    context.font = `${size}px Arial`;
    const metrics = context.measureText(text);
    return { width: Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft),
      ascent: metrics.actualBoundingBoxAscent || size * 0.8,
      descent: Number.isFinite(metrics.actualBoundingBoxDescent) ? Math.max(0, metrics.actualBoundingBoxDescent) : size * 0.2 };
  };
  const plan = planLabel(ticket, profile, printer, settings, measure);
  if (plan.error) throw new Error(plan.error);
  canvas.width = plan.width; canvas.height = plan.height;
  context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(plan.bodyX, 0);
  if (settings.orientation === "portrait") { context.translate(0, canvas.height); context.rotate(-Math.PI / 2); }
  context.fillStyle = "black"; context.textBaseline = "alphabetic";
  for (const line of plan.lines) {
    context.font = `${line.size}px Arial`;
    const inset = Math.max(0, context.measureText(line.text).actualBoundingBoxLeft);
    context.fillText(line.text, line.x + inset, line.baseline);
  }
  if (plan.qr) {
    const qr = plan.qr;
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.data[y * qr.size + x]) context.fillRect(qr.x + (x + 4) * qr.moduleSize, qr.y + (y + 4) * qr.moduleSize, qr.moduleSize, qr.moduleSize);
    }
  }
  if (plan.testPattern) {
    const frame = plan.testPattern;
    context.strokeStyle = "black"; context.lineWidth = 1;
    context.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.width - 1, frame.height - 1);
    const x = frame.x + 4, y = frame.y + frame.height - 5, length = frame.width - 8;
    context.fillRect(x, y, length, 1);
    context.font = "8px Arial";
    for (let offset = 0; offset <= length - 1; offset += frame.rulerStep) {
      context.fillRect(x + offset, y - 3, 1, 4);
      const label = String(Math.round(offset / frame.rulerStep) * 5);
      if (offset + context.measureText(label).width + 2 < length) context.fillText(label, x + offset + 2, y - 4);
    }
  }
  context.restore();
  if (profile.folded) {
    const panelWidth = plan.panelWidth;
    context.save();
    context.translate(plan.bodyX + plan.bodyWidth, canvas.height);
    context.rotate(Math.PI);
    context.drawImage(canvas, plan.bodyX, 0, panelWidth, canvas.height, 0, 0, panelWidth, canvas.height);
    context.restore();
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const color = pixels.data[index] < 160 ? 0 : 255;
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = color; pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return { canvas, plan, previewUrl: canvas.toDataURL("image/png"), signature: JSON.stringify([ticket, profile, printer, settings]) };
}
