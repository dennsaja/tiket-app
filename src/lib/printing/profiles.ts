import type { LabelProfile, LabelSize, PaperReading, StorageLike } from "./types";

// Only add codes verified against a manufacturer's specification or a measured roll.
// An empty catalog is intentional: RFID/barcodes are not a dimension encoding.
export const ROLL_CATALOG: Record<string, LabelSize & { labelType: number; source: string }> = {};
const KEY = "tiket.usb-label-profiles.v1";
interface SavedProfiles { rolls: Record<string, LabelProfile>; last?: LabelProfile }

export function validSize(size: LabelSize): boolean {
  return Number.isFinite(size.widthMm) && Number.isFinite(size.lengthMm)
    && size.widthMm >= 5 && size.widthMm <= 15 && size.lengthMm >= 10 && size.lengthMm <= 200;
}
function saved(storage: StorageLike): SavedProfiles {
  try {
    const value = JSON.parse(storage.getItem(KEY) || "{}");
    return { rolls: value.rolls || {}, last: value.last };
  } catch { return { rolls: {} }; }
}
export function resolveProfile(reading: PaperReading, storage: StorageLike): LabelProfile | undefined {
  if (reading.dimensions && validSize(reading.dimensions)) return {
    ...reading.dimensions, source: "printer", rollId: reading.rollId,
    labelType: reading.labelType || 1, confirmed: reading.labelType !== undefined,
    sourceDetail: reading.labelType === undefined
      ? "Dimensi eksplisit dari PaperInfo USB; jenis label perlu dikonfirmasi manual"
      : "Dimensi eksplisit dari respons PaperInfo USB",
  };
  const mapped = reading.productCode && ROLL_CATALOG[reading.productCode];
  if (mapped) return { ...mapped, source: "mapping", rollId: reading.rollId, confirmed: true, sourceDetail: mapped.source };
  const values = saved(storage);
  const sameRoll = reading.rollId ? values.rolls[reading.rollId] : undefined;
  // Never reuse a previous roll's detected/mapped dimensions as freshly detected data.
  const previous = sameRoll?.source === "manual" ? sameRoll : values.last;
  if (!previous || !validSize(previous)) return undefined;
  return {
    ...previous, source: "manual", rollId: reading.rollId,
    labelType: reading.labelType || previous.labelType,
    confirmed: !!sameRoll && sameRoll.source === "manual",
    sourceDetail: sameRoll?.source === "manual" ? "Profil manual untuk identitas roll ini" : "Ukuran terakhir; konfirmasikan untuk roll yang terpasang",
  };
}
export function saveProfile(profile: LabelProfile, storage: StorageLike) {
  if (!validSize(profile) || ![1, 5].includes(profile.labelType)) throw new Error("Ukuran/jenis label tidak didukung D110. Lebar 5–15 mm, panjang 10–200 mm.");
  const values = saved(storage);
  values.last = profile;
  if (profile.rollId) values.rolls[profile.rollId] = profile;
  storage.setItem(KEY, JSON.stringify(values));
}
export function paperFingerprint(reading: PaperReading, profile: LabelProfile): string {
  return JSON.stringify([reading.rollId || null, reading.productCode || null,
    profile.widthMm, profile.lengthMm, profile.labelType]);
}
