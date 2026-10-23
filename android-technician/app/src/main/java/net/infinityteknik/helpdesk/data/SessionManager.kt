package net.infinityteknik.helpdesk.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

class SessionManager(context: Context) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "helpdesk_technician_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_DUTY_ACTIVE = "duty_active"
        private const val KEY_LAST_LAT = "last_lat"
        private const val KEY_LAST_LNG = "last_lng"
        private const val KEY_LAST_ACC = "last_acc"
        private const val KEY_LAST_UPDATE = "last_update"
        private const val KEY_ACTIVE_TICKETS_COUNT = "active_tickets_count"
        private const val KEY_ALERTED_NOTIF_IDS = "alerted_notif_ids"
        private const val KEY_NOTIF_BASELINE_SET = "notif_baseline_set_v2"
        private const val KEY_TICKETS_SNAPSHOT_JSON = "tickets_snapshot_json_v1"
        private const val KEY_TICKETS_SNAPSHOT_INIT = "tickets_snapshot_init_v1"
        private const val KEY_SEEN_MSG_IDS = "seen_msg_ids_v1"
        private const val KEY_INIT_MSG_TICKET_IDS = "init_msg_ticket_ids_v1"
        private const val KEY_LOCAL_NOTIFS_JSON = "local_notifs_json_v1"
        private const val KEY_WELCOME_NOTIF_V14 = "welcome_notif_v14"

        const val DEFAULT_SERVER_URL = "https://helpdesk.infinityteknik.net"
    }

    val serverUrl: String get() = DEFAULT_SERVER_URL

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var userId: String?
        get() = prefs.getString(KEY_USER_ID, null)
        set(value) = prefs.edit().putString(KEY_USER_ID, value).apply()

    var userName: String?
        get() = prefs.getString(KEY_USER_NAME, "Teknisi")
        set(value) = prefs.edit().putString(KEY_USER_NAME, value).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_USER_EMAIL, "")
        set(value) = prefs.edit().putString(KEY_USER_EMAIL, value).apply()

    var userRole: String?
        get() = prefs.getString(KEY_USER_ROLE, "agent")
        set(value) = prefs.edit().putString(KEY_USER_ROLE, value).apply()

    var isDutyActive: Boolean
        get() = prefs.getBoolean(KEY_DUTY_ACTIVE, false)
        set(value) = prefs.edit().putBoolean(KEY_DUTY_ACTIVE, value).apply()

    var lastLatitude: Double
        get() = java.lang.Double.longBitsToDouble(prefs.getLong(KEY_LAST_LAT, 0))
        set(value) = prefs.edit().putLong(KEY_LAST_LAT, java.lang.Double.doubleToRawLongBits(value)).apply()

    var lastLongitude: Double
        get() = java.lang.Double.longBitsToDouble(prefs.getLong(KEY_LAST_LNG, 0))
        set(value) = prefs.edit().putLong(KEY_LAST_LNG, java.lang.Double.doubleToRawLongBits(value)).apply()

    var lastAccuracy: Float
        get() = prefs.getFloat(KEY_LAST_ACC, 0f)
        set(value) = prefs.edit().putFloat(KEY_LAST_ACC, value).apply()

    var lastUpdateTime: Long
        get() = prefs.getLong(KEY_LAST_UPDATE, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_UPDATE, value).apply()

    var activeTicketsCount: Int
        get() = prefs.getInt(KEY_ACTIVE_TICKETS_COUNT, 0)
        set(value) = prefs.edit().putInt(KEY_ACTIVE_TICKETS_COUNT, value).apply()

    var isNotifBaselineInitialized: Boolean
        get() = prefs.getBoolean(KEY_NOTIF_BASELINE_SET, false)
        set(value) = prefs.edit().putBoolean(KEY_NOTIF_BASELINE_SET, value).apply()

    var isTicketsSnapshotInitialized: Boolean
        get() = prefs.getBoolean(KEY_TICKETS_SNAPSHOT_INIT, false)
        set(value) = prefs.edit().putBoolean(KEY_TICKETS_SNAPSHOT_INIT, value).apply()

    var ticketsSnapshotJson: String
        get() = prefs.getString(KEY_TICKETS_SNAPSHOT_JSON, "{}") ?: "{}"
        set(value) = prefs.edit().putString(KEY_TICKETS_SNAPSHOT_JSON, value).apply()

    var hasShownWelcomeNotifV14: Boolean
        get() = prefs.getBoolean(KEY_WELCOME_NOTIF_V14, false)
        set(value) = prefs.edit().putBoolean(KEY_WELCOME_NOTIF_V14, value).apply()

    fun hasAlertedNotification(notifId: String): Boolean {
        val current = prefs.getStringSet(KEY_ALERTED_NOTIF_IDS, emptySet()) ?: emptySet()
        return current.contains(notifId)
    }

    fun markNotificationAlerted(notifId: String) {
        val current = (prefs.getStringSet(KEY_ALERTED_NOTIF_IDS, emptySet()) ?: emptySet()).toMutableSet()
        current.add(notifId)
        val trimmed = if (current.size > 200) current.toList().takeLast(200).toSet() else current
        prefs.edit().putStringSet(KEY_ALERTED_NOTIF_IDS, trimmed).apply()
    }

    fun isTicketMessageBaselineInitialized(ticketId: String): Boolean {
        val current = prefs.getStringSet(KEY_INIT_MSG_TICKET_IDS, emptySet()) ?: emptySet()
        return current.contains(ticketId)
    }

    fun markTicketMessageBaselineInitialized(ticketId: String) {
        val current = (prefs.getStringSet(KEY_INIT_MSG_TICKET_IDS, emptySet()) ?: emptySet()).toMutableSet()
        current.add(ticketId)
        prefs.edit().putStringSet(KEY_INIT_MSG_TICKET_IDS, current).apply()
    }

    fun hasSeenMessage(msgId: String): Boolean {
        val current = prefs.getStringSet(KEY_SEEN_MSG_IDS, emptySet()) ?: emptySet()
        return current.contains(msgId)
    }

    fun markMessageSeen(msgId: String) {
        val current = (prefs.getStringSet(KEY_SEEN_MSG_IDS, emptySet()) ?: emptySet()).toMutableSet()
        current.add(msgId)
        val trimmed = if (current.size > 300) current.toList().takeLast(300).toSet() else current
        prefs.edit().putStringSet(KEY_SEEN_MSG_IDS, trimmed).apply()
    }

    fun getLocalNotifications(): List<NotificationItem> {
        val raw = prefs.getString(KEY_LOCAL_NOTIFS_JSON, "[]") ?: "[]"
        val list = mutableListOf<NotificationItem>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                list.add(
                    NotificationItem(
                        id = o.optString("id"),
                        type = o.optString("type", "ticket_updated"),
                        title = o.optString("title", "Notifikasi HelpDesk"),
                        message = o.optString("message", ""),
                        ticketId = o.optString("ticketId", "").takeIf { it.isNotBlank() },
                        ticketNumber = o.optInt("ticketNumber", 0),
                        ticketTitle = o.optString("ticketTitle", ""),
                        ticketStatus = o.optString("ticketStatus", "assigned"),
                        ticketPriority = o.optString("ticketPriority", "medium"),
                        ticketType = o.optString("ticketType", "").takeIf { it.isNotBlank() },
                        reporterName = o.optString("reporterName", "").takeIf { it.isNotBlank() },
                        reporterPhone = o.optString("reporterPhone", "").takeIf { it.isNotBlank() },
                        reporterAddress = o.optString("reporterAddress", "").takeIf { it.isNotBlank() },
                        reporterMapUrl = o.optString("reporterMapUrl", "").takeIf { it.isNotBlank() },
                        ticketDescription = o.optString("ticketDescription", "").takeIf { it.isNotBlank() },
                        isRead = o.optBoolean("isRead", false),
                        createdAt = o.optString("createdAt", "")
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    fun saveLocalNotification(item: NotificationItem) {
        val current = getLocalNotifications().toMutableList()
        if (current.none { it.id == item.id }) {
            current.add(0, item)
        }
        saveLocalNotificationsList(current.take(40))
    }

    fun markLocalNotificationRead(notifId: String) {
        val updated = getLocalNotifications().map {
            if (it.id == notifId) it.copy(isRead = true) else it
        }
        saveLocalNotificationsList(updated)
    }

    fun markAllLocalNotificationsRead() {
        val updated = getLocalNotifications().map { it.copy(isRead = true) }
        saveLocalNotificationsList(updated)
    }

    private fun saveLocalNotificationsList(list: List<NotificationItem>) {
        val arr = JSONArray()
        for (item in list) {
            val o = JSONObject().apply {
                put("id", item.id)
                put("type", item.type)
                put("title", item.title)
                put("message", item.message)
                put("ticketId", item.ticketId ?: "")
                put("ticketNumber", item.ticketNumber)
                put("ticketTitle", item.ticketTitle)
                put("ticketStatus", item.ticketStatus)
                put("ticketPriority", item.ticketPriority)
                put("ticketType", item.ticketType ?: "")
                put("reporterName", item.reporterName ?: "")
                put("reporterPhone", item.reporterPhone ?: "")
                put("reporterAddress", item.reporterAddress ?: "")
                put("reporterMapUrl", item.reporterMapUrl ?: "")
                put("ticketDescription", item.ticketDescription ?: "")
                put("isRead", item.isRead)
                put("createdAt", item.createdAt)
            }
            arr.put(o)
        }
        prefs.edit().putString(KEY_LOCAL_NOTIFS_JSON, arr.toString()).apply()
    }

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank()

    fun saveUser(profile: UserProfile, jwtToken: String) {
        net.infinityteknik.helpdesk.util.OfflineSyncManager.prepareAccount(appContext, profile.id)
        if (userId != profile.id) prefs.edit().clear().commit()
        prefs.edit()
            .putString(KEY_TOKEN, jwtToken)
            .putString(KEY_USER_ID, profile.id)
            .putString(KEY_USER_NAME, profile.name)
            .putString(KEY_USER_EMAIL, profile.email)
            .putString(KEY_USER_ROLE, profile.role)
            .putString("user_phone", profile.phone)
            .putString("user_avatar", profile.avatarUrl)
            .apply()
    }

    var userPhone: String?
        get() = prefs.getString("user_phone", null)
        set(value) = prefs.edit().putString("user_phone", value).apply()
    var userAvatar: String?
        get() = prefs.getString("user_avatar", null)
        set(value) = prefs.edit().putString("user_avatar", value).apply()
    var chatRoomsJson: String?
        get() = prefs.getString("chat_rooms_v1", null)
        set(value) = prefs.edit().putString("chat_rooms_v1", value).apply()
    var mobileConfigurationJson: String?
        get() = prefs.getString("mobile_configuration_v1", null)
        set(value) = prefs.edit().putString("mobile_configuration_v1", value).apply()
    fun seenRoomMessage(ticketId: String) = prefs.getString("chat_seen_" + ticketId, null)
    fun markRoomSeen(ticketId: String, messageId: String?) { prefs.edit().putString("chat_seen_" + ticketId, messageId).apply() }
    fun chatDraft(ticketId: String) = prefs.getString("chat_draft_" + ticketId, "").orEmpty()
    fun saveChatDraft(ticketId: String, value: String) { prefs.edit().putString("chat_draft_" + ticketId, value).apply() }
    fun threadMessages(ticketId: String) = prefs.getString("thread_cache_" + ticketId, null)
    fun saveThreadMessages(ticketId: String, json: String?) { prefs.edit().putString("thread_cache_" + ticketId, json).apply() }

    fun beginWebLogin(): String {
        val state = net.infinityteknik.helpdesk.util.WebLoginState.create()
        prefs.edit().putString("web_login_state", state)
            .putLong("web_login_started_at", System.currentTimeMillis()).commit()
        return state
    }

    fun acceptsWebCallback(state: String?): Boolean =
        net.infinityteknik.helpdesk.util.WebLoginState.matches(
            prefs.getString("web_login_state", null), state,
            prefs.getLong("web_login_started_at", 0L), System.currentTimeMillis()
        )

    fun clearWebLogin() {
        prefs.edit().remove("web_login_state").remove("web_login_started_at").apply()
    }

    fun logout() {
        // Offline drafts stay in their account's store; no other account can upload them.
        prefs.edit().clear().commit()
    }
}
