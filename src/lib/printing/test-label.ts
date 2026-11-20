import type { LabelProfile, PrintableTicket, PrinterIdentity } from "./types";

export function isPrintTest(id: string): boolean {
  return id.startsWith("NIIMBOT-TEST-") || id.startsWith("USB-TEST");
}
export function createPrintTest(): PrintableTicket {
  return { id: `NIIMBOT-TEST-${crypto.randomUUID()}`, ticketNumber: "UJI", title: "UJI CETAK" };
}
export function printTestLines(profile: LabelProfile, printer: PrinterIdentity): string[] {
  return ["UJI CETAK", `${printer.model} ${printer.dpi} DPI`, `${profile.widthMm} x ${profile.lengthMm} mm`];
}
