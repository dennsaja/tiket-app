/** Stable IDs allow installation/update without duplicating or replacing NOC categories. */
export const TICKET_TAXONOMY = [
  { type: "psb", name: "PSB · Pemasangan internet", items: ["Instalasi FTTH rumah", "Instalasi kantor / bisnis", "Penambahan titik / perangkat", "Relokasi instalasi", "Survei dan aktivasi layanan"] },
  { type: "perbaikan_infrastruktur", name: "Perbaikan infrastruktur", items: ["Kabel putus / dropcore", "LOS / redaman tinggi", "ONT / router / adaptor", "ODP / splitter / port", "Internet lambat / intermiten", "Konfigurasi jaringan"] },
  { type: "pemasangan_cctv", name: "Pemasangan CCTV", items: ["Kamera IP / PoE", "Kamera analog / coaxial", "NVR / DVR dan penyimpanan", "Penarikan kabel dan jaringan", "Akses pemantauan jarak jauh"] },
  { type: "perbaikan_cctv", name: "Perbaikan CCTV", items: ["Kamera mati / gambar bermasalah", "Rekaman / hard disk", "NVR / DVR offline", "Kabel / konektor / daya", "Akses aplikasi / remote"] },
  { type: "maintenance", name: "Maintenance berkala", items: ["Audit redaman dan koneksi", "Pembersihan rack / perangkat", "Pemeriksaan UPS / catu daya", "Pemeliharaan kamera CCTV", "Pembaruan konfigurasi / firmware"] },
] as const;
export function categoryTicketType(category: { id: string; name?: string }): string | null {
  return TICKET_TAXONOMY.find(item => category.id === `service-${item.type}` || item.name.toLocaleLowerCase("id") === category.name?.toLocaleLowerCase("id"))?.type ?? null;
}
