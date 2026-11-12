import { afterEach, describe, expect, it, vi } from "vitest";
import { identifyPrinter, waitForCompletion } from "@/lib/printing/adapter";
import { UsbSerialConnection } from "@/lib/printing/usb-connection";
import { planLabel, mmToPixels, ticketLines } from "@/lib/printing/layout";
import { paperReading } from "@/lib/printing/paper";
import { resolveProfile, ROLL_CATALOG, saveProfile } from "@/lib/printing/profiles";
import { PrintQueue } from "@/lib/printing/queue";
import { PrinterPresence } from "@/lib/printing/presence";
import { DEFAULT_LAYOUT } from "@/lib/printing/types";
import type { LabelProfile, PaperReading, PrinterIdentity, PrintableTicket, StorageLike } from "@/lib/printing/types";

function memory(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
const printer: PrinterIdentity = { model: "D110", modelId: 2304, dpi: 203, headPixels: 96, protocol: 3, task: "D110", geometrySource: "test" };
const profile: LabelProfile = { widthMm: 15, lengthMm: 30, source: "manual", sourceDetail: "test", confirmed: true, labelType: 1 };
const ticket: PrintableTicket = { id: "ticket-id-123", ticketNumber: 123, title: "Pemasangan baru", reporterName: "Ibu Dewi", priority: "medium" };
const measure = (text: string, size: number) => ({ width: Array.from(text).length * size * 0.55, ascent: size * 0.8, descent: size * 0.2 });
const reading = (patch: Partial<PaperReading> = {}): PaperReading => ({ checkedAt: new Date().toISOString(), notes: [], ...patch });
afterEach(() => vi.useRealTimers());

describe("label layout", () => {
  it("fits both folded panels within a single strip and keeps mandatory fields in automatic mode", () => {
    const input = { ...ticket, title: "laporan panjang ".repeat(100), transactionCode: "TRX-10" };
    const plan = planLabel(input, { ...profile, folded: true }, printer, DEFAULT_LAYOUT, measure);
    expect(plan.error).toBeUndefined();
    expect(plan.width).toBe(240);
    expect(plan.compact).toBe(true);
    expect(plan.lines.map(line => line.text).join("")).toContain("TRX-10");
    for (const line of plan.lines) expect(line.x + measure(line.text, line.size).width).toBeLessThan(plan.width / 2);
  });
  it("converts mm at sourced DPI and caps physical 15mm paper to 96 printable dots", () => {
    expect(mmToPixels(25.4, 203)).toBe(203);
    const plan = planLabel(ticket, profile, printer, DEFAULT_LAYOUT, measure);
    expect(plan.width).toBe(240); expect(plan.height).toBe(96);
  });
  it.each([[12, 30], [15, 40], [15, 80]])("fits compact mandatory data at %s × %s mm without truncating", (widthMm, lengthMm) => {
    const plan = planLabel({ ...ticket, transactionCode: "TRX-123456789" }, { ...profile, widthMm, lengthMm }, printer, { ...DEFAULT_LAYOUT, template: "compact" }, measure);
    expect(plan.error).toBeUndefined();
    expect(plan.lines.map(line => line.text).join("")).toContain("TRX-123456789");
    expect(plan.lines.every(line => line.size >= DEFAULT_LAYOUT.minFontPx)).toBe(true);
  });
  it("wraps long text, decreases font, and preserves every character", () => {
    const input = { ...ticket, title: "PelangganDenganNamaSangatPanjangTanpaSpasiBerulang", reporterName: null, priority: undefined };
    const plan = planLabel(input, { ...profile, lengthMm: 80 }, printer, DEFAULT_LAYOUT, measure);
    expect(plan.error).toBeUndefined();
    expect(plan.lines.map(line => line.text).join("").replaceAll(" ", "")).toBe(ticketLines(input, false).join("").replaceAll(" ", ""));
    expect(plan.lines.some(line => line.size < 24)).toBe(true);
  });
  it("blocks overflowing long mandatory transaction data even in compact mode", () => {
    const plan = planLabel({ ...ticket, transactionCode: "X".repeat(2000) }, profile, printer, { ...DEFAULT_LAYOUT, template: "compact" }, measure);
    expect(plan.error).toContain("Cetak diblokir"); expect(plan.lines).toEqual([]);
  });
  it("blocks an overfull full template and allows the user's explicit compact choice", () => {
    const long = { ...ticket, title: "Alamat dan laporan panjang ".repeat(30) };
    expect(planLabel(long, profile, printer, { ...DEFAULT_LAYOUT, template: "full" }, measure).error).toBeTruthy();
    expect(planLabel(long, profile, printer, { ...DEFAULT_LAYOUT, template: "compact" }, measure).error).toBeUndefined();
  });
  it("keeps actual glyph metrics inside area under calibration and portrait rotation", () => {
    const settings = { ...DEFAULT_LAYOUT, orientation: "portrait" as const, offsetXmm: -0.1, offsetYmm: 0.1, template: "compact" as const };
    const plan = planLabel(ticket, { ...profile, lengthMm: 80 }, printer, settings, measure);
    expect(plan.error).toBeUndefined();
    for (const line of plan.lines) {
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.x + measure(line.text, line.size).width).toBeLessThanOrEqual(plan.height);
      expect(line.baseline + measure(line.text, line.size).descent).toBeLessThanOrEqual(plan.width);
    }
  });
  it("keeps integer QR modules with 4-module quiet zones, or refuses to print", () => {
    const settings = { ...DEFAULT_LAYOUT, qr: true, marginMm: 0.25, template: "compact" as const };
    const plan = planLabel({ ...ticket, id: "A" }, { ...profile, lengthMm: 80 }, printer, settings, measure);
    expect(plan.error).toBeUndefined(); expect(plan.qr?.moduleSize).toBe(3);
    expect((plan.qr!.size + 8) * plan.qr!.moduleSize).toBeLessThanOrEqual(plan.height - 4);
    expect(planLabel({ ...ticket, id: "x".repeat(150) }, profile, printer, settings, measure).error).toContain("QR tidak muat");
  });
  it("rejects invalid dimensions, minimum font, or offsets that erase print area", () => {
    expect(planLabel(ticket, { ...profile, widthMm: NaN }, printer, DEFAULT_LAYOUT, measure).error).toBeTruthy();
    expect(planLabel(ticket, profile, printer, { ...DEFAULT_LAYOUT, minFontPx: 3 }, measure).error).toBeTruthy();
    expect(planLabel(ticket, profile, printer, { ...DEFAULT_LAYOUT, offsetYmm: 10 }, measure).error).toBeTruthy();
  });
});

describe("paper read responses and manual fallback", () => {
  it("converts missing millimetre fields from printer dots, normalizes feed direction and falls back to the RFID type", () => {
    const tag = { tagPresent: true, uuid: "r", barCode: "sku", serialNumber: "", allPaper: 10, usedPaper: 0, consumablesType: 1 };
    const reading = paperReading(tag, { valid: true, paperWidthPixel: 320, paperHeightPixel: 96, paperType: 0 });
    expect(reading).toMatchObject({ inserted: true, dimensions: { widthMm: 12, lengthMm: 40 }, labelType: 1 });
    expect(resolveProfile(paperReading(tag, undefined, [], { paperInserted: false }), memory())).toBeUndefined();
    expect(paperReading(undefined, undefined, [], { paperInserted: true }).inserted).toBe(true);
  });
  it("recalls folded calibration on another roll of the same product and accepts new measured dimensions", () => {
    const storage = memory();
    saveProfile({ ...profile, rollId: "old", productCode: "sku", folded: true }, storage);
    expect(resolveProfile(reading({ rollId: "new", productCode: "sku" }), storage)).toMatchObject({ confirmed: true, folded: true });
    expect(resolveProfile(reading({ productCode: "sku", dimensions: { widthMm: 12, lengthMm: 65 } }), storage))
      .toMatchObject({ confirmed: true, folded: true, widthMm: 12, lengthMm: 65, labelType: 1 });
  });
  it("retains a measured correction until the device reports a different size", () => {
    const storage = memory(), dimensions = { widthMm: 12, lengthMm: 30 };
    saveProfile({ ...profile, rollId: "same", measuredAtConfirmation: dimensions }, storage);
    expect(resolveProfile(reading({ rollId: "same", dimensions }), storage))
      .toMatchObject({ widthMm: 15, source: "manual", confirmed: true });
    expect(resolveProfile(reading({ rollId: "same", dimensions: { widthMm: 12, lengthMm: 60 } }), storage))
      .toMatchObject({ widthMm: 12, lengthMm: 60, source: "printer" });
  });
  it("does not infer dimensions from RFID identity or a size-looking barcode", () => {
    const paper = paperReading({ tagPresent: true, uuid: "roll-1", barCode: "15x30", serialNumber: "serial", allPaper: 100, usedPaper: 1, consumablesType: 1 }, { valid: false });
    expect(paper.rollId).toBe("roll-1"); expect(paper.dimensions).toBeUndefined();
    expect(resolveProfile(paper, memory())).toBeUndefined();
  });
  it("distinguishes explicit printer dimensions from catalog mappings", () => {
    const detected = paperReading(undefined, { valid: true, paperWidth: 15, paperHeight: 40, paperType: 1 });
    expect(resolveProfile(detected, memory())?.source).toBe("printer");
    ROLL_CATALOG["test-code"] = { widthMm: 12, lengthMm: 30, labelType: 1, source: "https://manufacturer.example/spec" };
    const mapped = resolveProfile(reading({ productCode: "test-code" }), memory());
    expect(mapped?.source).toBe("mapping"); expect(mapped?.sourceDetail).toContain("manufacturer");
    delete ROLL_CATALOG["test-code"];
  });
  it("requires manual confirmation if identity is unavailable, including after reload", () => {
    const storage = memory(); saveProfile(profile, storage);
    expect(resolveProfile(reading(), storage)).toMatchObject({ source: "manual", confirmed: false });
    expect(resolveProfile(reading({ rollId: "different-roll" }), storage)?.confirmed).toBe(false);
  });
  it("remembers a manual size only for the same roll", () => {
    const storage = memory(); saveProfile({ ...profile, rollId: "roll-1" }, storage);
    expect(resolveProfile(reading({ rollId: "roll-1" }), storage)?.confirmed).toBe(true);
    expect(resolveProfile(reading({ rollId: "roll-2" }), storage)?.confirmed).toBe(false);
  });
  it("does not claim stale detected sizes are still printer-detected", () => {
    const storage = memory(); saveProfile({ ...profile, rollId: "roll-1", source: "printer" }, storage);
    expect(resolveProfile(reading({ rollId: "roll-1" }), storage)).toMatchObject({ source: "manual", confirmed: false });
  });
  it("allows manual paper type selection when the printer returns Invalid/unknown", () => {
    const unknown = paperReading({ tagPresent: true, uuid: "roll", barCode: "unknown", serialNumber: "", allPaper: 100, usedPaper: 0, consumablesType: 0 }, undefined);
    expect(unknown.labelType).toBeUndefined();
    const storage = memory(); saveProfile({ ...profile, rollId: "roll" }, storage);
    expect(resolveProfile(unknown, storage)).toMatchObject({ confirmed: true, labelType: 1 });
    const dimensionsOnly = paperReading(undefined, { valid: true, paperWidth: 15, paperHeight: 30, paperType: 0 });
    expect(resolveProfile(dimensionsOnly, memory())).toMatchObject({ source: "printer", confirmed: false });
  });
});

describe("model safety and bounded completion", () => {
  it("distinguishes D110 from D110_M and selects version-specific tasks", () => {
    expect(identifyPrinter({ settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 }, modelId: 2304, protocolVersion: 3 }).task).toBe("D110");
    expect(identifyPrinter({ settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 }, modelId: 2320, protocolVersion: 3 }).task).toBe("B1");
    expect(identifyPrinter({ settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 }, modelId: 2320, protocolVersion: 4 }).task).toBe("D110M_V4");
  });
  it.each([{ modelId: 2305, protocolVersion: 3 }, { modelId: 4096, protocolVersion: 3 }, { modelId: 2320, protocolVersion: 5 }, { modelId: 2304, protocolVersion: 3, printheadWidth: 120 }])("blocks unsupported or ambiguous variants: %j", info => {
    expect(() => identifyPrinter({ settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 }, ...info })).toThrow();
  });
  it("does not treat 0 of 1 plus print-end ACK as completed", async () => {
    vi.useFakeTimers();
    const result = waitForCompletion(async () => ({ page: 0, pagePrintProgress: 100, pageFeedProgress: 100, error: 0 }), () => true, 900);
    const assertion = expect(result).rejects.toThrow("0 dari 1");
    await vi.advanceTimersByTimeAsync(1200); await assertion;
  });
  it("requires page count, printing and feed completion", async () => {
    const status = vi.fn().mockResolvedValueOnce({ page: 1, pagePrintProgress: 50, pageFeedProgress: 0, error: 0 })
      .mockResolvedValue({ page: 1, pagePrintProgress: 100, pageFeedProgress: 100, error: 0 });
    await waitForCompletion(status, () => true, 1000, async () => undefined);
    expect(status).toHaveBeenCalledTimes(2);
  });
  it("handles unplugging and printer error responses", async () => {
    await expect(waitForCompletion(vi.fn(), () => false)).rejects.toThrow("USB terputus");
    await expect(waitForCompletion(async () => ({ page: 0, pagePrintProgress: 0, pageFeedProgress: 0, error: 2 }), () => true)).rejects.toThrow("kesalahan 2");
  });
  it("rejects a serial port without USB VID/PID before opening it", async () => {
    const open = vi.fn();
    const client = new UsbSerialConnection({ getInfo: () => ({}), open } as unknown as SerialPort);
    await expect(client.connect()).rejects.toThrow("identitas USB"); expect(open).not.toHaveBeenCalled();
  });
  it("cancels an outstanding read and releases the port on cable removal", async () => {
    const cancel = vi.fn(), close = vi.fn().mockResolvedValue(undefined);
    const port = Object.assign(new EventTarget(), {
      getInfo: () => ({ usbVendorId: 0x1234, usbProductId: 0x5678 }), open: vi.fn().mockResolvedValue(undefined), close,
      readable: new ReadableStream<Uint8Array>({ cancel }), writable: new WritableStream<Uint8Array>(),
    });
    const client = new UsbSerialConnection(port as unknown as SerialPort);
    vi.spyOn(client.protocol, "connectNegotiate").mockResolvedValue({ connectResult: 1, protocolVersion: 3, supportColor: false });
    vi.spyOn(client, "fetchPrinterInfo").mockResolvedValue({ settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 }, modelId: 2304, protocolVersion: 3 });
    await client.connect(); expect(client.isConnected()).toBe(true);
    const disconnected = vi.fn(); client.on("disconnect", disconnected);
    port.dispatchEvent(new Event("disconnect"));
    await vi.waitFor(() => expect(disconnected).toHaveBeenCalled());
    expect(cancel).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1); expect(client.isConnected()).toBe(false);
  });
});

describe("shared USB presence", () => {
  it("keeps independent hosts visible, protects ownership, and expires a silent host", () => {
    const registry = new PrinterPresence();
    registry.update("a", "admin-1", "admin", true, 1000);
    registry.update("b", "noc-1", "noc", true, 2000);
    expect(registry.roles(3000)).toEqual(["admin", "noc"]);
    expect(registry.update("a", "noc-1", "noc", false, 4000)).toBe(false);
    registry.update("b", "noc-1", "noc", false, 5000);
    expect(registry.roles(5000)).toEqual(["admin"]);
    registry.update("a", "admin-1", "admin", true, 60000);
    expect(registry.roles(91000)).toEqual(["admin"]);
    expect(registry.roles(150000)).toEqual([]);
  });
});

describe("durable single-printer queue", () => {
  it("deduplicates repeated clicks and replayed save events, including after reload", async () => {
    const storage = memory(), print = vi.fn().mockResolvedValue(undefined);
    const queue = new PrintQueue(storage, vi.fn());
    const first = queue.enqueue(ticket, { prepare: async () => undefined, print });
    expect(queue.enqueue(ticket, { prepare: async () => undefined, print }).id).toBe(first.id);
    await vi.waitFor(() => expect(first.state).toBe("confirmed"));
    const restored = new PrintQueue(storage, vi.fn());
    expect(restored.enqueue(ticket, { prepare: async () => undefined, print }).id).toBe(first.id);
    expect(print).toHaveBeenCalledTimes(1);
  });
  it("serializes different tickets with at most one printer job active", async () => {
    let active = 0, maximum = 0;
    const print = async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; };
    const queue = new PrintQueue(memory(), vi.fn());
    queue.enqueue(ticket, { prepare: async () => undefined, print });
    queue.enqueue({ ...ticket, id: "second" }, { prepare: async () => undefined, print });
    await vi.waitFor(() => expect(queue.jobs.every(job => job.state === "confirmed")).toBe(true));
    expect(maximum).toBe(1);
  });
  it("marks a preflight failure as failed without sending", async () => {
    const queue = new PrintQueue(memory(), vi.fn()), print = vi.fn();
    const job = queue.enqueue(ticket, { prepare: async () => { throw new Error("Ukuran belum diketahui"); }, print });
    await vi.waitFor(() => expect(job.state).toBe("failed")); expect(print).not.toHaveBeenCalled();
  });
  it.each(["USB terputus", "Timeout setelah data dikirim"])("preserves uncertainty and blocks following jobs after %s", async reason => {
    const queue = new PrintQueue(memory(), vi.fn()), print = vi.fn(async (waiting: () => void) => { waiting(); throw new Error(reason); });
    const job = queue.enqueue(ticket, { prepare: async () => undefined, print });
    const nextPrint = vi.fn();
    queue.enqueue({ ...ticket, id: "second" }, { prepare: async () => undefined, print: nextPrint });
    await vi.waitFor(() => expect(job.state).toBe("unknown"));
    expect(print).toHaveBeenCalledTimes(1); expect(nextPrint).not.toHaveBeenCalled();
    expect(() => queue.enqueue({ ...ticket, id: "third" }, { prepare: async () => undefined, print: nextPrint })).toThrow("belum terkonfirmasi");
    expect(queue.enqueue(ticket, { prepare: async () => undefined, print }).id).toBe(job.id);
  });
  it("recovers an interrupted dispatch as unknown and never resumes it", async () => {
    const storage = memory(), queue = new PrintQueue(storage, vi.fn());
    queue.enqueue(ticket, { prepare: async () => undefined, print: async () => new Promise(() => undefined) });
    await vi.waitFor(() => expect(queue.jobs[0].state).toBe("sending"));
    const restored = new PrintQueue(storage, vi.fn());
    expect(restored.jobs[0].state).toBe("unknown");
    restored.acknowledge(restored.jobs[0].id);
    expect(restored.jobs[0]).toMatchObject({ state: "confirmed", confirmation: "user" });
  });
  it("gives explicitly authorized reprints a new job ID while retaining the original", async () => {
    const queue = new PrintQueue(memory(), vi.fn());
    const original = queue.enqueue(ticket, { prepare: async () => undefined, print: async () => undefined });
    await vi.waitFor(() => expect(original.state).toBe("confirmed"));
    queue.allowReprint(original.id);
    const reprint = queue.enqueue(ticket, { prepare: async () => undefined, print: async () => undefined }, original.id);
    expect(reprint.id).not.toBe(original.id); expect(reprint.reprintOf).toBe(original.id);
  });
  it("never sends if durable storage fails before dispatch", async () => {
    const storage = memory(), print = vi.fn();
    const queue = new PrintQueue(storage, vi.fn());
    storage.setItem = () => { throw new Error("Quota exceeded"); };
    expect(() => queue.enqueue(ticket, { prepare: async () => undefined, print })).toThrow("Quota exceeded");
    await Promise.resolve(); expect(print).not.toHaveBeenCalled();
  });
  it("fails closed if the sending state cannot be persisted", async () => {
    const storage = memory(), queue = new PrintQueue(storage, vi.fn()), print = vi.fn();
    const job = queue.enqueue(ticket, { prepare: async () => { storage.setItem = () => { throw new Error("Disk full"); }; }, print });
    await vi.waitFor(() => expect(queue.storageError).toContain("Disk full"));
    expect(job.state).toBe("failed"); expect(print).not.toHaveBeenCalled();
  });
  it("retains an unknown result when the user explicitly authorizes a reprint", async () => {
    const queue = new PrintQueue(memory(), vi.fn());
    const original = queue.enqueue(ticket, { prepare: async () => undefined, print: async () => { throw new Error("timeout"); } });
    await vi.waitFor(() => expect(original.state).toBe("unknown"));
    queue.allowReprint(original.id);
    const reprint = queue.enqueue(ticket, { prepare: async () => undefined, print: async () => undefined }, original.id);
    await vi.waitFor(() => expect(reprint.state).toBe("confirmed"));
    expect(original.state).toBe("unknown"); expect(original.resolution).toBe("reprint_authorized");
  });
  it("deduplicates repeated clicks for the same reprint confirmation", async () => {
    const queue = new PrintQueue(memory(), vi.fn()), print = vi.fn().mockResolvedValue(undefined);
    const execution = { prepare: async () => undefined, print };
    const first = queue.enqueue(ticket, execution, "original-job", "one-confirmation");
    expect(queue.enqueue(ticket, execution, "original-job", "one-confirmation").id).toBe(first.id);
    await vi.waitFor(() => expect(first.state).toBe("confirmed"));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
