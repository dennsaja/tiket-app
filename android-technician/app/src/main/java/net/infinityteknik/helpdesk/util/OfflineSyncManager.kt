package net.infinityteknik.helpdesk.util

import android.content.Context
import android.content.Intent
import android.location.Location
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import net.infinityteknik.helpdesk.data.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * Manages:
 * - Offline Ticket Cache (FR-23)
 * - Offline GPS Point Buffer & Chronological Batch Upload (GT-04)
 * - GPS Accuracy & Jump Filter (GT-05: filters >50m accuracy without losing valid points)
 * - Offline Status & Work Report Queue with UUID Idempotency (FR-24, FR-25, 8.2)
 * - Work Report Auto-Draft Storage per Ticket (FR-20)
 */
object OfflineSyncManager {

    const val ACTION_SYNC_STATE_CHANGED = "net.infinityteknik.helpdesk.SYNC_STATE_CHANGED"

    private const val PREF_OFFLINE = "helpdesk_offline_sync_v2"
    private const val KEY_CACHED_TICKETS = "cached_tickets_json"
    private const val KEY_GPS_BUFFER = "gps_offline_buffer_json"
    private const val KEY_ACTION_QUEUE = "offline_action_queue_json"
    private const val KEY_REPORT_DRAFTS = "report_drafts_map_json"
    private const val KEY_LAST_SYNC_TIME = "last_sync_timestamp"
    private const val KEY_LAST_GPS_SENT_TIME = "last_gps_sent_timestamp"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREF_OFFLINE, Context.MODE_PRIVATE)

    fun isOnline(context: Context): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val net = cm.activeNetwork ?: return false
                val caps = cm.getNetworkCapabilities(net) ?: return false
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            } else {
                @Suppress("DEPRECATION")
                val info = cm.activeNetworkInfo
                @Suppress("DEPRECATION")
                info != null && info.isConnected
            }
        } catch (e: Exception) {
            true
        }
    }

    // =========================================================================
    // 1. OFFLINE TICKET CACHE (FR-23)
    // =========================================================================

    fun saveCachedTickets(context: Context, tickets: List<TicketItem>) {
        try {
            val arr = JSONArray()
            for (t in tickets) {
                arr.put(ApiClient.ticketToJsonObject(t))
            }
            prefs(context).edit()
                .putString(KEY_CACHED_TICKETS, arr.toString())
                .putLong(KEY_LAST_SYNC_TIME, System.currentTimeMillis())
                .apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getCachedTickets(context: Context): List<TicketItem> {
        val raw = prefs(context).getString(KEY_CACHED_TICKETS, null) ?: return emptyList()
        val list = ArrayList<TicketItem>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                list.add(ApiClient.parseTicketObject(arr.getJSONObject(i)))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    fun updateCachedTicketStatusLocally(context: Context, ticketId: String, newStatus: String) {
        val current = getCachedTickets(context)
        if (current.isEmpty()) return
        val updated = current.map {
            if (it.id == ticketId) it.copy(status = newStatus) else it
        }
        saveCachedTickets(context, updated)
    }

    // =========================================================================
    // 2. GPS ACCURACY FILTER (GT-05) & OFFLINE GPS BUFFER (GT-04)
    // =========================================================================

    /**
     * GT-05: Filter out inaccurate fixes (> 50m accuracy) or impossible teleports (> 250 km/h)
     * unless we have no previous valid location yet.
     */
    fun isLocationValid(
        loc: Location,
        lastLat: Double,
        lastLng: Double,
        lastTimeMs: Long
    ): Boolean {
        if (loc.latitude == 0.0 && loc.longitude == 0.0) return false
        // If accuracy is worse than 50m and we already have a recent fix (< 5 mins ago), filter out
        if (loc.hasAccuracy() && loc.accuracy > 50f && lastLat != 0.0 && (System.currentTimeMillis() - lastTimeMs) < 300_000L) {
            return false
        }
        // Check for impossible jump (> 250 km/h) if previous fix was recent
        if (lastLat != 0.0 && lastLng != 0.0 && lastTimeMs > 0L) {
            val dtSec = (loc.time - lastTimeMs) / 1000.0
            if (dtSec in 1.0..120.0) {
                val results = FloatArray(1)
                Location.distanceBetween(lastLat, lastLng, loc.latitude, loc.longitude, results)
                val speedKmh = (results[0] / dtSec) * 3.6
                if (speedKmh > 250.0 && loc.accuracy > 25f) {
                    return false
                }
            }
        }
        return true
    }

    @Synchronized
    fun enqueueGpsPoint(context: Context, point: LocationPayload) {
        try {
            val current = getBufferedGpsPoints(context).toMutableList()
            current.add(point)
            val trimmed = if (current.size > 300) current.takeLast(300) else current
            saveBufferedGpsPoints(context, trimmed)
            broadcastSyncState(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @Synchronized
    fun getBufferedGpsPoints(context: Context): List<LocationPayload> {
        val raw = prefs(context).getString(KEY_GPS_BUFFER, "[]") ?: "[]"
        val list = ArrayList<LocationPayload>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                list.add(
                    LocationPayload(
                        latitude = o.getDouble("lat"),
                        longitude = o.getDouble("lng"),
                        accuracy = if (o.has("acc")) o.optDouble("acc", 0.0).toFloat() else null,
                        speed = if (o.has("spd")) o.optDouble("spd", 0.0).toFloat() else null,
                        heading = if (o.has("hdg")) o.optDouble("hdg", 0.0).toFloat() else null,
                        battery = if (o.has("bat")) o.optInt("bat", -1) else null,
                        activeTicketId = o.optString("tid", "").takeIf { it.isNotBlank() },
                        deviceTime = o.optLong("time", System.currentTimeMillis())
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    @Synchronized
    private fun saveBufferedGpsPoints(context: Context, points: List<LocationPayload>) {
        val arr = JSONArray()
        for (p in points) {
            arr.put(JSONObject().apply {
                put("lat", p.latitude)
                put("lng", p.longitude)
                if (p.accuracy != null) put("acc", p.accuracy.toDouble())
                if (p.speed != null) put("spd", p.speed.toDouble())
                if (p.heading != null) put("hdg", p.heading.toDouble())
                if (p.battery != null) put("bat", p.battery)
                if (!p.activeTicketId.isNullOrBlank()) put("tid", p.activeTicketId)
                put("time", p.deviceTime)
            })
        }
        prefs(context).edit().putString(KEY_GPS_BUFFER, arr.toString()).apply()
    }

    fun getLastGpsSentTime(context: Context): Long =
        prefs(context).getLong(KEY_LAST_GPS_SENT_TIME, 0L)

    fun markGpsSentNow(context: Context) {
        prefs(context).edit().putLong(KEY_LAST_GPS_SENT_TIME, System.currentTimeMillis()).apply()
    }

    /**
     * Sends a live GPS point AND flushes any buffered offline GPS points in chronological order.
     * If offline or HTTP fails, buffers the point locally so zero GPS history is lost.
     */
    suspend fun sendOrBufferLocation(
        context: Context,
        session: SessionManager,
        point: LocationPayload
    ): Boolean {
        val token = session.token
        if (token.isNullOrBlank()) return false

        if (!isOnline(context)) {
            enqueueGpsPoint(context, point)
            return false
        }

        val buffered = getBufferedGpsPoints(context)
        if (buffered.isNotEmpty()) {
            val combined = (buffered + point).sortedBy { it.deviceTime }
            val batchRes = ApiClient.sendLocationBatch(session.serverUrl, token, combined)
            if (batchRes.isSuccess) {
                saveBufferedGpsPoints(context, emptyList())
                markGpsSentNow(context)
                broadcastSyncState(context)
                return true
            } else {
                enqueueGpsPoint(context, point)
                return false
            }
        } else {
            val res = ApiClient.sendLocation(session.serverUrl, token, point)
            if (res.isSuccess) {
                markGpsSentNow(context)
                return true
            } else {
                enqueueGpsPoint(context, point)
                return false
            }
        }
    }

    // =========================================================================
    // 3. OFFLINE ACTION & WORK REPORT QUEUE (FR-23, FR-24, FR-25)
    // =========================================================================

    @Synchronized
    fun enqueueOfflineAction(context: Context, item: OfflineActionItem) {
        val current = getQueuedActions(context).toMutableList()
        current.add(item)
        saveQueuedActions(context, current)
        broadcastSyncState(context)
    }

    @Synchronized
    fun getQueuedActions(context: Context): List<OfflineActionItem> {
        val raw = prefs(context).getString(KEY_ACTION_QUEUE, "[]") ?: "[]"
        val list = ArrayList<OfflineActionItem>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val bpArr = o.optJSONArray("beforePhotoPaths") ?: JSONArray()
                val apArr = o.optJSONArray("afterPhotoPaths") ?: JSONArray()
                list.add(
                    OfflineActionItem(
                        id = o.optString("id", UUID.randomUUID().toString()),
                        actionType = o.optString("actionType", "status_update"),
                        ticketId = o.getString("ticketId"),
                        ticketNumber = o.optInt("ticketNumber", 0),
                        status = o.optString("status", "").takeIf { it.isNotBlank() },
                        notes = o.optString("notes", "").takeIf { it.isNotBlank() },
                        latitude = if (o.has("latitude") && !o.isNull("latitude")) o.optDouble("latitude") else null,
                        longitude = if (o.has("longitude") && !o.isNull("longitude")) o.optDouble("longitude") else null,
                        distanceMeters = if (o.has("distanceMeters") && !o.isNull("distanceMeters")) o.optDouble("distanceMeters") else null,
                        odpCoordinateType = o.optString("odpCoordinateType", "").takeIf { it.isNotBlank() },
                        reportSummary = o.optString("reportSummary", "").takeIf { it.isNotBlank() },
                        reportActionTaken = o.optString("reportActionTaken", "").takeIf { it.isNotBlank() },
                        reportMaterials = o.optString("reportMaterials", "").takeIf { it.isNotBlank() },
                        reportFinalResult = o.optString("reportFinalResult", "").takeIf { it.isNotBlank() },
                        reportTechnicalJson = o.optString("reportTechnicalJson", "").takeIf { it.isNotBlank() },
                        beforePhotoPaths = (0 until bpArr.length()).mapNotNull { bpArr.optString(it).takeIf { s -> s.isNotBlank() } },
                        afterPhotoPaths = (0 until apArr.length()).mapNotNull { apArr.optString(it).takeIf { s -> s.isNotBlank() } },
                        createdAt = o.optLong("createdAt", System.currentTimeMillis())
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    @Synchronized
    private fun saveQueuedActions(context: Context, list: List<OfflineActionItem>) {
        val arr = JSONArray()
        for (item in list) {
            arr.put(JSONObject().apply {
                put("id", item.id)
                put("actionType", item.actionType)
                put("ticketId", item.ticketId)
                put("ticketNumber", item.ticketNumber)
                put("status", item.status ?: "")
                put("notes", item.notes ?: "")
                if (item.latitude != null) put("latitude", item.latitude)
                if (item.longitude != null) put("longitude", item.longitude)
                if (item.distanceMeters != null) put("distanceMeters", item.distanceMeters)
                put("odpCoordinateType", item.odpCoordinateType ?: "")
                put("reportSummary", item.reportSummary ?: "")
                put("reportActionTaken", item.reportActionTaken ?: "")
                put("reportMaterials", item.reportMaterials ?: "")
                put("reportFinalResult", item.reportFinalResult ?: "")
                put("reportTechnicalJson", item.reportTechnicalJson ?: "")
                put("beforePhotoPaths", JSONArray(item.beforePhotoPaths))
                put("afterPhotoPaths", JSONArray(item.afterPhotoPaths))
                put("createdAt", item.createdAt)
            })
        }
        prefs(context).edit().putString(KEY_ACTION_QUEUE, arr.toString()).apply()
    }

    fun getTotalPendingSyncCount(context: Context): Int {
        return getBufferedGpsPoints(context).size + getQueuedActions(context).size
    }

    fun getLastSyncTime(context: Context): Long =
        prefs(context).getLong(KEY_LAST_SYNC_TIME, 0L)

    /**
     * Flushes both buffered GPS points and queued offline ticket actions/reports when online.
     */
    suspend fun flushAllPendingQueues(context: Context, session: SessionManager): Int {
        if (!isOnline(context)) return 0
        val token = session.token ?: return 0
        var flushedCount = 0

        // 1. Flush GPS Buffer
        val gpsPoints = getBufferedGpsPoints(context)
        if (gpsPoints.isNotEmpty()) {
            val res = ApiClient.sendLocationBatch(session.serverUrl, token, gpsPoints.sortedBy { it.deviceTime })
            if (res.isSuccess) {
                flushedCount += gpsPoints.size
                saveBufferedGpsPoints(context, emptyList())
                markGpsSentNow(context)
            }
        }

        // 2. Flush Queued Status Updates / Coordinate Updates / Work Reports
        val actions = getQueuedActions(context)
        if (actions.isNotEmpty()) {
            val remaining = ArrayList<OfflineActionItem>()
            for (act in actions.sortedBy { it.createdAt }) {
                val success = when (act.actionType) {
                    "status_update" -> {
                        ApiClient.updateTicketStatus(
                            serverUrl = session.serverUrl,
                            token = token,
                            ticketId = act.ticketId,
                            status = act.status,
                            notes = act.notes,
                            summary = null,
                            latitude = act.latitude,
                            longitude = act.longitude,
                            distanceMeters = act.distanceMeters
                        ).isSuccess
                    }
                    "coord_update" -> {
                        ApiClient.updateTicketStatus(
                            serverUrl = session.serverUrl,
                            token = token,
                            ticketId = act.ticketId,
                            status = null,
                            notes = act.notes,
                            summary = null,
                            latitude = act.latitude,
                            longitude = act.longitude,
                            updateCustomerCoordinates = true,
                            odpCoordinateType = act.odpCoordinateType
                        ).isSuccess
                    }
                    "work_report" -> {
                        val beforeFiles = act.beforePhotoPaths.map { File(it) }.filter { it.exists() }
                        val afterFiles = act.afterPhotoPaths.map { File(it) }.filter { it.exists() }
                        val res = ApiClient.submitWorkReport(
                            serverUrl = session.serverUrl,
                            token = token,
                            ticketId = act.ticketId,
                            summary = act.reportSummary ?: "Penyelesaian Tiket #${act.ticketNumber}",
                            actionTaken = act.reportActionTaken ?: "Selesai dikerjakan",
                            materialsUsed = act.reportMaterials ?: "",
                            finalResult = act.reportFinalResult ?: "",
                            beforePhotos = beforeFiles,
                            afterPhotos = afterFiles,
                            technicalDataJson = act.reportTechnicalJson
                        )
                        if (res.isSuccess) {
                            clearReportDraft(context, act.ticketId)
                        }
                        res.isSuccess
                    }
                    else -> true
                }

                if (success) {
                    flushedCount++
                } else {
                    remaining.add(act)
                }
            }
            saveQueuedActions(context, remaining)
        }

        if (flushedCount > 0) {
            prefs(context).edit().putLong(KEY_LAST_SYNC_TIME, System.currentTimeMillis()).apply()
        }
        broadcastSyncState(context)
        return flushedCount
    }

    // =========================================================================
    // 4. WORK REPORT AUTO-DRAFT (FR-20)
    // =========================================================================

    fun saveReportDraft(context: Context, draft: ReportDraftData) {
        try {
            val raw = prefs(context).getString(KEY_REPORT_DRAFTS, "{}") ?: "{}"
            val mapObj = JSONObject(raw)
            val checkedArr = JSONArray()
            draft.checkedIndices.forEach { checkedArr.put(it) }

            val dObj = JSONObject().apply {
                put("ticketId", draft.ticketId)
                put("summary", draft.summary)
                put("actionTaken", draft.actionTaken)
                put("materialsUsed", draft.materialsUsed)
                put("finalResult", draft.finalResult)
                put("ontSerial", draft.ontSerial)
                put("routerType", draft.routerType)
                put("ssidName", draft.ssidName)
                put("opticalPowerDbm", draft.opticalPowerDbm)
                put("odpNamePort", draft.odpNamePort)
                put("cableLengthMeter", draft.cableLengthMeter)
                put("pingSpeedResult", draft.pingSpeedResult)
                put("rootCauseIndex", draft.rootCauseIndex)
                put("customerRecipientName", draft.customerRecipientName)
                put("checkedIndices", checkedArr)
                put("updatedAt", System.currentTimeMillis())
            }
            mapObj.put(draft.ticketId, dObj)
            prefs(context).edit().putString(KEY_REPORT_DRAFTS, mapObj.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getReportDraft(context: Context, ticketId: String): ReportDraftData? {
        try {
            val raw = prefs(context).getString(KEY_REPORT_DRAFTS, "{}") ?: "{}"
            val mapObj = JSONObject(raw)
            val dObj = mapObj.optJSONObject(ticketId) ?: return null
            val checkedArr = dObj.optJSONArray("checkedIndices") ?: JSONArray()
            val checkedSet = mutableSetOf<Int>()
            for (i in 0 until checkedArr.length()) {
                checkedSet.add(checkedArr.optInt(i))
            }
            return ReportDraftData(
                ticketId = ticketId,
                summary = dObj.optString("summary", ""),
                actionTaken = dObj.optString("actionTaken", ""),
                materialsUsed = dObj.optString("materialsUsed", ""),
                finalResult = dObj.optString("finalResult", ""),
                ontSerial = dObj.optString("ontSerial", ""),
                routerType = dObj.optString("routerType", ""),
                ssidName = dObj.optString("ssidName", ""),
                opticalPowerDbm = dObj.optString("opticalPowerDbm", ""),
                odpNamePort = dObj.optString("odpNamePort", ""),
                cableLengthMeter = dObj.optString("cableLengthMeter", ""),
                pingSpeedResult = dObj.optString("pingSpeedResult", ""),
                rootCauseIndex = dObj.optInt("rootCauseIndex", 0),
                customerRecipientName = dObj.optString("customerRecipientName", ""),
                checkedIndices = checkedSet,
                updatedAt = dObj.optLong("updatedAt", 0L)
            )
        } catch (e: Exception) {
            return null
        }
    }

    fun clearReportDraft(context: Context, ticketId: String) {
        try {
            val raw = prefs(context).getString(KEY_REPORT_DRAFTS, "{}") ?: "{}"
            val mapObj = JSONObject(raw)
            mapObj.remove(ticketId)
            prefs(context).edit().putString(KEY_REPORT_DRAFTS, mapObj.toString()).apply()
        } catch (_: Exception) {}
    }

    private fun broadcastSyncState(context: Context) {
        try {
            val intent = Intent(ACTION_SYNC_STATE_CHANGED).apply {
                setPackage(context.packageName)
            }
            context.sendBroadcast(intent)
        } catch (_: Exception) {}
    }
}
