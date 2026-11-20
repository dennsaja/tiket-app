import { describe, expect, it } from "vitest";
import { createTicketSchema } from "@/lib/validations";
import { planLabel, ticketLines } from "@/lib/printing/layout";
import { DEFAULT_LAYOUT, type LabelProfile, type PrinterIdentity, type PrintableTicket } from "@/lib/printing/types";

const input = { title: "Pemasangan layanan", description: "Pemasangan baru untuk pelanggan." };
const printer: PrinterIdentity = { model: "D110", modelId: 2304, protocol: 1, dpi: 203, headPixels: 96, task: "D110", geometrySource: "fixture" };
const paper: LabelProfile = { widthMm: 12.5, lengthMm: 109, folded: true, tailLengthMm: 35, tailPosition: "end", labelType: 1, source: "manual", sourceDetail: "fixture", confirmed: true };
const ticket: PrintableTicket = { id: "installation-ticket", ticketNumber: 123, ticketType: "psb", title: "This title must not be printed", reporterName: "Budi Santoso", reporterPhone: "081234567890", transactionCode: "PRIVATE-TRANSACTION", priority: "high" };
const measure = (text: string, size: number) => ({ width: [...text].reduce((sum, char) => sum + (char === "W" ? 0.95 : 0.55) * size, 0), ascent: size * 0.8, descent: size * 0.2 });

describe("required customer on new installation tickets", () => {
  for (const ticketType of ["psb", "pemasangan_cctv"] as const) {
    it.each([undefined, null, "", "   ", "\t\n"])(`${ticketType} rejects missing or blank customer %j`, reporterName => {
      const parsed = createTicketSchema.safeParse({ ...input, ticketType, reporterName });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues).toContainEqual(expect.objectContaining({ path: ["reporterName"], message: expect.stringContaining("Nama pelanggan wajib") }));
    });
  }
  it("normalizes the stored customer name and enforces its database limit", () => {
    const parsed = createTicketSchema.parse({ ...input, ticketType: "psb", reporterName: "  Bapak Hendra  " });
    expect(parsed.reporterName).toBe("Bapak Hendra");
    expect(createTicketSchema.safeParse({ ...input, reporterName: "W".repeat(256) }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...input, reporterName: "W".repeat(255) }).success).toBe(true);
  });
  it.each(["maintenance", "perbaikan_infrastruktur", "perbaikan_cctv"])("keeps customer optional for %s", ticketType => {
    expect(createTicketSchema.safeParse({ ...input, ticketType, reporterName: null }).success).toBe(true);
  });
});

describe("customer-only label fitting", () => {
  it.each(["auto", "full", "compact"] as const)("prints only the customer in %s mode, with no QR or ticket fields", template => {
    const plan = planLabel(ticket, paper, printer, { ...DEFAULT_LAYOUT, template, qr: true }, measure);
    expect(plan.error).toBeUndefined(); expect(plan.customerLabel).toBe(true); expect(plan.qr).toBeUndefined();
    expect(plan.lines.map(line => line.text).join(" ")).toBe(ticket.reporterName);
    expect(ticketLines(ticket, true)).toEqual(["Budi Santoso"]);
    expect(ticketLines(ticket, false)).toEqual(["Budi Santoso"]);
  });
  it("reduces type for long names and preserves all 255 characters across line wrapping", () => {
    const short = planLabel(ticket, paper, printer, DEFAULT_LAYOUT, measure);
    const name = "W".repeat(255);
    const long = planLabel({ ...ticket, reporterName: name }, paper, printer, DEFAULT_LAYOUT, measure);
    expect(long.error).toBeUndefined();
    expect(long.lines[0].size).toBeLessThan(short.lines[0].size);
    expect(long.lines[0].size).toBeGreaterThanOrEqual(8);
    expect(long.lines.map(line => line.text).join("")).toBe(name);
    expect(long.bodyWidth).toBe(591); expect(long.panelWidth).toBe(295);
    for (const line of long.lines) {
      expect(line.x).toBeGreaterThanOrEqual(6);
      expect(line.x + measure(line.text, line.size).width).toBeLessThan(long.panelWidth);
      expect(line.baseline + measure(line.text, line.size).descent).toBeLessThan(long.height);
    }
  });
  it.each(["psb", "pemasangan_cctv"])("blocks an old %s ticket without a customer instead of printing a number", ticketType => {
    const plan = planLabel({ ...ticket, ticketType, reporterName: "   " }, paper, printer, DEFAULT_LAYOUT, measure);
    expect(plan.error).toContain("Nama pelanggan"); expect(plan.lines).toEqual([]);
  });
  it("honors a chosen readable minimum and refuses to truncate when paper is too small", () => {
    const plan = planLabel({ ...ticket, reporterName: "W".repeat(255) }, { ...paper, widthMm: 5, lengthMm: 10, folded: false, tailLengthMm: 0 }, printer, { ...DEFAULT_LAYOUT, customerMinFontPx: 12 }, measure);
    expect(plan.error).toContain("Nama tidak dipotong");
    expect(plan.lines).toEqual([]);
  });
  it.each(["landscape", "portrait"] as const)("centers complete names inside the printable %s body", orientation => {
    const name = "PelangganDenganNamaPanjangTanpaSpasiUntukLabelKabel";
    const plan = planLabel({ ...ticket, reporterName: name }, paper, printer, { ...DEFAULT_LAYOUT, orientation }, measure);
    expect(plan.error).toBeUndefined(); expect(plan.lines.map(line => line.text).join("")).toBe(name);
    const logicalWidth = orientation === "portrait" ? plan.height : plan.panelWidth;
    for (const line of plan.lines) expect(line.x + measure(line.text, line.size).width).toBeLessThan(logicalWidth);
    const inkTop = Math.min(...plan.lines.map(line => line.baseline - measure(line.text, line.size).ascent));
    const inkBottom = Math.max(...plan.lines.map(line => line.baseline + measure(line.text, line.size).descent));
    expect(Math.abs((inkTop + inkBottom) / 2 - (orientation === "portrait" ? plan.panelWidth : plan.height) / 2)).toBeLessThanOrEqual(1);
  });
  it("retains the regular ticket template for other work categories", () => {
    const lines = ticketLines({ ...ticket, ticketType: "maintenance" }, false);
    expect(lines[0]).toBe("TIKET #123"); expect(lines).toContain("PIC: Budi Santoso");
  });
});
