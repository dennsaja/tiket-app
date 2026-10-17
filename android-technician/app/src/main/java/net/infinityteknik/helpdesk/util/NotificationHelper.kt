package net.infinityteknik.helpdesk.util

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.NotificationItem
import net.infinityteknik.helpdesk.data.NotificationsPayload
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import net.infinityteknik.helpdesk.ui.MainActivity
import net.infinityteknik.helpdesk.ui.TicketDetailActivity
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Complete Android Notification Engine:
 * 1. Status Bar Notification (monochrome Web triangle icon R.drawable.ic_stat_helpdesk)
 * 2. Notification Drawer / Panel Notifikasi (expandable BigTextStyle + quick action buttons + In-App Drawer)
 * 3. Heads-Up Notification / Pop-up (IMPORTANCE_HIGH channel with sound + vibration + banner pop-up)
 * 4. Dual-Engine Detection: Polls both /api/notifications AND diffs /api/mobile/tickets + /api/tickets/{id}/messages
 *    so notifications ALWAYS trigger even if the server notifications endpoint is not yet updated.
 */
object NotificationHelper {

    const val CHANNEL_ALERTS_ID = "helpdesk_realtime_alerts_v3"
    const val ACTION_NOTIFICATION_SYNCED = "net.infinityteknik.helpdesk.NOTIFICATION_SYNCED"

    private var cachedWebLogoBitmap: Bitmap? = null
    private val syncMutex = Mutex()

    // In-memory self-action and duplicate suppression caches
    private val recentSelfChats = LinkedHashMap<String, Long>()
    private val recentSelfStatuses = LinkedHashMap<String, Long>()
    private val recentDispatchedFingerprints = LinkedHashMap<String, Long>()

    @Volatile
    var latestCachedPayload: NotificationsPayload? = null
        private set

    private fun normalizeText(input: String?): String {
        if (input.isNullOrBlank()) return ""
        return input.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]"), "")
    }

    @Synchronized
    fun recordSelfSentChat(ticketId: String, content: String) {
        val now = System.currentTimeMillis()
        recentSelfChats.entries.removeAll { now - it.value > 180_000L }
        val snippet = if (content.length > 90) content.substring(0, 90) else content
        val key = "${ticketId}_${normalizeText(snippet).take(60)}"
        recentSelfChats[key] = now
    }

    @Synchronized
    fun isRecentSelfSentChat(ticketId: String?, text: String?): Boolean {
        if (ticketId.isNullOrBlank() || text.isNullOrBlank()) return false
        val now = System.currentTimeMillis()
        recentSelfChats.entries.removeAll { now - it.value > 180_000L }
        val normText = normalizeText(text)
        if (normText.isBlank()) return false

        for ((key, _) in recentSelfChats) {
            if (key.startsWith("${ticketId}_")) {
                val snippetNorm = key.removePrefix("${ticketId}_")
                if (snippetNorm.isNotEmpty() && normText.contains(snippetNorm)) {
                    return true
                }
            }
        }
        return false
    }

    @Synchronized
    fun recordSelfStatusChange(ticketId: String, newStatus: String) {
        val now = System.currentTimeMillis()
        recentSelfStatuses.entries.removeAll { now - it.value > 180_000L }
        recentSelfStatuses["${ticketId}_${newStatus.lowercase(Locale.ROOT)}"] = now
        recentSelfStatuses["${ticketId}_any"] = now
    }

    @Synchronized
    fun isRecentSelfStatusChange(ticketId: String?, status: String?): Boolean {
        if (ticketId.isNullOrBlank()) return false
        val now = System.currentTimeMillis()
        recentSelfStatuses.entries.removeAll { now - it.value > 180_000L }
        if (!status.isNullOrBlank() && recentSelfStatuses.containsKey("${ticketId}_${status.lowercase(Locale.ROOT)}")) {
            return true
        }
        return recentSelfStatuses.containsKey("${ticketId}_any")
    }

    fun getCanonicalCategory(item: NotificationItem): String {
        val t = item.type.lowercase(Locale.ROOT)
        val title = item.title.lowercase(Locale.ROOT)
        return when {
            t == "new_message" || t == "new_internal_note" || title.startsWith("chat tim") || title.startsWith("pesan baru") -> "chat"
            t == "status_changed" || t == "ticket_resolved" || t == "ticket_closed" || t == "ticket_reopened" || title.startsWith("status tiket") -> "status"
            t == "ticket_assigned" || t == "ticket_created" || title.startsWith("penugasan") -> "assign"
            else -> "detail"
        }
    }

    /**
     * Generates a canonical fingerprint shared across Engine 1 (/api/notifications)
     * and Engine 2 (local ticket/message diff) so the same event can NEVER trigger twice.
     */
    fun getEventFingerprint(item: NotificationItem): String {
        val category = getCanonicalCategory(item)
        val ticketKey = item.ticketId?.takeIf { it.isNotBlank() } ?: item.ticketNumber.toString()
        return when (category) {
            "chat" -> "fp_chat_${ticketKey}_${normalizeText(item.message).take(75)}"
            "status" -> "fp_status_${ticketKey}_${normalizeText(item.title).take(60)}"
            "assign" -> "fp_assign_${ticketKey}"
            else -> "fp_detail_${ticketKey}_${normalizeText(item.message).take(60)}"
        }
    }

    /**
     * Detects if a notification was triggered by the technician's own chat message or own status update.
     */
    fun isSelfGeneratedNotification(session: SessionManager, item: NotificationItem): Boolean {
        val myName = session.userName?.trim().orEmpty()
        val category = getCanonicalCategory(item)

        if (category == "chat") {
            if (myName.isNotEmpty() && !myName.equals("Teknisi", ignoreCase = true)) {
                val titleTrim = item.title.trim()
                val msgTrim = item.message.trim()
                if (
                    titleTrim.endsWith("- $myName", ignoreCase = true) ||
                    titleTrim.endsWith("• $myName", ignoreCase = true) ||
                    msgTrim.startsWith("$myName:", ignoreCase = true) ||
                    msgTrim.startsWith("$myName mengirim", ignoreCase = true) ||
                    msgTrim.startsWith("$myName membalas", ignoreCase = true)
                ) {
                    return true
                }
            }
            if (isRecentSelfSentChat(item.ticketId, item.message)) {
                return true
            }
        } else if (category == "status") {
            if (myName.isNotEmpty() && !myName.equals("Teknisi", ignoreCase = true)) {
                if (item.message.trim().startsWith("$myName memperbarui", ignoreCase = true)) {
                    return true
                }
            }
            if (isRecentSelfStatusChange(item.ticketId, item.ticketStatus)) {
                return true
            }
        }
        return false
    }

    fun areSystemNotificationsEnabled(context: Context): Boolean {
        val managerEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        if (!managerEnabled) return false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return false
        }
        return true
    }

    fun openNotificationSettings(context: Context) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", context.packageName, null)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
            } catch (_: Exception) {}
        }
    }

    fun ensureAlertChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val existing = manager.getNotificationChannel(CHANNEL_ALERTS_ID)
            if (existing != null && existing.importance >= NotificationManager.IMPORTANCE_HIGH) return

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ALERTS_ID,
                "Notifikasi Tiket & Chat Tim (Pop-up)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Peringatan real-time untuk chat tim masuk, perubahan status, dan pembaruan detail tiket"
                enableLights(true)
                lightColor = Color.parseColor("#09090B")
                enableVibration(true)
                vibrationPattern = longArrayOf(0L, 300L, 140L, 300L)
                setSound(soundUri, audioAttrs)
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Renders the exact Web HelpDesk Logo (#09090B rounded square + white triangle) as a Bitmap
     * for use as the Large Icon in the Notification Drawer and Heads-Up Pop-up.
     */
    fun getWebLogoBitmap(@Suppress("UNUSED_PARAMETER") context: Context): Bitmap {
        cachedWebLogoBitmap?.let { return it }

        val size = 128
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#09090B")
            style = Paint.Style.FILL
        }
        val radius = 28f
        canvas.drawRoundRect(RectF(0f, 0f, size.toFloat(), size.toFloat()), radius, radius, bgPaint)

        val trianglePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.FILL
        }
        val path = Path().apply {
            moveTo(size * 0.50f, size * 0.24f)
            lineTo(size * 0.78f, size * 0.74f)
            lineTo(size * 0.22f, size * 0.74f)
            close()
        }
        canvas.drawPath(path, trianglePaint)

        cachedWebLogoBitmap = bmp
        return bmp
    }

    fun getTypeLabel(type: String): String {
        return when (type.lowercase()) {
            "new_message" -> "Chat Tim Masuk"
            "new_internal_note" -> "Chat Tim Masuk"
            "status_changed", "ticket_resolved", "ticket_closed", "ticket_reopened" -> "Perubahan Status Tiket"
            "ticket_updated" -> "Pembaruan Detail Tiket"
            "ticket_assigned", "ticket_created" -> "Tugas Tiket Baru"
            "sla_warning", "sla_breach" -> "Peringatan SLA"
            else -> "Notifikasi HelpDesk"
        }
    }

    fun formatStatusName(status: String): String {
        return when (status.lowercase()) {
            "open" -> "Open"
            "assigned" -> "Ditugaskan"
            "accepted" -> "Diterima Teknisi"
            "on_site" -> "Tiba di Lokasi (On-Site)"
            "in_progress" -> "Sedang Dikerjakan (In-Progress)"
            "resolved" -> "Selesai (Resolved)"
            "closed" -> "Ditutup (Closed)"
            "pending" -> "Pending"
            else -> status.uppercase()
        }
    }

    fun buildTargetIntent(context: Context, item: NotificationItem, forceTab: Int? = null): Intent {
        val isChatType = item.type == "new_message" || item.type == "new_internal_note"
        val initialTab = forceTab ?: if (isChatType) 1 else 0

        return if (!item.ticketId.isNullOrBlank()) {
            Intent(context, TicketDetailActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(TicketDetailActivity.EXTRA_TICKET_ID, item.ticketId)
                putExtra(TicketDetailActivity.EXTRA_TICKET_NUMBER, item.ticketNumber)
                putExtra(TicketDetailActivity.EXTRA_TITLE, item.ticketTitle.ifBlank { item.title })
                putExtra(TicketDetailActivity.EXTRA_STATUS, item.ticketStatus.ifBlank { "assigned" })
                putExtra(TicketDetailActivity.EXTRA_PRIORITY, item.ticketPriority.ifBlank { "medium" })
                putExtra(TicketDetailActivity.EXTRA_TYPE, item.ticketType ?: "")
                putExtra(TicketDetailActivity.EXTRA_REPORTER_NAME, item.reporterName ?: "")
                putExtra(TicketDetailActivity.EXTRA_REPORTER_PHONE, item.reporterPhone ?: "")
                putExtra(TicketDetailActivity.EXTRA_REPORTER_ADDRESS, item.reporterAddress ?: "")
                putExtra(TicketDetailActivity.EXTRA_REPORTER_MAP_URL, item.reporterMapUrl ?: "")
                putExtra(TicketDetailActivity.EXTRA_DESCRIPTION, item.ticketDescription ?: "")
                putExtra(TicketDetailActivity.EXTRA_INITIAL_TAB, initialTab)
            }
        } else {
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        }
    }

    /**
     * Immediately dispatches a notification to Status Bar + Notification Drawer + System Heads-Up Pop-up
     * AND saves it locally + broadcasts to MainActivity for the In-App Heads-Up Banner.
     */
    fun dispatchCustomNotification(
        context: Context,
        session: SessionManager,
        item: NotificationItem
    ) {
        val fp = getEventFingerprint(item)
        session.markNotificationAlerted(item.id)
        session.markNotificationAlerted(fp)
        session.saveLocalNotification(item)
        showRealtimeNotification(context, item)

        val mergedList = mergeNotifications(
            latestCachedPayload?.notifications ?: emptyList(),
            session.getLocalNotifications()
        )
        val unreadCount = mergedList.count { !it.isRead }
        val payload = NotificationsPayload(mergedList, unreadCount)
        latestCachedPayload = payload

        sendSyncBroadcast(context, payload, item)
    }

    /**
     * Synchronizes notifications from server (/api/notifications) with fallback diffing,
     * strictly preventing duplicate notifications and self-triggered notifications.
     */
    suspend fun syncAndDispatchNotifications(
        context: Context,
        session: SessionManager,
        providedTickets: List<TicketItem>? = null
    ): NotificationsPayload? = syncMutex.withLock {
        val token = session.token
        if (token.isNullOrBlank()) return null

        var newestTriggered: NotificationItem? = null
        val newlyDetectedItems = mutableListOf<NotificationItem>()
        val filteredServerList = mutableListOf<NotificationItem>()

        // --- ENGINE 1: Server /api/notifications (Primary Authoritative Source) ---
        val serverResult = ApiClient.getNotifications(session.serverUrl, token)
        val serverPayload = serverResult.getOrNull()

        if (serverPayload != null) {
            if (!session.isNotifBaselineInitialized) {
                for (n in serverPayload.notifications) {
                    val fp = getEventFingerprint(n)
                    session.markNotificationAlerted(n.id)
                    session.markNotificationAlerted(fp)
                    if (!isSelfGeneratedNotification(session, n)) {
                        filteredServerList.add(n)
                    }
                }
                session.isNotifBaselineInitialized = true
            } else {
                // Process in chronological order (oldest to newest)
                val chronological = serverPayload.notifications.reversed()
                for (item in chronological) {
                    val fp = getEventFingerprint(item)
                    if (isSelfGeneratedNotification(session, item)) {
                        session.markNotificationAlerted(item.id)
                        session.markNotificationAlerted(fp)
                        if (!item.isRead) {
                            ApiClient.markNotificationRead(session.serverUrl, token, item.id)
                        }
                        continue
                    }

                    filteredServerList.add(0, item)

                    val alreadyAlerted = session.hasAlertedNotification(item.id) ||
                        session.hasAlertedNotification(fp)
                    session.markNotificationAlerted(item.id)
                    session.markNotificationAlerted(fp)

                    if (!item.isRead && !alreadyAlerted) {
                        newlyDetectedItems.add(item)
                    }
                }
            }
        }

        // --- ENGINE 2: Ticket Snapshot & Fallback Diff Engine ---
        val tickets = providedTickets ?: ApiClient.getTickets(session.serverUrl, token).getOrNull()
        if (tickets != null) {
            val activeCount = tickets.count { t ->
                val s = t.status.lowercase()
                s != "resolved" && s != "closed" && s != "cancelled"
            }
            session.activeTicketsCount = activeCount

            val nowStr = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
            val oldSnapRoot = try {
                JSONObject(session.ticketsSnapshotJson)
            } catch (_: Exception) {
                JSONObject()
            }
            val newSnapRoot = JSONObject()
            val wasSnapInit = session.isTicketsSnapshotInitialized

            for (t in tickets) {
                val snapObj = JSONObject().apply {
                    put("status", t.status)
                    put("title", t.title)
                    put("priority", t.priority)
                    put("address", t.reporterAddress ?: "")
                    put("phone", t.reporterPhone ?: "")
                    put("mapUrl", t.reporterMapUrl ?: "")
                    put("desc", t.description ?: "")
                    put("updatedAt", t.updatedAt)
                }
                newSnapRoot.put(t.id, snapObj)

                if (wasSnapInit) {
                    val oldObj = oldSnapRoot.optJSONObject(t.id)
                    if (oldObj == null) {
                        // Only emit fallback assignment alert if Engine 1 is offline or hasn't alerted this ticket
                        val notifId = "assign_${t.id}_${t.updatedAt}"
                        val item = NotificationItem(
                            id = notifId,
                            type = "ticket_assigned",
                            title = "Penugasan Tiket Baru #${t.ticketNumber}",
                            message = "Tiket \"${t.title}\" ditugaskan ke Anda" +
                                (if (!t.reporterName.isNullOrBlank()) " • Pelapor: ${t.reporterName}" else ""),
                            ticketId = t.id,
                            ticketNumber = t.ticketNumber,
                            ticketTitle = t.title,
                            ticketStatus = t.status,
                            ticketPriority = t.priority,
                            ticketType = t.ticketType,
                            reporterName = t.reporterName,
                            reporterPhone = t.reporterPhone,
                            reporterAddress = t.reporterAddress,
                            reporterMapUrl = t.reporterMapUrl,
                            ticketDescription = t.description,
                            isRead = false,
                            createdAt = nowStr
                        )
                        val fp = getEventFingerprint(item)
                        if (serverPayload == null && !session.hasAlertedNotification(notifId) && !session.hasAlertedNotification(fp)) {
                            session.markNotificationAlerted(notifId)
                            session.markNotificationAlerted(fp)
                            session.saveLocalNotification(item)
                            newlyDetectedItems.add(item)
                        } else {
                            session.markNotificationAlerted(notifId)
                            session.markNotificationAlerted(fp)
                        }
                    } else {
                        val oldStatus = oldObj.optString("status", t.status)
                        val oldTitle = oldObj.optString("title", t.title)
                        val oldPriority = oldObj.optString("priority", t.priority)
                        val oldAddress = oldObj.optString("address", t.reporterAddress ?: "")
                        val oldPhone = oldObj.optString("phone", t.reporterPhone ?: "")
                        val oldMapUrl = oldObj.optString("mapUrl", t.reporterMapUrl ?: "")
                        val oldDesc = oldObj.optString("desc", t.description ?: "")

                        if (!oldStatus.equals(t.status, ignoreCase = true)) {
                            val notifId = "status_${t.id}_${t.status}_${t.updatedAt}"
                            val statusLabel = formatStatusName(t.status)
                            val item = NotificationItem(
                                id = notifId,
                                type = "status_changed",
                                title = "Status Tiket #${t.ticketNumber}: $statusLabel",
                                message = "Status tiket \"${t.title}\" diperbarui menjadi $statusLabel",
                                ticketId = t.id,
                                ticketNumber = t.ticketNumber,
                                ticketTitle = t.title,
                                ticketStatus = t.status,
                                ticketPriority = t.priority,
                                ticketType = t.ticketType,
                                reporterName = t.reporterName,
                                reporterPhone = t.reporterPhone,
                                reporterAddress = t.reporterAddress,
                                reporterMapUrl = t.reporterMapUrl,
                                ticketDescription = t.description,
                                isRead = false,
                                createdAt = nowStr
                            )
                            val fp = getEventFingerprint(item)
                            val isSelfStatus = isRecentSelfStatusChange(t.id, t.status)
                            if (
                                serverPayload == null &&
                                !isSelfStatus &&
                                !session.hasAlertedNotification(notifId) &&
                                !session.hasAlertedNotification(fp)
                            ) {
                                session.markNotificationAlerted(notifId)
                                session.markNotificationAlerted(fp)
                                session.saveLocalNotification(item)
                                newlyDetectedItems.add(item)
                            } else {
                                session.markNotificationAlerted(notifId)
                                session.markNotificationAlerted(fp)
                            }
                        } else if (
                            oldTitle != t.title ||
                            oldPriority != t.priority ||
                            oldAddress != (t.reporterAddress ?: "") ||
                            oldPhone != (t.reporterPhone ?: "") ||
                            oldMapUrl != (t.reporterMapUrl ?: "") ||
                            oldDesc != (t.description ?: "")
                        ) {
                            val notifId = "detail_${t.id}_${t.updatedAt}"
                            val changedParts = mutableListOf<String>()
                            if (oldTitle != t.title) changedParts.add("Judul")
                            if (oldPriority != t.priority) changedParts.add("Prioritas")
                            if (oldAddress != (t.reporterAddress ?: "")) changedParts.add("Alamat")
                            if (oldPhone != (t.reporterPhone ?: "")) changedParts.add("No. Telepon")
                            if (oldMapUrl != (t.reporterMapUrl ?: "")) changedParts.add("Titik Maps")
                            if (oldDesc != (t.description ?: "")) changedParts.add("Deskripsi")

                            val detailSummary = if (changedParts.isNotEmpty()) {
                                "Perubahan pada ${changedParts.joinToString(", ")}"
                            } else {
                                "Informasi detail tiket diperbarui"
                            }

                            val item = NotificationItem(
                                id = notifId,
                                type = "ticket_updated",
                                title = "Pembaruan Detail Tiket #${t.ticketNumber}",
                                message = "$detailSummary pada tiket \"${t.title}\"",
                                ticketId = t.id,
                                ticketNumber = t.ticketNumber,
                                ticketTitle = t.title,
                                ticketStatus = t.status,
                                ticketPriority = t.priority,
                                ticketType = t.ticketType,
                                reporterName = t.reporterName,
                                reporterPhone = t.reporterPhone,
                                reporterAddress = t.reporterAddress,
                                reporterMapUrl = t.reporterMapUrl,
                                ticketDescription = t.description,
                                isRead = false,
                                createdAt = nowStr
                            )
                            val fp = getEventFingerprint(item)
                            val alreadyHasServerDetailForTicket = newlyDetectedItems.any {
                                it.ticketId == t.id && getCanonicalCategory(it) == "detail"
                            }
                            if (
                                !alreadyHasServerDetailForTicket &&
                                !session.hasAlertedNotification(notifId) &&
                                !session.hasAlertedNotification(fp)
                            ) {
                                session.markNotificationAlerted(notifId)
                                session.markNotificationAlerted(fp)
                                session.saveLocalNotification(item)
                                newlyDetectedItems.add(item)
                            } else {
                                session.markNotificationAlerted(notifId)
                                session.markNotificationAlerted(fp)
                            }
                        }
                    }
                }
            }

            session.ticketsSnapshotJson = newSnapRoot.toString()
            session.isTicketsSnapshotInitialized = true

            // Only poll direct ticket messages as a fallback if /api/notifications (serverPayload) is unavailable
            if (serverPayload == null) {
                val activeTicketsToWatch = tickets.filter {
                    val s = it.status.lowercase()
                    s != "closed" && s != "cancelled"
                }.take(5)

                for (t in activeTicketsToWatch) {
                    val msgs = ApiClient.getTicketMessages(session.serverUrl, token, t.id).getOrNull() ?: continue
                    val wasTicketMsgInit = session.isTicketMessageBaselineInitialized(t.id)

                    if (!wasTicketMsgInit) {
                        msgs.forEach { m -> session.markMessageSeen(m.id) }
                        session.markTicketMessageBaselineInitialized(t.id)
                    } else {
                        for (m in msgs) {
                            if (!session.hasSeenMessage(m.id)) {
                                session.markMessageSeen(m.id)
                                if (m.content.startsWith("[Mobile] Status tiket diperbarui")) continue

                                val isFromMe = (!session.userId.isNullOrBlank() && m.authorId == session.userId) ||
                                    (!session.userName.isNullOrBlank() && m.authorName.equals(session.userName, ignoreCase = true)) ||
                                    isRecentSelfSentChat(t.id, m.content)
                                if (isFromMe) continue

                                val notifId = "chat_${m.id}"
                                val snippet = if (m.content.length > 90) m.content.take(90) + "..." else m.content
                                val item = NotificationItem(
                                    id = notifId,
                                    type = if (m.type == "internal_note") "new_internal_note" else "new_message",
                                    title = "Chat Tim #${t.ticketNumber} - ${m.authorName}",
                                    message = "${m.authorName}: \"$snippet\" (${t.title})",
                                    ticketId = t.id,
                                    ticketNumber = t.ticketNumber,
                                    ticketTitle = t.title,
                                    ticketStatus = t.status,
                                    ticketPriority = t.priority,
                                    ticketType = t.ticketType,
                                    reporterName = t.reporterName,
                                    reporterPhone = t.reporterPhone,
                                    reporterAddress = t.reporterAddress,
                                    reporterMapUrl = t.reporterMapUrl,
                                    ticketDescription = t.description,
                                    isRead = false,
                                    createdAt = nowStr
                                )
                                val fp = getEventFingerprint(item)
                                if (!session.hasAlertedNotification(notifId) && !session.hasAlertedNotification(fp)) {
                                    session.markNotificationAlerted(notifId)
                                    session.markNotificationAlerted(fp)
                                    session.saveLocalNotification(item)
                                    newlyDetectedItems.add(item)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Deduplicate newly detected items by canonical fingerprint within the same cycle
        val distinctNew = newlyDetectedItems.distinctBy { getEventFingerprint(it) }
        for (item in distinctNew) {
            if (!shouldSuppressDuplicateDispatch(item)) {
                showRealtimeNotification(context, item)
                newestTriggered = item
            }
        }

        val mergedNotifications = mergeNotifications(
            if (serverPayload != null) filteredServerList else emptyList(),
            session.getLocalNotifications(),
            session
        )
        val totalUnread = mergedNotifications.count { !it.isRead }
        val finalPayload = NotificationsPayload(mergedNotifications, totalUnread)
        latestCachedPayload = finalPayload

        sendSyncBroadcast(context, finalPayload, newestTriggered)
        return finalPayload
    }

    @Synchronized
    private fun shouldSuppressDuplicateDispatch(item: NotificationItem): Boolean {
        val now = System.currentTimeMillis()
        recentDispatchedFingerprints.entries.removeAll { now - it.value > 45_000L }
        val fp = getEventFingerprint(item)
        val prev = recentDispatchedFingerprints[fp]
        if (prev != null && now - prev < 45_000L) {
            return true
        }
        recentDispatchedFingerprints[fp] = now
        return false
    }

    private fun mergeNotifications(
        serverList: List<NotificationItem>,
        localList: List<NotificationItem>,
        session: SessionManager? = null
    ): List<NotificationItem> {
        val combined = ArrayList<NotificationItem>()
        val seenIds = HashSet<String>()
        val seenFingerprints = HashSet<String>()

        // Prefer authoritative server notifications first so there are never duplicate local + server rows
        for (item in serverList) {
            if (session != null && isSelfGeneratedNotification(session, item)) continue
            val fp = getEventFingerprint(item)
            if (seenIds.add(item.id) && seenFingerprints.add(fp)) {
                combined.add(item)
            }
        }
        for (item in localList) {
            if (session != null && isSelfGeneratedNotification(session, item)) continue
            val fp = getEventFingerprint(item)
            if (seenIds.add(item.id) && seenFingerprints.add(fp)) {
                combined.add(item)
            }
        }
        return combined.take(40)
    }

    private fun sendSyncBroadcast(
        context: Context,
        payload: NotificationsPayload,
        newestTriggered: NotificationItem?
    ) {
        val broadcast = Intent(ACTION_NOTIFICATION_SYNCED).apply {
            setPackage(context.packageName)
            putExtra("unreadCount", payload.unreadCount)
            if (newestTriggered != null) {
                putExtra("newNotifId", newestTriggered.id)
                putExtra("newNotifType", newestTriggered.type)
                putExtra("newNotifTitle", newestTriggered.title)
                putExtra("newNotifMessage", newestTriggered.message)
                putExtra("newNotifTicketId", newestTriggered.ticketId ?: "")
            }
        }
        context.sendBroadcast(broadcast)
    }

    /**
     * Posts an individual Status Bar + Notification Drawer + Heads-Up Pop-up notification.
     * Note: Does NOT set groupSummary so Android OEM ROMs never collapse or mute the Heads-Up peek banner.
     */
    fun showRealtimeNotification(context: Context, item: NotificationItem) {
        if (!areSystemNotificationsEnabled(context)) {
            return
        }

        ensureAlertChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val slotKey = "${getCanonicalCategory(item)}_${item.ticketId ?: item.id}"
        val rawHash = kotlin.math.abs(slotKey.hashCode())
        val notifId = if (rawHash < 2000) rawHash + 3000 else rawHash
        val immFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

        val mainIntent = buildTargetIntent(context, item, forceTab = null)
        val mainPendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or immFlag
        )

        val categoryLabel = getTypeLabel(item.type)
        val largeIcon = getWebLogoBitmap(context)
        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, CHANNEL_ALERTS_ID)
            .setSmallIcon(R.drawable.ic_stat_helpdesk) // Web-matched triangle status bar icon
            .setLargeIcon(largeIcon) // Web-matched black & white triangle badge in drawer/pop-up
            .setColor(Color.parseColor("#09090B"))
            .setSubText(categoryLabel)
            .setContentTitle(item.title)
            .setContentText(item.message)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .setBigContentTitle(item.title)
                    .bigText(item.message)
                    .setSummaryText(categoryLabel)
            )
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0L, 300L, 140L, 300L))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(mainPendingIntent)

        // Add direct action buttons in Notification Drawer & Heads-Up Pop-up
        if (!item.ticketId.isNullOrBlank()) {
            val detailIntent = buildTargetIntent(context, item, forceTab = 0)
            val detailPending = PendingIntent.getActivity(
                context,
                notifId + 1,
                detailIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or immFlag
            )

            val chatIntent = buildTargetIntent(context, item, forceTab = 1)
            val chatPending = PendingIntent.getActivity(
                context,
                notifId + 2,
                chatIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or immFlag
            )

            builder.addAction(0, "Detail Tiket", detailPending)
            builder.addAction(0, "Buka Chat Tim", chatPending)
        }

        manager.notify(notifId, builder.build())
    }
}
