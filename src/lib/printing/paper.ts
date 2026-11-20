import type { HeartbeatData, PaperInfo, RfidInfo } from "@mmote/niimbluelib";
import type { PaperReading } from "./types";
import { validSize } from "./profiles";

/** Consume only read responses. No RFID write operations are exposed. */
export function paperReading(rfid: RfidInfo | undefined, paper: PaperInfo | undefined, notes: string[] = [], sensor?: HeartbeatData, deviceType?: number): PaperReading {
  notes = [...notes];
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
  const totalLabels = hasTag && Number.isInteger(rfid.allPaper) && rfid.allPaper > 0 ? rfid.allPaper : undefined;
  const usedLabels = hasTag && Number.isInteger(rfid.usedPaper) && rfid.usedPaper >= 0 ? rfid.usedPaper : undefined;
  const remainingLabels = totalLabels !== undefined && usedLabels !== undefined && usedLabels <= totalLabels ? totalLabels - usedLabels : undefined;
  if (totalLabels !== undefined && usedLabels !== undefined && usedLabels > totalLabels) notes.push("Penghitung RFID tidak konsisten; sisa label tidak dapat dihitung.");
  const tailLengthMm = paper?.valid ? paper.tailLength ?? (paper.tailLengthPixel ? mm(paper.tailLengthPixel) : undefined) : undefined;
  if (hasTag && !dimensions) notes.push("Angka total dan terpakai pada RFID adalah jumlah label, bukan ukuran dalam mm.");
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
    dimensions, tailLengthMm: Number.isFinite(tailLengthMm) && tailLengthMm! >= 0 ? tailLengthMm : undefined,
    totalLabels, usedLabels, remainingLabels, notes, raw: { rfid, paper },
  };
}
