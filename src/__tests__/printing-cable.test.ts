import { describe, expect, it } from "vitest";
import { paperReading } from "@/lib/printing/paper";
import { paperFingerprint, resolveProfile, saveProfile } from "@/lib/printing/profiles";
import { mmToPixels, planLabel } from "@/lib/printing/layout";
import { createPrintTest, isPrintTest } from "@/lib/printing/test-label";
import { identifyPrinter } from "@/lib/printing/adapter";
import { DEFAULT_LAYOUT, type LabelProfile, type StorageLike } from "@/lib/printing/types";

// User's diagnostic structure, with device-specific identifiers anonymized.
const rfid = { tagPresent: true, uuid: "fixture-cable-roll", barCode: "6972842743817", serialNumber: "fixture-roll-serial", allPaper: 78, usedPaper: 35, consumablesType: 1 };
const printer = identifyPrinter({ modelId: 2304, protocolVersion: 1, softwareVersion: "5.35/13.15", serial: "fixture-printer",
  settings: { powerSound: false, connectionSound: false, autoShutdownTime: 1 } });
const cable: LabelProfile = { widthMm: 12.5, lengthMm: 109, tailLengthMm: 35, tailPosition: "end", folded: true,
  labelType: 1, source: "manual", sourceDetail: "measured", confirmed: true, productCode: rfid.barCode, rollId: rfid.uuid };
const measure = (text: string, size: number) => ({ width: text.length * size * 0.55, ascent: size * 0.8, descent: size * 0.2 });
function memory(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe("D110 cable-label diagnostics", () => {
  it("reads 43 remaining labels without turning RFID counters into dimensions", () => {
    const notes: string[] = [];
    const reading = paperReading(rfid, undefined, notes);
    expect(reading).toMatchObject({ totalLabels: 78, usedLabels: 35, remainingLabels: 43, productCode: rfid.barCode, rollId: rfid.uuid });
    expect(reading.dimensions).toBeUndefined();
    expect(notes).toEqual([]);
    expect(resolveProfile(reading, memory())).toMatchObject({ source: "mapping", confirmed: false, widthMm: 12.5, lengthMm: 109, tailLengthMm: 35, folded: true });
  });
  it("does not report a remaining count when the tag counters are inconsistent", () => {
    const reading = paperReading({ ...rfid, usedPaper: 79 }, undefined);
    expect(reading.remainingLabels).toBeUndefined();
    expect(reading.notes.join(" ")).toContain("tidak konsisten");
    expect(paperReading({ ...rfid, tagPresent: false }, undefined).totalLabels).toBeUndefined();
    expect(paperReading({ ...rfid, usedPaper: -1 }, undefined).remainingLabels).toBeUndefined();
  });
  it("keeps an actual measured correction instead of replacing it with the barcode candidate", () => {
    const storage = memory();
    saveProfile({ ...cable, lengthMm: 107, tailLengthMm: 33, tailPosition: "start" }, storage);
    const reading = paperReading(rfid, undefined);
    expect(resolveProfile(reading, storage)).toMatchObject({ source: "manual", confirmed: true, lengthMm: 107, tailLengthMm: 33, tailPosition: "start" });
    expect(resolveProfile({ ...reading, rollId: "new-roll-same-product" }, storage)?.tailLengthMm).toBe(33);
    expect(resolveProfile({ ...reading, inserted: false }, storage)).toBeUndefined();
  });
  it("requests cable-tail confirmation for old saved profiles and preserves explicit tail corrections", () => {
    const legacy = memory();
    saveProfile({ ...cable, tailLengthMm: undefined }, legacy);
    expect(resolveProfile(paperReading(rfid, undefined), legacy)).toMatchObject({ confirmed: false, tailLengthMm: 35 });
    const corrected = memory(), dimensions = { widthMm: 12.5, lengthMm: 109 };
    saveProfile({ ...cable, measuredAtConfirmation: dimensions, measuredTailAtConfirmation: 0 }, corrected);
    const reading = { ...paperReading(rfid, undefined), dimensions, tailLengthMm: 0 };
    expect(resolveProfile(reading, corrected)).toMatchObject({ source: "manual", confirmed: true, tailLengthMm: 35 });
    expect(resolveProfile({ ...reading, tailLengthMm: 30 }, corrected)?.confirmed).toBe(false);
  });
  it("retains a tail supplied by PaperInfo and requires its position to be confirmed", () => {
    const reading = paperReading(rfid, { valid: true, paperWidth: 12.5, paperHeight: 109, tailLength: 35, paperType: 1 });
    expect(reading.tailLengthMm).toBe(35);
    expect(resolveProfile(reading, memory())).toMatchObject({ source: "printer", confirmed: false, tailLengthMm: 35 });
    expect(paperReading(rfid, { valid: true, tailLengthPixel: 280 }).tailLengthMm).toBe(35);
    expect(paperReading(rfid, { valid: false, tailLength: 35 }).tailLengthMm).toBeUndefined();
  });
  it("rejects impossible tail geometry and detects a changed reported tail before dispatch", () => {
    expect(() => saveProfile({ ...cable, tailLengthMm: 109 }, memory())).toThrow();
    expect(() => saveProfile({ ...cable, tailLengthMm: -1 }, memory())).toThrow();
    expect(() => saveProfile({ ...cable, tailLengthMm: NaN }, memory())).toThrow();
    const reading = paperReading(rfid, undefined);
    expect(paperFingerprint(reading, cable)).not.toBe(paperFingerprint({ ...reading, tailLengthMm: 33 }, cable));
  });
});

describe("cable print area and independent calibration labels", () => {
  it.each(["start", "end"] as const)("uses two 37 mm panels and leaves a 35 mm %s tail blank", tailPosition => {
    const profile = { ...cable, tailPosition };
    const plan = planLabel({ id: "real-ticket", ticketNumber: 101, title: "Perbaikan jaringan" }, profile, printer, DEFAULT_LAYOUT, measure);
    expect(plan.error).toBeUndefined();
    expect(plan.width).toBe(mmToPixels(109, 203)); expect(plan.height).toBe(96);
    expect(plan.bodyX).toBe(tailPosition === "start" ? mmToPixels(35, 203) : 0);
    expect(plan.bodyWidth).toBe(plan.width - mmToPixels(35, 203));
    expect(plan.panelWidth).toBe(Math.floor(plan.bodyWidth / 2));
    for (const line of plan.lines) expect(line.x + measure(line.text, line.size).width).toBeLessThan(plan.panelWidth);
  });
  it.each(["landscape", "portrait"] as const)("prints a framed %s test with a 5 mm ruler even when ticket QR is enabled", orientation => {
    const sample = createPrintTest();
    const plan = planLabel(sample, cable, printer, { ...DEFAULT_LAYOUT, orientation, qr: true, template: "compact" }, measure);
    expect(plan.error).toBeUndefined(); expect(plan.qr).toBeUndefined();
    expect(plan.testPattern?.rulerStep).toBe(40);
    expect(plan.lines.map(line => line.text).join(" ")).toContain("UJI CETAK");
    const frame = plan.testPattern!;
    expect(frame.x + frame.width).toBeLessThan(orientation === "portrait" ? plan.height : plan.panelWidth);
    expect(frame.y + frame.height).toBeLessThan(orientation === "portrait" ? plan.panelWidth : plan.height);
  });
  it("gives each test a separate identity and still recognizes old test history", () => {
    const first = createPrintTest(), second = createPrintTest();
    expect(first.id).not.toBe(second.id);
    expect(isPrintTest(first.id)).toBe(true); expect(isPrintTest("USB-TEST-old-job")).toBe(true);
    expect(isPrintTest("real-ticket")).toBe(false);
  });
});
