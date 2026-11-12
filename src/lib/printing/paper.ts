import type { HeartbeatData, PaperInfo, RfidInfo } from "@mmote/niimbluelib";
import type { PaperReading } from "./types";
import { validSize } from "./profiles";

/** Consume only read responses. No RFID write operations are exposed. */
export function paperReading(rfid: RfidInfo | undefined, paper: PaperInfo | undefined, notes: string[] = [], sensor?: HeartbeatData, deviceType?: number): PaperReading {
  const mm = (pixels?: number) => pixels ? Math.round(pixels * 25.4 / 203 * 10) / 10 : 0;
  let dimensions;
  if (paper?.valid) {
    const widths = [paper.paperWidth, mm(paper.paperWidthPixel)];
    const lengths = [paper.paperHeight, mm(paper.paperHeightPixel)];
    const pairs = widths.flatMap(widthMm => lengths.map(lengthMm => ({ widthMm: widthMm || 0, lengthMm: lengthMm || 0 })));
    dimensions = pairs.find(validSize) ?? pairs.map(({ widthMm, lengthMm }) => ({ widthMm: lengthMm, lengthMm: widthMm })).find(validSize);
  }
  if (!dimensions) notes.push("Ukuran tidak tersedia dari printer. Profil roll yang sudah dikonfirmasi akan digunakan jika ada.");
  const hasTag = rfid?.tagPresent;
  const reportedType = (paper?.valid && paper.paperType) || (hasTag && rfid.consumablesType) || deviceType || undefined;
  return {
    checkedAt: new Date().toISOString(),
    inserted: sensor?.paperInserted ?? (hasTag || dimensions ? true : undefined),
    lidClosed: sensor?.lidClosed,
    rollId: hasTag ? (rfid.uuid || rfid.serialNumber || undefined) : undefined,
    productCode: hasTag ? rfid.barCode || undefined : undefined,
    // LabelType.Invalid (0) conveys no usable type; it must not defeat an
    // explicit manual selection. Other unsupported positive types stay visible.
    labelType: reportedType === 0 ? undefined : reportedType,
    dimensions, notes, raw: { rfid, paper },
  };
}
