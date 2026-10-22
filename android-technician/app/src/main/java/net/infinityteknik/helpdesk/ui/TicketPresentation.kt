package net.infinityteknik.helpdesk.ui

import net.infinityteknik.helpdesk.data.TicketItem
import org.json.JSONObject

object TicketPresentation {
    fun typeLabel(type: String?) = when(type) {
        "psb" -> "PSB · Pasang internet"
        "perbaikan_infrastruktur" -> "Perbaikan infrastruktur"
        "pemasangan_cctv" -> "Pemasangan CCTV"
        "perbaikan_cctv" -> "Perbaikan CCTV"
        "maintenance" -> "Maintenance berkala"
        else -> type?.replace("_", " ")?.takeIf { it.isNotBlank() } ?: "Tiket pekerjaan"
    }
    private val labels = mapOf(
        "bandwidth" to "Paket / bandwidth", "ontModel" to "Model ONT", "odpCode" to "Kode ODP", "odpPort" to "Port ODP",
        "cableLength" to "Panjang kabel", "scheduledAt" to "Jadwal kunjungan", "ontSerialNumber" to "Nomor seri ONT", "notes" to "Catatan admin",
        "issueType" to "Jenis gangguan", "rxPower" to "Daya optik / redaman", "affectedLocation" to "Area terdampak", "pppoeAccount" to "Akun PPPoE",
        "affectedDevice" to "Perangkat terdampak", "cameraCount" to "Jumlah kamera", "cameraType" to "Jenis kamera", "recorderType" to "Perekam / penyimpanan",
        "cableType" to "Jenis kabel / jaringan", "locationScope" to "Lingkup pemasangan", "symptom" to "Gejala gangguan", "troubledCameras" to "Kamera bermasalah",
        "deviceModel" to "Model perangkat", "scope" to "Lingkup pemeliharaan", "period" to "Periode", "targetLocations" to "Lokasi pemeliharaan",
        "odpCoordinates" to "Koordinat ODP", "odpMapUrl" to "Peta ODP", "customerCoordinates" to "Koordinat pelanggan",
        "customerUpdatedBy" to "Titik pelanggan diperbarui oleh", "customerUpdatedAt" to "Waktu pembaruan titik pelanggan",
        "odpUpdatedBy" to "Titik ODP diperbarui oleh", "odpUpdatedAt" to "Waktu pembaruan titik ODP"
    )
    fun fields(ticket: TicketItem): List<Pair<String,String>> {
        val result = mutableListOf<Pair<String,String>>()
        fun add(label:String,value:String?) { value?.trim()?.takeIf { it.isNotEmpty() && it != "null" }?.let { result.add(label to it) } }
        add("Kategori",ticket.categoryName); add("Subkategori",ticket.subcategoryName); add("Departemen",ticket.departmentName); add("Dibuat oleh",ticket.requesterName)
        val spec = runCatching { JSONObject(ticket.specDataJson.orEmpty()) }.getOrNull() ?: return result
        spec.keys().forEach { key ->
            if (!spec.isNull(key)) {
                val value = spec.opt(key)
                val readable = when(value) { true -> "Ya"; false -> "Tidak"; else -> value?.toString() }
                if (readable !in listOf("{}", "[]")) add(labels[key] ?: key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replace('_',' ').replaceFirstChar { it.uppercase() },readable)
            }
        }
        return result
    }
}
