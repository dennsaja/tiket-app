import type { PaperInfo, RfidInfo } from "@mmote/niimbluelib";
import type { PaperReading } from "./types";
import { validSize } from "./profiles";

/** Consume only read responses. No RFID write operations are exposed. */
export function paperReading(rfid: RfidInfo | undefined, paper: PaperInfo | undefined, notes: string[] = []): PaperReading {
  const dimensions = paper?.valid && paper.paperWidth && paper.paperHeight
    ? { widthMm: paper.paperWidth, lengthMm: paper.paperHeight } : undefined;
  if (!dimensions) notes.push("Kode RFID/barcode tidak dianggap sebagai ukuran label.");
  if (dimensions && !validSize(dimensions)) notes.push("Dimensi printer di luar batas profil D110; konfirmasi manual diperlukan.");
  const hasTag = rfid?.tagPresent;
  const reportedType = paper?.valid ? paper.paperType : hasTag ? rfid.consumablesType : undefined;
  return {
    checkedAt: new Date().toISOString(),
    rollId: hasTag ? (rfid.uuid || rfid.serialNumber || undefined) : undefined,
    productCode: hasTag ? rfid.barCode || undefined : undefined,
    // LabelType.Invalid (0) conveys no usable type; it must not defeat an
    // explicit manual selection. Other unsupported positive types stay visible.
    labelType: reportedType === 0 ? undefined : reportedType,
    dimensions, notes, raw: { rfid, paper },
  };
}
