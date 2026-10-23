package net.infinityteknik.helpdesk.data

import org.json.JSONObject

/** Declarative content only. This protocol never downloads or executes code. */
data class MobileConfiguration(
    val version: Long = 0,
    val homeSubtitle: String = "Ruang kerja kamu, lebih terhubung.",
    val announcementTitle: String = "",
    val announcementBody: String = "",
    val showActivityChart: Boolean = true,
    val recentTicketLimit: Int = 3,
    val refreshIntervalSeconds: Int = 15
) {
    companion object {
        fun parse(raw: String, appVersion: Long): MobileConfiguration {
            require(raw.length <= 8192) { "Konfigurasi terlalu besar" }
            val envelope = JSONObject(raw)
            require(envelope.getInt("schemaVersion") == 1) { "Format konfigurasi belum didukung" }
            require(envelope.getLong("minAppVersionCode") <= appVersion) { "Konfigurasi memerlukan APK lebih baru" }
            val version = envelope.getLong("version")
            require(version >= 0)
            val data = envelope.getJSONObject("config")
            val subtitle = data.getString("homeSubtitle").trim()
            val title = data.getString("announcementTitle").trim()
            val body = data.getString("announcementBody").trim()
            val recent = data.getInt("recentTicketLimit")
            val refresh = data.getInt("refreshIntervalSeconds")
            require(subtitle.length in 1..140 && title.length <= 80 && body.length <= 600)
            require(recent in 1..8 && refresh in 15..120)
            return MobileConfiguration(version, subtitle, title, body, data.getBoolean("showActivityChart"), recent, refresh)
        }
    }
}
