package net.infinityteknik.helpdesk.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.pm.PackageManager
import android.Manifest
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import net.infinityteknik.helpdesk.util.LocationPolicy
import java.util.concurrent.atomic.AtomicReference
import android.graphics.Color
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.LocationPayload
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.ui.MainActivity
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.OfflineSyncManager


/**
 * Thermal-Safe 1-Minute Duty-Cycled GPS Service + Real-Time Notification Listener.
 * - GPS hardware wakes up once every 60 seconds for max 7s, then powers down for ~53s to limit continuous GPS use.
 * - Lightweight HTTP notification poller checks every 15 seconds for new Team Chat messages, ticket status changes,
 *   and ticket detail updates, triggering Status Bar + Notification Drawer + Heads-Up Pop-up notifications.
 */
class LocationTrackingService : Service() {

    companion object {
        const val CHANNEL_ID = "helpdesk_location_tracking"
        const val NOTIFICATION_ID = 1001
        const val ACTION_LOCATION_UPDATED = "net.infinityteknik.helpdesk.LOCATION_UPDATED"
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val ACTION_LOGOUT = "ACTION_LOGOUT"
        const val ACTION_FORCE_PING = "ACTION_FORCE_PING"

        private const val PING_INTERVAL_MS = 300_000L // 5 minutes between GPS transmissions (optimal & battery saving)
        private const val GPS_ACQUIRE_TIMEOUT_MS = 8_000L // Max 8s GPS burst, then hardware sleeps
        private const val NOTIF_POLL_INTERVAL_MS = 15_000L // Notification polling interval
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val locationMutex = Mutex()
    private var tickerJob: Job? = null
    private var notifJob: Job? = null
    private lateinit var locationManager: LocationManager
    private lateinit var session: SessionManager
    private var activeBurstListener: LocationListener? = null

    override fun onCreate() {
        super.onCreate()
        session = SessionManager(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
        NotificationHelper.ensureAlertChannel(this)
    }

    private fun canTrackNow(): Boolean {
        val permitted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return LocationPolicy.canTrack(session.isLoggedIn, session.userRole, session.activeTicketsCount, permitted,
            LocationManagerCompat.isLocationEnabled(locationManager))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        if (!session.isLoggedIn || action == ACTION_LOGOUT) {
            session.isDutyActive = false
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }
        if (!canTrackNow()) {
            session.isDutyActive = false
            stopGpsTicker()
            updateForegroundNotification("Siaga tugas · GPS tidak aktif")
            ensureNotificationPoller()
        } else {
            ensureForegroundAndTicker()
            if (action == ACTION_FORCE_PING) serviceScope.launch { acquireAndSendLocationOnce() }
        }
        return START_STICKY
    }
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pelacakan GPS Teknisi (Hemat Daya & Optimal)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Sinkronisasi lokasi teknisi setiap 5 menit saat ada tiket aktif (Mode Hemat Baterai & Optimal)"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("HelpDesk Teknisi • Aktif")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_helpdesk) // Shared HelpDesk brand
            .setLargeIcon(NotificationHelper.getWebLogoBitmap(this))
            .setColor(Color.parseColor("#09090B"))
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateForegroundNotification(text: String): Boolean {
        val notification = buildNotification(text)
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val types = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or
                    if (canTrackNow()) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
                startForeground(NOTIFICATION_ID, notification, types)
            } else startForeground(NOTIFICATION_ID, notification)
            true
        } catch (_: RuntimeException) {
            session.isDutyActive = false
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                else startForeground(NOTIFICATION_ID, notification)
                false
            } catch (_: RuntimeException) {
                stopSelf()
                false
            }
        }
    }
    private fun ensureNotificationPoller() {
        if (notifJob?.isActive == true) return
        notifJob = serviceScope.launch {
            while (isActive) {
                if (session.token.isNullOrBlank()) {
                    stopTracking()
                    stopSelf()
                    break
                }
                try {
                    val payload = NotificationHelper.syncAndDispatchNotifications(this@LocationTrackingService, session)
                    if (OfflineSyncManager.isOnline(this@LocationTrackingService) &&
                        OfflineSyncManager.getTotalPendingSyncCount(this@LocationTrackingService) > 0
                    ) {
                        OfflineSyncManager.flushAllPendingQueues(this@LocationTrackingService, session)
                    }
                    if (payload != null) {
                        if (canTrackNow()) {
                            if (!session.isDutyActive || tickerJob?.isActive != true) {
                                session.isDutyActive = true
                                withContext(Dispatchers.Main) {
                                    ensureForegroundAndTicker()
                                }
                            }
                        } else {
                            if (session.isDutyActive || tickerJob?.isActive == true) {
                                session.isDutyActive = false
                                withContext(Dispatchers.Main) {
                                    stopGpsTicker()
                                    updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (GPS Nonaktif)")
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(NOTIF_POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopGpsTicker() {
        val wasTracking = tickerJob != null
        tickerJob?.cancel()
        tickerJob = null
        releaseBurstListener()
        if (wasTracking) serviceScope.launch {
            session.token?.let { ApiClient.stopLocation(session.serverUrl, it) }
        }
    }
    private fun ensureForegroundAndTicker() {
        if (!canTrackNow()) {
            session.isDutyActive = false
            stopGpsTicker()
            updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (GPS Nonaktif)")
            ensureNotificationPoller()
            return
        }

        if (!updateForegroundNotification("GPS aktif (5 menit) · " + session.activeTicketsCount + " tiket")) return
        session.isDutyActive = true
        ensureNotificationPoller()

        if (tickerJob?.isActive == true) return

        tickerJob = serviceScope.launch {
            while (isActive) {
                if (!canTrackNow()) {
                    session.isDutyActive = false
                    stopGpsTicker()
                    updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (GPS Nonaktif)")
                    break
                }

                acquireAndSendLocationOnce()
                delay(PING_INTERVAL_MS)
            }
        }
    }

    /**
     * Wakes up location providers briefly (up to 7 seconds), captures a single fresh fix,
     * immediately unregisters the listener so the GPS hardware turns OFF, and uploads the fix.
     */
    private suspend fun acquireAndSendLocationOnce() {
        if (!canTrackNow() || !locationMutex.tryLock()) return
        try { acquireFixAndSend() } finally { locationMutex.unlock() }
    }

    @SuppressLint("MissingPermission")
    private suspend fun acquireFixAndSend() {
        if (!canTrackNow()) return
        val captured = AtomicReference<Location?>(null)
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                val previous = captured.get()
                if (previous == null || location.accuracy < previous.accuracy) captured.set(location)
            }
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }
        try {
            withContext(Dispatchers.Main) {
                releaseBurstListener()
                activeBurstListener = listener
                listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).forEach { provider ->
                    if (locationManager.isProviderEnabled(provider))
                        locationManager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
                }
            }
            var waited = 0L
            while (waited < GPS_ACQUIRE_TIMEOUT_MS && canTrackNow()) {
                val fix = captured.get()
                if (fix != null && fix.accuracy <= 25f) break
                delay(500L)
                waited += 500L
            }
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (_: SecurityException) {
            session.isDutyActive = false
        } catch (_: IllegalArgumentException) {
            // A location provider may disappear while the device changes location settings.
        } finally {
            withContext(NonCancellable + Dispatchers.Main) { releaseBurstListener() }
        }
        val fix = captured.get() ?: getBestLastKnownLocation()
        if (fix != null && canTrackNow()) dispatchLocationUpdate(fix)
    }
    @SuppressLint("MissingPermission")
    private fun getBestLastKnownLocation(): Location? {
        return try {
            val gps = if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) else null
            val net = if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) else null
            val passive = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)

            listOfNotNull(gps, net, passive).filter { LocationPolicy.isFresh(it.time) && it.hasAccuracy() && it.accuracy <= LocationPolicy.MAX_ACCURACY_METERS }.maxByOrNull { it.time }
        } catch (e: Exception) {
            null
        }
    }

    private fun releaseBurstListener() {
        val listener = activeBurstListener ?: return
        try {
            locationManager.removeUpdates(listener)
        } catch (e: Exception) {}
        activeBurstListener = null
    }

    private fun stopTracking() {
        tickerJob?.cancel()
        tickerJob = null
        notifJob?.cancel()
        notifJob = null
        try {
            releaseBurstListener()
        } catch (e: Exception) {}

        serviceScope.launch {
            val token = session.token
            if (!token.isNullOrBlank()) {
                ApiClient.stopLocation(session.serverUrl, token)
            }
        }
    }

    private suspend fun dispatchLocationUpdate(loc: Location) {
        if (!canTrackNow() || !session.isDutyActive || !LocationPolicy.isFresh(loc.time) ||
            !LocationPolicy.hasCoordinates(loc.latitude, loc.longitude) || !loc.hasAccuracy() || loc.accuracy > LocationPolicy.MAX_ACCURACY_METERS) return
        // GT-05: Filter out inaccurate GPS jumps (>50m accuracy when a recent valid fix exists)
        if (!OfflineSyncManager.isLocationValid(
                loc,
                session.lastLatitude,
                session.lastLongitude,
                session.lastUpdateTime
            )
        ) {
            return
        }

        val now = System.currentTimeMillis()
        val batteryLevel = getBatteryLevel()

        session.lastLatitude = loc.latitude
        session.lastLongitude = loc.longitude
        session.lastAccuracy = loc.accuracy
        session.lastUpdateTime = loc.time

        val accuracyStr = if (loc.hasAccuracy()) "±${loc.accuracy.toInt()}m" else ""
        val speedKmh = if (loc.hasSpeed()) loc.speed * 3.6f else 0f
        val speedStr = if (speedKmh > 1f) " • ${speedKmh.toInt()} km/j" else ""
        val pendingGps = OfflineSyncManager.getBufferedGpsPoints(this).size
        val bufferStr = if (pendingGps > 0) " • Buffer: $pendingGps" else ""

        withContext(Dispatchers.Main) {
            val notifManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notifManager.notify(
                NOTIFICATION_ID,
                buildNotification("GPS 1 mnt • $accuracyStr$speedStr • Baterai: $batteryLevel%$bufferStr")
            )

            val broadcast = Intent(ACTION_LOCATION_UPDATED).apply {
                setPackage(packageName)
                putExtra("lat", loc.latitude)
                putExtra("lng", loc.longitude)
                putExtra("acc", loc.accuracy)
                putExtra("speed", speedKmh)
                putExtra("battery", batteryLevel)
                putExtra("time", loc.time)
            }
            sendBroadcast(broadcast)
        }

        val token = session.token
        if (!token.isNullOrBlank() && session.isDutyActive) {
            val activeTicketId = OfflineSyncManager.getCachedTickets(this)
                .firstOrNull {
                    val s = it.status.lowercase()
                    s == "on_site" || s == "in_progress" || s == "accepted" || s == "assigned"
                }?.id

            val payload = LocationPayload(
                latitude = loc.latitude,
                longitude = loc.longitude,
                accuracy = if (loc.hasAccuracy()) loc.accuracy else null,
                speed = if (loc.hasSpeed()) speedKmh else null,
                heading = if (loc.hasBearing()) loc.bearing else null,
                battery = batteryLevel,
                activeTicketId = activeTicketId,
                deviceTime = loc.time
            )
            OfflineSyncManager.sendOrBufferLocation(this, session, payload)
        }
    }

    private fun getBatteryLevel(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        return bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
    }

    override fun onDestroy() {
        stopTracking()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
