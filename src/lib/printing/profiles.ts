import type { LabelProfile, LabelSize, PaperReading, StorageLike } from "./types";

// Match exact product identifiers only. RFID barcodes can differ from retail SKUs.
const source = "Katalog D110_M NIIMBOT USA · https://niimbotusa.com/printers/d110-m";
export const ROLL_CATALOG: Record<string, LabelSize & { labelType: number; source: string; folded?: boolean; tailLengthMm?: number; tailPosition?: "start" | "end"; requiresConfirmation?: boolean }> = {
  A2A68601301: { widthMm: 15, lengthMm: 30, labelType: 1, source },
  A2A68601601: { widthMm: 12, lengthMm: 40, labelType: 1, source },
  A2A68601001: { widthMm: 15, lengthMm: 50, labelType: 1, source },
  A2G88588201: { widthMm: 14, lengthMm: 30, labelType: 5, source },
  A2G88588302: { widthMm: 14, lengthMm: 40, labelType: 5, source },
  // Catalogs disagree (72 mm vs 74+35 mm), and this tag reports 78 labels
  // instead of the advertised 60/65. This is a starting point, never a measurement.
  "6972842743817": {
    widthMm: 12.5, lengthMm: 109, labelType: 1, folded: true, tailLengthMm: 35, tailPosition: "end", requiresConfirmation: true,
    source: "Kandidat label kabel NIIMBOT 12,5 × (74+35) mm: badan 74 mm, dua panel 37 mm, ekor 35 mm. Cocokkan ukuran dan posisi ekor dengan kemasan/hasil ukur; katalog barcode ini berbeda-beda. https://niimbot.com.au/products/niimbot-d11-d101-d110-h1s-12-5-37mm-65pcs-thermal-cable-labels-red",
  },
};
const KEY = "tiket.usb-label-profiles.v1";
interface SavedProfiles { rolls: Record<string, LabelProfile>; products: Record<string, LabelProfile>; last?: LabelProfile }

export function validSize(size: LabelSize): boolean {
  return Number.isFinite(size.widthMm) && Number.isFinite(size.lengthMm)
    && size.widthMm >= 5 && size.widthMm <= 15 && size.lengthMm >= 10 && size.lengthMm <= 200;
}
export function validProfile(profile: LabelProfile): boolean {
  const tail = profile.tailLengthMm ?? 0;
  return validSize(profile) && Number.isFinite(tail) && tail >= 0 && profile.lengthMm - tail >= 10
    && (profile.tailPosition === undefined || ["start", "end"].includes(profile.tailPosition));
}
function saved(storage: StorageLike): SavedProfiles {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "{}");
    return { rolls: value.rolls || {}, products: value.products || {}, last: value.last };
  } catch { return { rolls: {}, products: {} }; }
}
export function resolveProfile(reading: PaperReading, storage: StorageLike): LabelProfile | undefined {
  if (reading.inserted === false) return;
  const values = saved(storage);
  const sameRoll = reading.rollId && Object.hasOwn(values.rolls, reading.rollId) ? values.rolls[reading.rollId] : undefined;
  const sameProduct = reading.productCode && Object.hasOwn(values.products, reading.productCode) ? values.products[reading.productCode] : undefined;
  const calibration = [sameRoll, sameProduct].find(p => p?.source === "manual" && p.confirmed && validProfile(p) &&
    (!p.productCode || !reading.productCode || p.productCode === reading.productCode));
  const mapped = reading.productCode && Object.hasOwn(ROLL_CATALOG, reading.productCode) && ROLL_CATALOG[reading.productCode];
  if (calibration && mapped && mapped.tailLengthMm && calibration.tailLengthMm === undefined) return {
    ...calibration, rollId: reading.rollId, tailLengthMm: mapped.tailLengthMm, tailPosition: "end", folded: true, confirmed: false,
    sourceDetail: "Profil lama belum memisahkan ekor label kabel. Cocokkan panjang badan, ekor, dan posisinya lalu konfirmasikan kembali.",
  };
  const labelType = reading.labelType ?? calibration?.labelType;
  const tailChanged = reading.tailLengthMm !== undefined && reading.tailLengthMm !== (calibration?.measuredTailAtConfirmation ?? calibration?.tailLengthMm ?? 0);
  // A measured correction only applies while the printer reports the same geometry.
  if (calibration?.measuredAtConfirmation && reading.dimensions && !tailChanged &&
      calibration.measuredAtConfirmation.widthMm === reading.dimensions.widthMm &&
      calibration.measuredAtConfirmation.lengthMm === reading.dimensions.lengthMm &&
      (calibration.widthMm !== reading.dimensions.widthMm || calibration.lengthMm !== reading.dimensions.lengthMm ||
        (calibration.measuredTailAtConfirmation !== undefined && calibration.measuredTailAtConfirmation !== calibration.tailLengthMm))) {
    return { ...calibration, rollId: reading.rollId, productCode: reading.productCode,
      labelType: labelType ?? calibration.labelType, confirmed: [1, 5].includes(labelType ?? 0) };
  }
  if (reading.dimensions && validSize(reading.dimensions)) {
    const tailLengthMm = reading.tailLengthMm ?? calibration?.tailLengthMm;
    const candidate: LabelProfile = {
      ...reading.dimensions, source: "printer", rollId: reading.rollId, productCode: reading.productCode, folded: calibration?.folded,
      tailLengthMm, tailPosition: calibration?.tailPosition,
      labelType: labelType || 1, confirmed: [1, 5].includes(labelType ?? 0) && (!tailLengthMm || !!calibration) && !tailChanged,
      sourceDetail: labelType === undefined
        ? "Printer melaporkan ukuran. Konfirmasikan jenis label secara manual."
        : tailLengthMm && (!calibration || tailChanged) ? "Printer melaporkan ukuran dan ekor. Konfirmasikan bentuk dan posisi ekor."
        : "Ukuran dilaporkan langsung oleh printer",
    };
    return { ...candidate, confirmed: candidate.confirmed && validProfile(candidate) };
  }
  // A measured manual correction must survive another check of a catalogued roll.
  if (calibration) return { ...calibration, rollId: reading.rollId, productCode: reading.productCode,
    labelType: labelType ?? calibration.labelType, confirmed: !tailChanged && [1, 5].includes(labelType ?? 0) };
  if (mapped) return { ...mapped, source: "mapping", rollId: reading.rollId, productCode: reading.productCode,
    labelType: reading.labelType ?? mapped.labelType, confirmed: !mapped.requiresConfirmation && [1, 5].includes(reading.labelType ?? mapped.labelType), sourceDetail: mapped.source };
  // Never reuse a previous roll's detected/mapped dimensions as freshly detected data.
  const previous = calibration ?? values.last;
  if (!previous || !validProfile(previous)) return undefined;
  return {
    ...previous, source: "manual", rollId: reading.rollId, productCode: reading.productCode,
    labelType: reading.labelType || previous.labelType,
    confirmed: !!calibration && [1, 5].includes(labelType ?? 0),
    sourceDetail: calibration ? "Profil tersimpan untuk roll atau kode produk ini" : "Ukuran terakhir; konfirmasikan untuk roll yang terpasang",
  };
}
export function saveProfile(profile: LabelProfile, storage: StorageLike) {
  if (!validProfile(profile) || ![1, 5].includes(profile.labelType)) throw new Error("Ukuran/jenis label tidak valid. Lebar 5–15 mm, panjang total 10–200 mm; badan label setelah dikurangi ekor minimal 10 mm.");
  const values = saved(storage);
  values.last = profile;
  if (profile.rollId) values.rolls[profile.rollId] = profile;
  if (profile.productCode) values.products[profile.productCode] = profile;
  storage.setItem(KEY, JSON.stringify(values));
}
export function paperFingerprint(reading: PaperReading, profile: LabelProfile): string {
  return JSON.stringify([reading.rollId || null, reading.productCode || null,
    profile.widthMm, profile.lengthMm, profile.labelType, !!profile.folded, profile.tailLengthMm ?? 0, profile.tailPosition ?? "end", reading.tailLengthMm ?? null]);
}
