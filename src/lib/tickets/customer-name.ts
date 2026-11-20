/** Installation categories use the customer name as their physical cable label. */
export function isInstallationTicketType(type?: string | null): boolean {
  return type === "psb" || type === "pemasangan_cctv";
}

export const CUSTOMER_NAME_REQUIRED = "Nama pelanggan wajib diisi untuk tiket pemasangan";

export function customerLabelName(name?: string | null): string {
  return name?.trim().replace(/\s+/gu, " ") || "";
}
