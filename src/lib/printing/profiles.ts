import type { LabelProfile, LabelSize, PaperReading, StorageLike } from "./types";

// Match exact product identifiers only. RFID barcodes can differ from retail SKUs.
const source = "Katalog D110_M NIIMBOT USA · https://niimbotusa.com/printers/d110-m";
export const ROLL_CATALOG: Record<string, LabelSize & { labelType: number; source: string }> = {
  A2A68601301: { widthMm: 15, lengthMm: 30, labelType: 1, source },
  A2A68601601: { widthMm: 12, lengthMm: 40, labelType: 1, source },
  A2A68601001: { widthMm: 15, lengthMm: 50, labelType: 1, source },
  A2G88588201: { widthMm: 14, lengthMm: 30, labelType: 5, source },
  A2G88588302: { widthMm: 14, lengthMm: 40, labelType: 5, source },
};
const KEY = "tiket.usb-label-profiles.v1";
interface SavedProfiles { rolls: Record<string, LabelProfile>; products: Record<string, LabelProfile>; last?: LabelProfile }

export function validSize(size: LabelSize): boolean {
  return Number.isFinite(size.widthMm) && Number.isFinite(size.lengthMm)
    && size.widthMm >= 5 && size.widthMm <= 15 && size.lengthMm >= 10 && size.lengthMm <= 200;
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
  const calibration = [sameRoll, sameProduct].find(p => p?.source === "manual" && p.confirmed && validSize(p) &&
    (!p.productCode || !reading.productCode || p.productCode === reading.productCode));
  const labelType = reading.labelType ?? calibration?.labelType;
  // A measured correction only applies while the printer reports the same geometry.
  if (calibration?.measuredAtConfirmation && reading.dimensions &&
      calibration.measuredAtConfirmation.widthMm === reading.dimensions.widthMm &&
      calibration.measuredAtConfirmation.lengthMm === reading.dimensions.lengthMm &&
      (calibration.widthMm !== reading.dimensions.widthMm || calibration.lengthMm !== reading.dimensions.lengthMm)) {
    return { ...calibration, rollId: reading.rollId, productCode: reading.productCode,
      labelType: labelType ?? calibration.labelType, confirmed: [1, 5].includes(labelType ?? 0) };
  }
  if (reading.dimensions && validSize(reading.dimensions)) return {
    ...reading.dimensions, source: "printer", rollId: reading.rollId, productCode: reading.productCode, folded: calibration?.folded,
    labelType: labelType || 1, confirmed: [1, 5].includes(labelType ?? 0),
    sourceDetail: labelType === undefined
      ? "Printer melaporkan ukuran. Konfirmasikan jenis label secara manual."
      : "Ukuran dilaporkan langsung oleh printer",
  };
  const mapped = reading.productCode && Object.hasOwn(ROLL_CATALOG, reading.productCode) && ROLL_CATALOG[reading.productCode];
  if (mapped) return { ...mapped, source: "mapping", rollId: reading.rollId, productCode: reading.productCode, folded: calibration?.folded, labelType: reading.labelType ?? mapped.labelType, confirmed: [1, 5].includes(reading.labelType ?? mapped.labelType), sourceDetail: mapped.source };
  // Never reuse a previous roll's detected/mapped dimensions as freshly detected data.
  const previous = calibration ?? values.last;
  if (!previous || !validSize(previous)) return undefined;
  return {
    ...previous, source: "manual", rollId: reading.rollId, productCode: reading.productCode,
    labelType: reading.labelType || previous.labelType,
    confirmed: !!calibration && [1, 5].includes(labelType ?? 0),
    sourceDetail: calibration ? "Profil tersimpan untuk roll atau kode produk ini" : "Ukuran terakhir; konfirmasikan untuk roll yang terpasang",
  };
}
export function saveProfile(profile: LabelProfile, storage: StorageLike) {
  if (!validSize(profile) || ![1, 5].includes(profile.labelType)) throw new Error("Ukuran/jenis label tidak didukung D110. Lebar 5–15 mm, panjang 10–200 mm.");
  const values = saved(storage);
  values.last = profile;
  if (profile.rollId) values.rolls[profile.rollId] = profile;
  if (profile.productCode) values.products[profile.productCode] = profile;
  storage.setItem(KEY, JSON.stringify(values));
}
export function paperFingerprint(reading: PaperReading, profile: LabelProfile): string {
  return JSON.stringify([reading.rollId || null, reading.productCode || null,
    profile.widthMm, profile.lengthMm, profile.labelType]);
}
