package net.infinityteknik.helpdesk.util

object LocationPolicy {
    const val MAX_FIX_AGE_MS = 600_000L // 10 minutes (optimal for 5-minute interval)
    const val MAX_ACCURACY_METERS = 100f

    fun hasCoordinates(latitude: Double?, longitude: Double?): Boolean =
        latitude != null && longitude != null &&
            latitude.isFinite() && longitude.isFinite() &&
            latitude in -90.0..90.0 && longitude in -180.0..180.0 &&
            !(latitude == 0.0 && longitude == 0.0)

    fun isFresh(fixTime: Long, now: Long = System.currentTimeMillis()): Boolean =
        fixTime > 0 && now >= fixTime && now - fixTime <= MAX_FIX_AGE_MS

    fun canTrack(loggedIn: Boolean, role: String?, activeTickets: Int, hasPermission: Boolean, locationEnabled: Boolean): Boolean =
        loggedIn && role == "agent" && activeTickets > 0 && hasPermission && locationEnabled

    fun isFinished(status: String): Boolean = status.lowercase() in setOf("resolved", "closed", "cancelled")
}
