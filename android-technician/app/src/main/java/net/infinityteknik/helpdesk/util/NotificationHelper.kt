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
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.NotificationItem
import net.infinityteknik.helpdesk.data.NotificationsPayload
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.ui.MainActivity
import net.infinityteknik.helpdesk.ui.TicketDetailActivity

/**
 * Handles:
 * 1. Status Bar Notification (monochrome Web triangle icon R.drawable.ic_stat_helpdesk)
 * 2. Notification Drawer / Panel Notifikasi (expandable BigTextStyle + quick action buttons)
 * 3. Heads-Up Notification / Pop-up (IMPORTANCE_HIGH channel with sound + vibration + banner pop-up)
 * 4. Real-time synchronization & deduplication across Background Service and Foreground UI
 */
object NotificationHelper {

    const val CHANNEL_ALERTS_ID = "helpdesk_realtime_alerts_v2"
    const val ACTION_NOTIFICATION_SYNCED = "net.infinityteknik.helpdesk.NOTIFICATION_SYNCED"

    private const val GROUP_KEY_ALERTS = "net.infinityteknik.helpdesk.GROUP_ALERTS"
    private const val SUMMARY_ID = 9000

    private var cachedWebLogoBitmap: Bitmap? = null
    private val syncMutex = Mutex()

    @Volatile
    var latestCachedPayload: NotificationsPayload? = null
        private set

    fun ensureAlertChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val existing = manager.getNotificationChannel(CHANNEL_ALERTS_ID)
            if (existing != null) return

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
                vibrationPattern = longArrayOf(0L, 250L, 120L, 250L)
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
    fun getWebLogoBitmap(context: Context): Bitmap {
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
            "new_internal_note" -> "Catatan Internal Tim"
            "status_changed" -> "Perubahan Status Tiket"
            "ticket_updated" -> "Pembaruan Detail Tiket"
            "ticket_assigned", "ticket_created" -> "Tugas Tiket Baru"
            "sla_warning", "sla_breach" -> "Peringatan SLA"
            else -> "Notifikasi HelpDesk"
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
     * Polls /api/notifications, fires Status Bar + Drawer + Heads-Up notifications for any new unread
     * item, and broadcasts to the active UI so the In-App Bell Badge and In-App Heads-Up Banner update.
     */
    suspend fun syncAndDispatchNotifications(
        context: Context,
        session: SessionManager
    ): NotificationsPayload? = syncMutex.withLock {
        val token = session.token
        if (token.isNullOrBlank()) return null

        val result = ApiClient.getNotifications(session.serverUrl, token)
        val payload = result.getOrNull() ?: return latestCachedPayload
        latestCachedPayload = payload

        var newestTriggered: NotificationItem? = null

        if (!session.isNotifBaselineInitialized) {
            // Seed existing notifications so old history doesn't flood on first install/login,
            // but if the top item is unread, still surface it once if desired.
            payload.notifications.forEach { n ->
                session.markNotificationAlerted(n.id)
            }
            session.isNotifBaselineInitialized = true
        } else {
            // Process in chronological order (oldest new to newest new)
            val newUnread = payload.notifications
                .filter { !it.isRead && !session.hasAlertedNotification(it.id) }
                .reversed()

            for (item in newUnread) {
                session.markNotificationAlerted(item.id)
                showRealtimeNotification(context, item)
                newestTriggered = item
            }
        }

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

        return payload
    }

    /**
     * Posts a Status Bar + Notification Drawer + Heads-Up Pop-up notification.
     */
    fun showRealtimeNotification(context: Context, item: NotificationItem) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
        }

        ensureAlertChannel(context)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val notifId = item.id.hashCode().let { if (it == SUMMARY_ID || it == 1001) it + 7 else it }
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
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(longArrayOf(0L, 250L, 120L, 250L))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(mainPendingIntent)
            .setGroup(GROUP_KEY_ALERTS)

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

        // Group summary notification for Notification Drawer when multiple alerts stack
        val summaryIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val summaryPending = PendingIntent.getActivity(
            context,
            SUMMARY_ID,
            summaryIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or immFlag
        )

        val summaryNotification = NotificationCompat.Builder(context, CHANNEL_ALERTS_ID)
            .setSmallIcon(R.drawable.ic_stat_helpdesk)
            .setColor(Color.parseColor("#09090B"))
            .setContentTitle("HelpDesk Teknisi")
            .setContentText("Notifikasi tiket dan chat tim terbaru")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setGroup(GROUP_KEY_ALERTS)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .setContentIntent(summaryPending)
            .build()

        manager.notify(SUMMARY_ID, summaryNotification)
    }
}
