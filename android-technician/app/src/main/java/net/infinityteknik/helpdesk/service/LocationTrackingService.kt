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
import net.infinityteknik.helpdesk.util.TrackingScheduleManager

/**
 * Thermal-Safe 1-Minute Duty-Cycled GPS Service + Real-Time Notification Listener.
 * - GPS hardware wakes up once every 60 seconds for max 7s, then powers down for ~53s so the phone never overheats.
 * - Lightweight HTTP notification poller checks every 6 seconds for new Team Chat messages, ticket status changes,
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

        private const val PING_INTERVAL_MS = 60_000L // Strictly 1 minute between GPS transmissions
        private const val GPS_ACQUIRE_TIMEOUT_MS = 7_000L // Max 7s GPS burst, then hardware sleeps
        private const val NOTIF_POLL_INTERVAL_MS = 6_000L // 6s real-time notification check
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        if (action == ACTION_LOGOUT) {
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        if (action == ACTION_STOP) {
            if (TrackingScheduleManager.isTrackingMandatory(session.activeTicketsCount)) {
                session.isDutyActive = true
                ensureForegroundAndTicker()
                return START_STICKY
            }
            session.isDutyActive = false
            stopGpsTicker()
            updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (Notifikasi Aktif)")
            ensureNotificationPoller()
            return START_STICKY
        }

        if (session.isDutyActive) {
            ensureForegroundAndTicker()
        } else {
            stopGpsTicker()
            updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (Notifikasi Aktif)")
            ensureNotificationPoller()
        }

        if (action == ACTION_FORCE_PING && session.isDutyActive) {
            serviceScope.launch {
                acquireAndSendLocationOnce()
            }
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pelacakan GPS Teknisi (Hemat Daya)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Sinkronisasi lokasi teknisi setiap 1 menit (Mode Hemat Baterai & Anti Panas)"
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
            .setSmallIcon(R.drawable.ic_stat_helpdesk) // Web-matched triangle status bar icon
            .setLargeIcon(NotificationHelper.getWebLogoBitmap(this))
            .setColor(Color.parseColor("#09090B"))
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateForegroundNotification(text: String) {
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
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
                    if (payload != null) {
                        if (TrackingScheduleManager.isTrackingMandatory(session.activeTicketsCount)) {
                            if (!session.isDutyActive) {
                                session.isDutyActive = true
                                withContext(Dispatchers.Main) {
                                    ensureForegroundAndTicker()
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
        tickerJob?.cancel()
        tickerJob = null
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

    private fun ensureForegroundAndTicker() {
        updateForegroundNotification("GPS 1 mnt (Hemat Daya) • Notifikasi Real-time Aktif")
        ensureNotificationPoller()

        if (tickerJob?.isActive == true) return

        tickerJob = serviceScope.launch {
            while (isActive) {
                if (TrackingScheduleManager.shouldAutoTurnOff(session.activeTicketsCount)) {
                    session.isDutyActive = false
                    stopGpsTicker()
                    updateForegroundNotification("HelpDesk Teknisi • Siaga Tugas (Notifikasi Aktif)")
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
    @SuppressLint("MissingPermission")
    private suspend fun acquireAndSendLocationOnce() {
        var capturedLocation: Location? = null

        val burstListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (capturedLocation == null || location.accuracy < (capturedLocation?.accuracy ?: 999f)) {
                    capturedLocation = location
                }
            }
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        try {
            withContext(Dispatchers.Main) {
                releaseBurstListener()
                activeBurstListener = burstListener

                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        0L,
                        0f,
                        burstListener,
                        Looper.getMainLooper()
                    )
                }
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        0L,
                        0f,
                        burstListener,
                        Looper.getMainLooper()
                    )
                }
            }

            var waited = 0L
            while (waited < GPS_ACQUIRE_TIMEOUT_MS) {
                val loc = capturedLocation
                if (loc != null && loc.accuracy <= 35f) {
                    break
                }
                delay(500L)
                waited += 500L
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            // CRITICAL: Always remove listener immediately so GPS hardware chip powers down!
            withContext(Dispatchers.Main) {
                releaseBurstListener()
            }
        }

        val finalLocation = capturedLocation ?: getBestLastKnownLocation()
        if (finalLocation != null) {
            dispatchLocationUpdate(finalLocation)
        }
    }

    @SuppressLint("MissingPermission")
    private fun getBestLastKnownLocation(): Location? {
        return try {
            val gps = if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) else null
            val net = if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) else null
            val passive = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)

            listOfNotNull(gps, net, passive).maxByOrNull { it.time }
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
        val now = System.currentTimeMillis()
        val batteryLevel = getBatteryLevel()

        session.lastLatitude = loc.latitude
        session.lastLongitude = loc.longitude
        session.lastAccuracy = loc.accuracy
        session.lastUpdateTime = now

        val accuracyStr = if (loc.hasAccuracy()) "±${loc.accuracy.toInt()}m" else ""
        val speedKmh = if (loc.hasSpeed()) loc.speed * 3.6f else 0f
        val speedStr = if (speedKmh > 1f) " • ${speedKmh.toInt()} km/j" else ""

        withContext(Dispatchers.Main) {
            val notifManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notifManager.notify(
                NOTIFICATION_ID,
                buildNotification("GPS 1 mnt • $accuracyStr$speedStr • Baterai: $batteryLevel%")
            )

            val broadcast = Intent(ACTION_LOCATION_UPDATED).apply {
                setPackage(packageName)
                putExtra("lat", loc.latitude)
                putExtra("lng", loc.longitude)
                putExtra("acc", loc.accuracy)
                putExtra("speed", speedKmh)
                putExtra("battery", batteryLevel)
                putExtra("time", now)
            }
            sendBroadcast(broadcast)
        }

        val token = session.token
        if (!token.isNullOrBlank() && session.isDutyActive) {
            val payload = LocationPayload(
                latitude = loc.latitude,
                longitude = loc.longitude,
                accuracy = if (loc.hasAccuracy()) loc.accuracy else null,
                speed = if (loc.hasSpeed()) speedKmh else null,
                heading = if (loc.hasBearing()) loc.bearing else null,
                battery = batteryLevel
            )
            ApiClient.sendLocation(session.serverUrl, token, payload)
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
