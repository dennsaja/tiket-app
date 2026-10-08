package net.infinityteknik.helpdesk.data

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {
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

        const val DEFAULT_SERVER_URL = "https://helpdesk.infinityteknik.net"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trim().removeSuffix("/")).apply()

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
        get() = prefs.getBoolean(KEY_DUTY_ACTIVE, true)
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

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank()

    fun saveUser(profile: UserProfile, jwtToken: String) {
        prefs.edit()
            .putString(KEY_TOKEN, jwtToken)
            .putString(KEY_USER_ID, profile.id)
            .putString(KEY_USER_NAME, profile.name)
            .putString(KEY_USER_EMAIL, profile.email)
            .putString(KEY_USER_ROLE, profile.role)
            .apply()
    }

    fun logout() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_ROLE)
            .putBoolean(KEY_DUTY_ACTIVE, false)
            .apply()
    }
}
