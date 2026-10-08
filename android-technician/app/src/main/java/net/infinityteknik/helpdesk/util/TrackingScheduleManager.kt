package net.infinityteknik.helpdesk.util

import java.util.Calendar
import java.util.TimeZone

object TrackingScheduleManager {

    /**
     * Checks if current time is within official WIB working hours (08:00 - 16:00 WIB).
     * TimeZone: Asia/Jakarta (WIB = UTC+7)
     */
    fun isWibWorkHours(): Boolean {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta"))
        val hour = cal.get(Calendar.HOUR_OF_DAY) // 0 - 23
        // 08:00 AM WIB to 16:00 PM WIB:
        // hour 8, 9, 10, 11, 12, 13, 14, 15 are during work hours (08:00:00 to 15:59:59)
        // At 16:00:00 (hour == 16), working hours end
        return hour in 8..15
    }

    /**
     * Determines whether GPS tracking MUST be actively running and LOCKED (technician cannot turn it off).
     * Conditions:
     * 1. Current time is during work hours (08:00 - 16:00 WIB), OR
     * 2. There is at least 1 active unfinished task/ticket assigned.
     */
    fun isTrackingMandatory(activeTicketsCount: Int): Boolean {
        return isWibWorkHours() || activeTicketsCount > 0
    }

    /**
     * Determines whether GPS tracking should automatically turn OFF.
     * Conditions:
     * Outside working hours (past 16:00 WIB or before 08:00 WIB) AND all tickets are finished (activeTicketsCount == 0).
     */
    fun shouldAutoTurnOff(activeTicketsCount: Int): Boolean {
        return !isWibWorkHours() && activeTicketsCount <= 0
    }

    /**
     * User-facing explanation why tracking cannot be turned off.
     */
    fun getLockedReasonMessage(): String {
        return "Pelacakan GPS wajib aktif selama jam kerja (08:00 - 16:00 WIB) atau saat masih ada tiket tugas aktif."
    }
}
