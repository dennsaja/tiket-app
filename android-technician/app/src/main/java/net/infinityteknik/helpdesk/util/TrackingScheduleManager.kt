package net.infinityteknik.helpdesk.util

object TrackingScheduleManager {

    /**
     * Determines whether GPS tracking MUST be active.
     * Rule: GPS is ONLY active when the technician has at least 1 unfinished active ticket.
     */
    fun isTrackingMandatory(activeTicketsCount: Int): Boolean {
        return activeTicketsCount > 0
    }

    /**
     * Determines whether GPS tracking should automatically turn OFF.
     * Rule: Whenever there are no active unfinished tickets (activeTicketsCount <= 0), GPS turns OFF immediately.
     */
    fun shouldAutoTurnOff(activeTicketsCount: Int): Boolean {
        return activeTicketsCount <= 0
    }

    /**
     * User-facing explanation of the GPS rule.
     */
    fun getLockedReasonMessage(): String {
        return "Pelacakan GPS otomatis aktif hanya saat ada tiket yang belum selesai, dan otomatis mati saat tidak ada tiket aktif."
    }
}
