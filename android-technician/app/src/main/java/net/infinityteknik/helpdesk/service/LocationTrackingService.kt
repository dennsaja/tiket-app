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
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.LocationPayload
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.ui.MainActivity
import net.infinityteknik.helpdesk.util.TrackingScheduleManager

class LocationTrackingService : Service(), LocationListener {

    companion object {
        const val CHANNEL_ID = "helpdesk_location_tracking"
        const val NOTIFICATION_ID = 1001
        const val ACTION_LOCATION_UPDATED = "net.infinityteknik.helpdesk.LOCATION_UPDATED"
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var locationManager: LocationManager
    private lateinit var session: SessionManager

    private var lastSentTime = 0L
    private val MIN_INTERVAL_MS = 20000L // 20 seconds

    override fun onCreate() {
        super.onCreate()
        session = SessionManager(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START

        if (action == ACTION_STOP) {
            // Cannot stop if in working hours (08:00 - 16:00 WIB) or if there are still active tasks
            if (TrackingScheduleManager.isTrackingMandatory(session.activeTicketsCount)) {
                startForegroundTracking()
                return START_STICKY
            }
            stopTracking()
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundTracking()
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pelacakan GPS Teknisi",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifikasi status pelacakan lokasi lapangan teknisi"
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
            .setContentTitle("HelpDesk Teknisi • GPS Aktif")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    @SuppressLint("MissingPermission")
    private fun startForegroundTracking() {
        val notification = buildNotification("Melacak lokasi lapangan secara realtime...")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        try {
            // Register GPS Provider
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    15000L,
                    10f,
                    this
                )
            }

            // Register Network Provider as fallback
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    20000L,
                    15f,
                    this
                )
            }

            // Immediately check last known location
            val lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            val bestLoc = lastGps ?: lastNet
            if (bestLoc != null) {
                onLocationChanged(bestLoc)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopTracking() {
        try {
            locationManager.removeUpdates(this)
        } catch (e: Exception) {}

        serviceScope.launch {
            val token = session.token
            if (!token.isNullOrBlank()) {
                ApiClient.stopLocation(session.serverUrl, token)
            }
        }
    }

    override fun onLocationChanged(loc: Location) {
        // Auto turn off if outside work hours (past 16:00 WIB) and no active tasks left
        if (TrackingScheduleManager.shouldAutoTurnOff(session.activeTicketsCount)) {
            session.isDutyActive = false
            stopTracking()
            stopSelf()
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastSentTime < MIN_INTERVAL_MS) {
            // Still update local session
            session.lastLatitude = loc.latitude
            session.lastLongitude = loc.longitude
            session.lastAccuracy = loc.accuracy
            session.lastUpdateTime = now
            return
        }
        lastSentTime = now

        val batteryLevel = getBatteryLevel()

        session.lastLatitude = loc.latitude
        session.lastLongitude = loc.longitude
        session.lastAccuracy = loc.accuracy
        session.lastUpdateTime = now

        // Update ongoing notification
        val accuracyStr = if (loc.hasAccuracy()) "±${loc.accuracy.toInt()}m" else ""
        val speedStr = if (loc.hasSpeed() && loc.speed > 1) " • ${(loc.speed * 3.6f).toInt()} km/h" else ""
        val notifManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notifManager.notify(NOTIFICATION_ID, buildNotification("Lokasi aktif ($accuracyStr$speedStr • Bat: $batteryLevel%)"))

        // Send broadcast to update UI in MainActivity
        val broadcast = Intent(ACTION_LOCATION_UPDATED).apply {
            putExtra("lat", loc.latitude)
            putExtra("lng", loc.longitude)
            putExtra("acc", loc.accuracy)
            putExtra("battery", batteryLevel)
            putExtra("time", now)
        }
        sendBroadcast(broadcast)

        // Upload to HelpDesk API
        serviceScope.launch {
            val token = session.token
            if (!token.isNullOrBlank() && session.isDutyActive) {
                val payload = LocationPayload(
                    latitude = loc.latitude,
                    longitude = loc.longitude,
                    accuracy = if (loc.hasAccuracy()) loc.accuracy else null,
                    speed = if (loc.hasSpeed()) loc.speed * 3.6f else null,
                    heading = if (loc.hasBearing()) loc.bearing else null,
                    battery = batteryLevel
                )
                ApiClient.sendLocation(session.serverUrl, token, payload)
            }
        }
    }

    private fun getBatteryLevel(): Int {
        val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        return bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
    }

    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    override fun onDestroy() {
        stopTracking()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
