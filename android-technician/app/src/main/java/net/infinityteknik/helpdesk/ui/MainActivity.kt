package net.infinityteknik.helpdesk.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.NotificationItem
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import net.infinityteknik.helpdesk.service.LocationTrackingService
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.TrackingScheduleManager
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var session: SessionManager

    // Top Blue Hero Dashboard Views
    private lateinit var cardProfileAvatar: CardView
    private lateinit var tvTechnicianName: TextView
    private lateinit var tvTechnicianRole: TextView
    private lateinit var btnNotificationBell: FrameLayout
    private lateinit var tvNotificationBadge: TextView
    private lateinit var btnSettings: FrameLayout

    // Bento Grid Left Column Cards
    private lateinit var cardGpsStatus: LinearLayout
    private lateinit var tvDutyStatus: TextView
    private lateinit var tvGpsCoords: TextView
    private lateinit var cardFilterActive: LinearLayout
    private lateinit var tvCountActive: TextView
    private lateinit var tvFilterActiveLabel: TextView
    private lateinit var cardFilterResolved: LinearLayout
    private lateinit var tvCountResolved: TextView
    private lateinit var tvFilterResolvedLabel: TextView

    // Bento Grid Right Column Timeline Card
    private lateinit var cardTimeline: LinearLayout
    private lateinit var chartWeeklyTimeline: WeeklyTimelineChartView

    // Bottom Support Banner inside Hero Card
    private lateinit var cardSupportBanner: CardView

    // In-App Heads-Up Notification Pop-up Banner
    private lateinit var cardHeadsUpBanner: CardView
    private lateinit var tvHeadsUpCategory: TextView
    private lateinit var tvHeadsUpTitle: TextView
    private lateinit var tvHeadsUpMessage: TextView
    private lateinit var btnHeadsUpOpen: MaterialButton
    private lateinit var btnHeadsUpDismiss: ImageButton
    private var currentHeadsUpNotif: NotificationItem? = null
    private var headsUpAutoHideJob: Job? = null

    // Search & Filter Reset Row + Ticket List
    private lateinit var cardFilterAll: LinearLayout
    private lateinit var etSearchTickets: EditText
    private lateinit var tvTicketCount: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTickets: RecyclerView
    private lateinit var tvEmptyState: TextView

    private lateinit var ticketAdapter: TicketAdapter
    private var allTickets = listOf<TicketItem>()
    private var cachedNotifications = listOf<NotificationItem>()
    private var unreadNotifCount = 0
    private var selectedFilterIndex = 0 // 0 = All, 1 = Belum Selesai, 2 = Selesai
    private var searchQuery = ""
    private var realtimePollJob: Job? = null
    private var latestWeeklyCounts = IntArray(6) { 0 }

    private var hasShownNotifDialogThisResume = false

    private val detailLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadTickets(silent = true)
        }
        syncNotificationsNow()
    }

    private val notifPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted && NotificationHelper.areSystemNotificationsEnabled(this)) {
            Toast.makeText(this, "Izin Notifikasi HelpDesk Aktif!", Toast.LENGTH_SHORT).show()
            syncNotificationsNow()
            requestLocationPermissionsIfNeeded()
        } else {
            showNotificationPermissionFallbackDialog()
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            evaluateTrackingRules(session.activeTicketsCount)
        } else {
            Toast.makeText(
                this,
                "Izin lokasi GPS diperlukan saat mengerjakan tiket tugas lapangan",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private val systemEventReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                LocationTrackingService.ACTION_LOCATION_UPDATED -> {
                    val lat = intent.getDoubleExtra("lat", 0.0)
                    val lng = intent.getDoubleExtra("lng", 0.0)
                    val acc = intent.getFloatExtra("acc", 0f)
                    val battery = intent.getIntExtra("battery", -1)
                    updateGpsDisplay(lat, lng, acc, battery, System.currentTimeMillis())
                }
                NotificationHelper.ACTION_NOTIFICATION_SYNCED -> {
                    val payload = NotificationHelper.latestCachedPayload
                    if (payload != null) {
                        cachedNotifications = payload.notifications
                        unreadNotifCount = payload.unreadCount
                        updateNotificationBadge(unreadNotifCount)
                    } else {
                        val count = intent.getIntExtra("unreadCount", unreadNotifCount)
                        unreadNotifCount = count
                        updateNotificationBadge(count)
                    }

                    val newNotifId = intent.getStringExtra("newNotifId")
                    if (!newNotifId.isNullOrBlank()) {
                        val triggered = cachedNotifications.find { it.id == newNotifId }
                            ?: NotificationItem(
                                id = newNotifId,
                                type = intent.getStringExtra("newNotifType") ?: "ticket_updated",
                                title = intent.getStringExtra("newNotifTitle") ?: "Notifikasi Baru",
                                message = intent.getStringExtra("newNotifMessage") ?: "",
                                ticketId = intent.getStringExtra("newNotifTicketId")?.takeIf { it.isNotBlank() },
                                ticketNumber = 0,
                                ticketTitle = intent.getStringExtra("newNotifTitle") ?: "",
                                ticketStatus = "assigned",
                                ticketPriority = "medium",
                                ticketType = null,
                                reporterName = null,
                                reporterPhone = null,
                                reporterAddress = null,
                                reporterMapUrl = null,
                                ticketDescription = null,
                                isRead = false,
                                createdAt = ""
                            )
                        showInAppHeadsUpBanner(triggered)
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        session = SessionManager(this)
        NotificationHelper.ensureAlertChannel(this)

        initViews()
        setupRecyclerView()

        cachedNotifications = session.getLocalNotifications()
        unreadNotifCount = cachedNotifications.count { !it.isRead }
        updateNotificationBadge(unreadNotifCount)

        checkAndRequestPermissions()

        // Rule: GPS is ONLY active when there are active unfinished tickets
        evaluateTrackingRules(session.activeTicketsCount)

        loadTickets(silent = false)
        loadUserProfile()
    }

    private fun initViews() {
        cardProfileAvatar = findViewById(R.id.cardProfileAvatar)
        tvTechnicianName = findViewById(R.id.tvTechnicianName)
        tvTechnicianRole = findViewById(R.id.tvTechnicianRole)
        btnNotificationBell = findViewById(R.id.btnNotificationBell)
        tvNotificationBadge = findViewById(R.id.tvNotificationBadge)
        btnSettings = findViewById(R.id.btnSettings)

        cardGpsStatus = findViewById(R.id.cardGpsStatus)
        tvDutyStatus = findViewById(R.id.tvDutyStatus)
        tvGpsCoords = findViewById(R.id.tvGpsCoords)

        cardFilterActive = findViewById(R.id.cardFilterActive)
        tvCountActive = findViewById(R.id.tvCountActive)
        tvFilterActiveLabel = findViewById(R.id.tvFilterActiveLabel)

        cardFilterResolved = findViewById(R.id.cardFilterResolved)
        tvCountResolved = findViewById(R.id.tvCountResolved)
        tvFilterResolvedLabel = findViewById(R.id.tvFilterResolvedLabel)

        cardTimeline = findViewById(R.id.cardTimeline)
        chartWeeklyTimeline = findViewById(R.id.chartWeeklyTimeline)
        cardSupportBanner = findViewById(R.id.cardSupportBanner)

        cardHeadsUpBanner = findViewById(R.id.cardHeadsUpBanner)
        tvHeadsUpCategory = findViewById(R.id.tvHeadsUpCategory)
        tvHeadsUpTitle = findViewById(R.id.tvHeadsUpTitle)
        tvHeadsUpMessage = findViewById(R.id.tvHeadsUpMessage)
        btnHeadsUpOpen = findViewById(R.id.btnHeadsUpOpen)
        btnHeadsUpDismiss = findViewById(R.id.btnHeadsUpDismiss)

        cardFilterAll = findViewById(R.id.cardFilterAll)
        etSearchTickets = findViewById(R.id.etSearchTickets)
        tvTicketCount = findViewById(R.id.tvTicketCount)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        rvTickets = findViewById(R.id.rvTickets)
        tvEmptyState = findViewById(R.id.tvEmptyState)

        tvTechnicianName.text = session.userName ?: "Teknisi"
        tvTechnicianRole.text = "Teknisi"
        chartWeeklyTimeline.setWeeklyCounts(latestWeeklyCounts)

        cardProfileAvatar.setOnClickListener {
            showSettingsAndAccountDialog()
        }

        btnNotificationBell.setOnClickListener {
            showNotificationDrawerDialog()
        }

        btnSettings.setOnClickListener {
            showSettingsAndAccountDialog()
        }

        cardGpsStatus.setOnClickListener {
            handleGpsCardClick()
        }

        cardFilterActive.setOnClickListener {
            val next = if (selectedFilterIndex == 1) 0 else 1
            selectFilter(next)
            val label = if (next == 1) "Menampilkan Tiket Belum Selesai" else "Menampilkan Semua Tiket"
            Toast.makeText(this, label, Toast.LENGTH_SHORT).show()
        }

        cardFilterResolved.setOnClickListener {
            val next = if (selectedFilterIndex == 2) 0 else 2
            selectFilter(next)
            val label = if (next == 2) "Menampilkan Tiket Selesai" else "Menampilkan Semua Tiket"
            Toast.makeText(this, label, Toast.LENGTH_SHORT).show()
        }

        cardTimeline.setOnClickListener {
            showWeeklyTimelineDetailDialog()
        }

        cardSupportBanner.setOnClickListener {
            showSupportAndQuickChatDialog()
        }

        cardFilterAll.setOnClickListener {
            selectFilter(0)
        }

        btnHeadsUpDismiss.setOnClickListener {
            cardHeadsUpBanner.visibility = View.GONE
        }

        btnHeadsUpOpen.setOnClickListener {
            val notif = currentHeadsUpNotif
            cardHeadsUpBanner.visibility = View.GONE
            if (notif != null) {
                handleNotificationClicked(notif)
            }
        }

        cardHeadsUpBanner.setOnClickListener {
            val notif = currentHeadsUpNotif
            cardHeadsUpBanner.visibility = View.GONE
            if (notif != null) {
                handleNotificationClicked(notif)
            }
        }

        swipeRefresh.setOnRefreshListener {
            loadTickets(silent = false)
            loadUserProfile()
            syncNotificationsNow()
        }

        etSearchTickets.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.trim() ?: ""
                applyFiltersAndRender()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        updateDutyUi(session.activeTicketsCount > 0)
        if (session.activeTicketsCount > 0 && session.lastLatitude != 0.0) {
            updateGpsDisplay(
                session.lastLatitude,
                session.lastLongitude,
                session.lastAccuracy,
                -1,
                session.lastUpdateTime
            )
        }
    }

    private fun handleGpsCardClick() {
        if (session.activeTicketsCount > 0) {
            if (!hasLocationPermission()) {
                requestLocationPermissionsIfNeeded()
                return
            }
            startTrackingService()
            val forceIntent = Intent(this, LocationTrackingService::class.java).apply {
                action = LocationTrackingService.ACTION_FORCE_PING
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(forceIntent)
            } else {
                startService(forceIntent)
            }
            Toast.makeText(
                this,
                "GPS Aktif (${session.activeTicketsCount} tiket belum selesai) • Mengirim ping lokasi sekarang...",
                Toast.LENGTH_SHORT
            ).show()
        } else {
            Toast.makeText(
                this,
                "GPS Nonaktif: Fitur GPS hanya aktif otomatis jika ada tiket yang belum selesai.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun updateNotificationBadge(count: Int) {
        if (count > 0) {
            tvNotificationBadge.visibility = View.VISIBLE
            tvNotificationBadge.text = if (count > 9) "9+" else count.toString()
        } else {
            tvNotificationBadge.visibility = View.GONE
        }
    }

    private fun showInAppHeadsUpBanner(notif: NotificationItem) {
        currentHeadsUpNotif = notif
        val categoryLabel = NotificationHelper.getTypeLabel(notif.type).uppercase(Locale.getDefault())
        tvHeadsUpCategory.text = categoryLabel
        tvHeadsUpTitle.text = notif.title
        tvHeadsUpMessage.text = notif.message

        val isChat = notif.type == "new_message" || notif.type == "new_internal_note"
        btnHeadsUpOpen.text = if (isChat) "Balas Chat" else "Buka Tiket"

        cardHeadsUpBanner.visibility = View.VISIBLE

        headsUpAutoHideJob?.cancel()
        headsUpAutoHideJob = lifecycleScope.launch {
            delay(8_000L)
            cardHeadsUpBanner.visibility = View.GONE
        }
    }

    private fun syncNotificationsNow() {
        lifecycleScope.launch {
            val ticketsArg = allTickets.takeIf { it.isNotEmpty() }
            val payload = NotificationHelper.syncAndDispatchNotifications(this@MainActivity, session, ticketsArg)
            if (payload != null) {
                cachedNotifications = payload.notifications
                unreadNotifCount = payload.unreadCount
                updateNotificationBadge(unreadNotifCount)
            }
        }
    }

    private fun handleNotificationClicked(notif: NotificationItem) {
        val token = session.token
        session.markLocalNotificationRead(notif.id)
        if (!token.isNullOrBlank() && !notif.isRead) {
            lifecycleScope.launch {
                ApiClient.markNotificationRead(session.serverUrl, token, notif.id)
                syncNotificationsNow()
            }
        } else {
            syncNotificationsNow()
        }

        val isChat = notif.type == "new_message" || notif.type == "new_internal_note"
        val targetTab = if (isChat) 1 else 0

        if (!notif.ticketId.isNullOrBlank()) {
            val matchedTicket = allTickets.find { it.id == notif.ticketId }
            if (matchedTicket != null) {
                openTicketDetail(matchedTicket, initialTab = targetTab)
            } else {
                val fallback = TicketItem(
                    id = notif.ticketId,
                    ticketNumber = notif.ticketNumber,
                    title = notif.ticketTitle.ifBlank { notif.title },
                    description = notif.ticketDescription ?: notif.message,
                    status = notif.ticketStatus.ifBlank { "assigned" },
                    priority = notif.ticketPriority.ifBlank { "medium" },
                    ticketType = notif.ticketType,
                    reporterName = notif.reporterName,
                    reporterPhone = notif.reporterPhone,
                    reporterAddress = notif.reporterAddress,
                    reporterMapUrl = notif.reporterMapUrl,
                    latitude = null,
                    longitude = null,
                    isLead = true,
                    createdAt = notif.createdAt,
                    updatedAt = notif.createdAt
                )
                openTicketDetail(fallback, initialTab = targetTab)
            }
        }
    }

    /**
     * Interactive Settings & Account Dialog (triggered by the top-right Settings Gear button or Profile Avatar).
     */
    private fun showSettingsAndAccountDialog() {
        val gpsStateText = if (session.activeTicketsCount > 0) {
            "GPS Aktif (${session.activeTicketsCount} tiket belum selesai)"
        } else {
            "GPS Nonaktif (Tidak ada tiket aktif)"
        }
        val coordsText = if (session.activeTicketsCount > 0 && session.lastLatitude != 0.0) {
            String.format(Locale.US, "%.13f, %.13f", session.lastLatitude, session.lastLongitude)
        } else {
            "-"
        }

        val options = arrayOf(
            "Segarkan Data & Tiket Sekarang",
            "Tes Notifikasi Pop-up & Suara",
            "Pengaturan Izin Notifikasi HP",
            "Ping Lokasi GPS Sekarang",
            "Lihat Semua Tiket (${allTickets.size})",
            "Keluar Akun (Logout)"
        )

        AlertDialog.Builder(this)
            .setTitle("${session.userName ?: "Teknisi"} • Pengaturan (v1.6.0)")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> {
                        Toast.makeText(this, "Menyegarkan data tiket & notifikasi...", Toast.LENGTH_SHORT).show()
                        loadTickets(silent = false)
                        loadUserProfile()
                        syncNotificationsNow()
                    }
                    1 -> triggerTestNotification()
                    2 -> NotificationHelper.openNotificationSettings(this)
                    3 -> handleGpsCardClick()
                    4 -> selectFilter(0)
                    5 -> confirmLogout()
                }
            }
            .setNeutralButton("Info Status") { _, _ ->
                AlertDialog.Builder(this)
                    .setTitle("Status Perangkat Teknisi")
                    .setMessage(
                        "Nama: ${session.userName}\n" +
                            "Email: ${session.userEmail}\n" +
                            "Status GPS: $gpsStateText\n" +
                            "Koordinat: $coordsText\n" +
                            "Server: ${session.serverUrl}\n" +
                            "Versi Aplikasi: v1.6.0 (Build 6)"
                    )
                    .setPositiveButton("Tutup", null)
                    .show()
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    /**
     * Interactive Weekly Timeline Summary Dialog (triggered when tapping the Timeline chart card).
     */
    private fun showWeeklyTimelineDetailDialog() {
        val days = arrayOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu")
        val counts = latestWeeklyCounts
        val totalWeek = counts.sum()

        val sb = StringBuilder()
        sb.append("Akumulasi tiket yang dikerjakan minggu ini:\n\n")
        for (i in days.indices) {
            val c = if (i < counts.size) counts[i] else 0
            sb.append("• ${days[i]}: $c tiket\n")
        }
        sb.append("\nTotal Minggu Ini: $totalWeek tiket")
        sb.append("\nTiket Belum Selesai: ${session.activeTicketsCount} tiket")

        AlertDialog.Builder(this)
            .setTitle("Statistik Timeline Mingguan")
            .setMessage(sb.toString())
            .setPositiveButton("Tampilkan Semua Tiket") { _, _ ->
                selectFilter(0)
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    /**
     * Interactive Support & Quick Team Chat Dialog (triggered when tapping "Teknisi Butuh Bantuan?").
     */
    private fun showSupportAndQuickChatDialog() {
        val activeTicket = allTickets.firstOrNull { t ->
            val s = t.status.lowercase(Locale.ROOT)
            s != "resolved" && s != "closed" && s != "cancelled"
        } ?: allTickets.firstOrNull()

        if (activeTicket != null) {
            AlertDialog.Builder(this)
                .setTitle("Bantuan Teknisi & Koordinasi NOC")
                .setMessage(
                    "Fitur Pusat Bantuan Mandiri sedang disiapkan (Coming Soon).\n\n" +
                        "Untuk bantuan langsung saat ini, Anda dapat menghubungi tim NOC melalui ruang Chat Tim pada tiket aktif #${activeTicket.ticketNumber} (${activeTicket.title})."
                )
                .setPositiveButton("Buka Chat Tim #${activeTicket.ticketNumber}") { _, _ ->
                    openTicketDetail(activeTicket, initialTab = 1)
                }
                .setNeutralButton("Segarkan Tiket") { _, _ ->
                    loadTickets(silent = false)
                }
                .setNegativeButton("Tutup", null)
                .show()
        } else {
            AlertDialog.Builder(this)
                .setTitle("Bantuan Teknisi (Coming Soon)")
                .setMessage(
                    "Pusat Bantuan Terpadu sedang dalam pengembangan.\n\n" +
                        "Saat Anda memiliki tiket aktif, ketuk tombol ini untuk langsung membuka ruang Chat Tim dengan NOC Dispatcher."
                )
                .setPositiveButton("Segarkan Data") { _, _ ->
                    loadTickets(silent = false)
                }
                .setNegativeButton("Tutup", null)
                .show()
        }
    }

    /**
     * Opens the In-App Notification Drawer (Panel Notifikasi) matching the Web TopNav Notification Panel.
     */
    private fun showNotificationDrawerDialog() {
        val dp = { value: Int ->
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value.toFloat(),
                resources.displayMetrics
            ).toInt()
        }

        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#FFFFFF"))
            setPadding(0, 0, 0, dp(12))
        }

        // Top Header Bar
        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#004C9E"))
            setPadding(dp(16), dp(14), dp(14), dp(14))
        }

        val logoFrame = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(26), dp(26))
            setBackgroundResource(R.drawable.logo_square_white_bg)
        }
        val logoImg = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(14), dp(14), Gravity.CENTER)
            setImageResource(R.drawable.ic_web_logo_triangle)
        }
        logoFrame.addView(logoImg)
        headerRow.addView(logoFrame)

        val titleCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(10)
            }
        }

        val tvHeaderTitle = TextView(this).apply {
            text = "Panel Notifikasi"
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
        }
        val tvHeaderSub = TextView(this).apply {
            text = if (unreadNotifCount > 0) "$unreadNotifCount belum dibaca" else "Semua notifikasi telah dibaca"
            setTextColor(Color.parseColor("#E0F2FE"))
            textSize = 11f
        }
        titleCol.addView(tvHeaderTitle)
        titleCol.addView(tvHeaderSub)
        headerRow.addView(titleCol)

        var dialogRef: AlertDialog? = null

        val btnTestNotif = TextView(this).apply {
            text = "Tes Pop-up"
            setTextColor(Color.parseColor("#A7F3D0"))
            textSize = 11f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(8), dp(6), dp(8), dp(6))
            setOnClickListener {
                dialogRef?.dismiss()
                triggerTestNotification()
            }
        }
        headerRow.addView(btnTestNotif)

        if (unreadNotifCount > 0) {
            val btnMarkAll = TextView(this).apply {
                text = "Tandai Dibaca"
                setTextColor(Color.parseColor("#BAE6FD"))
                textSize = 11f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(dp(8), dp(6), dp(8), dp(6))
                setOnClickListener {
                    session.markAllLocalNotificationsRead()
                    val token = session.token
                    lifecycleScope.launch {
                        if (!token.isNullOrBlank()) {
                            ApiClient.markAllNotificationsRead(session.serverUrl, token)
                        }
                        syncNotificationsNow()
                        dialogRef?.dismiss()
                        Toast.makeText(this@MainActivity, "Semua notifikasi ditandai telah dibaca", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            headerRow.addView(btnMarkAll)
        }

        rootLayout.addView(headerRow)

        if (!NotificationHelper.areSystemNotificationsEnabled(this)) {
            val permWarningRow = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(Color.parseColor("#FEF2F2"))
                setPadding(dp(16), dp(12), dp(16), dp(12))
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    dialogRef?.dismiss()
                    NotificationHelper.openNotificationSettings(this@MainActivity)
                }
            }
            val tvPermTitle = TextView(this).apply {
                text = "Izin Notifikasi Android Belum Aktif"
                setTextColor(Color.parseColor("#B91C1C"))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
            }
            val tvPermDesc = TextView(this).apply {
                text = "Ketuk di sini untuk mengaktifkan izin Status Bar & Pop-up Notifikasi di pengaturan HP Anda →"
                setTextColor(Color.parseColor("#DC2626"))
                textSize = 11f
                setPadding(0, dp(2), 0, 0)
            }
            permWarningRow.addView(tvPermTitle)
            permWarningRow.addView(tvPermDesc)
            rootLayout.addView(permWarningRow)
        }

        val scrollView = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        if (cachedNotifications.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "Belum ada notifikasi masuk saat ini.\nNotifikasi chat tim, perubahan status, dan detail tiket akan tampil di sini."
                setTextColor(Color.parseColor("#71717A"))
                textSize = 13f
                gravity = Gravity.CENTER
                setPadding(dp(24), dp(36), dp(24), dp(36))
            }
            listContainer.addView(emptyTv)
        } else {
            cachedNotifications.forEach { item ->
                val itemRow = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(
                        if (!item.isRead) Color.parseColor("#F4F4F5") else Color.parseColor("#FFFFFF")
                    )
                    setPadding(dp(16), dp(12), dp(16), dp(12))
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        dialogRef?.dismiss()
                        handleNotificationClicked(item)
                    }
                }

                val metaRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }

                if (!item.isRead) {
                    val unreadDot = View(this).apply {
                        layoutParams = LinearLayout.LayoutParams(dp(8), dp(8)).apply {
                            marginEnd = dp(6)
                        }
                        background = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(Color.parseColor("#2563EB"))
                        }
                    }
                    metaRow.addView(unreadDot)
                }

                val tvCategory = TextView(this).apply {
                    text = NotificationHelper.getTypeLabel(item.type).uppercase(Locale.getDefault())
                    val badgeColor = when (item.type) {
                        "new_message", "new_internal_note" -> "#0284C7"
                        "status_changed" -> "#7C3AED"
                        "ticket_updated" -> "#D97706"
                        "ticket_assigned", "ticket_created" -> "#16A34A"
                        else -> "#52525B"
                    }
                    setTextColor(Color.parseColor(badgeColor))
                    textSize = 10f
                    setTypeface(typeface, Typeface.BOLD)
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }
                metaRow.addView(tvCategory)

                val ticketNum = item.ticketNumber
                if (ticketNum > 0) {
                    val tvTicketPill = TextView(this).apply {
                        text = "#$ticketNum"
                        setTextColor(Color.parseColor("#18181B"))
                        textSize = 10f
                        setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
                        setBackgroundResource(R.drawable.badge_bg)
                        setPadding(dp(6), dp(2), dp(6), dp(2))
                    }
                    metaRow.addView(tvTicketPill)
                }

                itemRow.addView(metaRow)

                val tvTitle = TextView(this).apply {
                    text = item.title
                    setTextColor(Color.parseColor("#09090B"))
                    textSize = 13f
                    setTypeface(typeface, if (!item.isRead) Typeface.BOLD else Typeface.NORMAL)
                    setPadding(0, dp(4), 0, dp(2))
                }
                itemRow.addView(tvTitle)

                val tvMsg = TextView(this).apply {
                    text = item.message
                    setTextColor(Color.parseColor("#52525B"))
                    textSize = 12f
                }
                itemRow.addView(tvMsg)

                val actionHint = TextView(this).apply {
                    val isChat = item.type == "new_message" || item.type == "new_internal_note"
                    text = if (isChat) "Ketuk untuk membuka Chat Tim →" else "Ketuk untuk membuka Detail Tiket →"
                    setTextColor(Color.parseColor("#18181B"))
                    textSize = 10f
                    setTypeface(typeface, Typeface.BOLD)
                    setPadding(0, dp(6), 0, 0)
                }
                itemRow.addView(actionHint)

                val divider = View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(1)
                    )
                    setBackgroundColor(Color.parseColor("#E4E4E7"))
                }

                listContainer.addView(itemRow)
                listContainer.addView(divider)
            }
        }

        scrollView.addView(listContainer)
        rootLayout.addView(scrollView)

        dialogRef = AlertDialog.Builder(this)
            .setView(rootLayout)
            .setNegativeButton("Tutup", null)
            .create()

        dialogRef.show()
    }

    private fun selectFilter(index: Int) {
        selectedFilterIndex = index

        cardFilterActive.setBackgroundResource(
            if (index == 1) R.drawable.bg_glass_blue_card_selected else R.drawable.bg_glass_blue_card
        )
        cardFilterResolved.setBackgroundResource(
            if (index == 2) R.drawable.bg_glass_blue_card_selected else R.drawable.bg_glass_blue_card
        )

        applyFiltersAndRender()
    }

    private fun applyFiltersAndRender() {
        val filtered = allTickets.filter { t ->
            val s = t.status.lowercase()
            val isResolved = s == "resolved" || s == "closed" || s == "cancelled"

            val matchesTab = when (selectedFilterIndex) {
                1 -> !isResolved
                2 -> isResolved
                else -> true
            }

            val q = searchQuery.lowercase()
            val matchesQuery = if (q.isEmpty()) {
                true
            } else {
                t.ticketNumber.toString().contains(q) ||
                    t.title.lowercase().contains(q) ||
                    (t.reporterName?.lowercase()?.contains(q) == true) ||
                    (t.reporterAddress?.lowercase()?.contains(q) == true)
            }

            matchesTab && matchesQuery
        }

        ticketAdapter.submitList(filtered)
        val filterName = when (selectedFilterIndex) {
            1 -> "Belum Selesai (${filtered.size})"
            2 -> "Selesai (${filtered.size})"
            else -> "Semua (${filtered.size})"
        }
        tvTicketCount.text = filterName

        if (filtered.isEmpty()) {
            tvEmptyState.visibility = View.VISIBLE
            rvTickets.visibility = View.GONE
        } else {
            tvEmptyState.visibility = View.GONE
            rvTickets.visibility = View.VISIBLE
        }
    }

    private fun setupRecyclerView() {
        ticketAdapter = TicketAdapter(
            context = this,
            onPrimaryActionClick = { ticket -> handlePrimaryAction(ticket) },
            onDetailClick = { ticket -> openTicketDetail(ticket, initialTab = 0) },
            onChatClick = { ticket -> openTicketDetail(ticket, initialTab = 1) }
        )
        rvTickets.layoutManager = LinearLayoutManager(this)
        rvTickets.adapter = ticketAdapter
    }

    private fun handlePrimaryAction(ticket: TicketItem) {
        val nextStatus = when (ticket.status.lowercase()) {
            "open", "assigned" -> "accepted"
            "accepted" -> "on_site"
            "on_site" -> "in_progress"
            "in_progress" -> {
                openTicketDetail(ticket, initialTab = 2)
                return
            }
            else -> {
                openTicketDetail(ticket, initialTab = 0)
                return
            }
        }

        val actionDesc = when (nextStatus) {
            "accepted" -> "Menerima tiket #${ticket.ticketNumber}..."
            "on_site" -> "Konfirmasi tiba di lokasi #${ticket.ticketNumber}..."
            "in_progress" -> "Memulai pengerjaan #${ticket.ticketNumber}..."
            else -> "Memperbarui status..."
        }

        val token = session.token ?: return
        Toast.makeText(this, actionDesc, Toast.LENGTH_SHORT).show()
        NotificationHelper.recordSelfStatusChange(ticket.id, nextStatus)

        lifecycleScope.launch {
            val result = ApiClient.updateTicketStatus(
                session.serverUrl,
                token,
                ticket.id,
                nextStatus,
                "Diperbarui langsung dari aplikasi teknisi",
                null
            )
            result.onSuccess {
                val statusLabel = NotificationHelper.formatStatusName(nextStatus)
                Toast.makeText(this@MainActivity, "Status tiket #${ticket.ticketNumber}: $statusLabel", Toast.LENGTH_SHORT).show()
                loadTickets(silent = true)
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Gagal: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun openTicketDetail(ticket: TicketItem, initialTab: Int = 0) {
        val intent = Intent(this, TicketDetailActivity::class.java).apply {
            putExtra(TicketDetailActivity.EXTRA_TICKET_ID, ticket.id)
            putExtra(TicketDetailActivity.EXTRA_TICKET_NUMBER, ticket.ticketNumber)
            putExtra(TicketDetailActivity.EXTRA_TITLE, ticket.title)
            putExtra(TicketDetailActivity.EXTRA_STATUS, ticket.status)
            putExtra(TicketDetailActivity.EXTRA_PRIORITY, ticket.priority)
            putExtra(TicketDetailActivity.EXTRA_TYPE, ticket.ticketType ?: "")
            putExtra(TicketDetailActivity.EXTRA_REPORTER_NAME, ticket.reporterName ?: "")
            putExtra(TicketDetailActivity.EXTRA_REPORTER_PHONE, ticket.reporterPhone ?: "")
            putExtra(TicketDetailActivity.EXTRA_REPORTER_ADDRESS, ticket.reporterAddress ?: "")
            putExtra(TicketDetailActivity.EXTRA_REPORTER_MAP_URL, ticket.reporterMapUrl ?: "")
            putExtra(TicketDetailActivity.EXTRA_LATITUDE, ticket.latitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_LONGITUDE, ticket.longitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_DESCRIPTION, ticket.description ?: "")
            putExtra(TicketDetailActivity.EXTRA_INITIAL_TAB, initialTab)
        }
        detailLauncher.launch(intent)
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun checkAndRequestPermissions() {
        if (!NotificationHelper.areSystemNotificationsEnabled(this)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                showNotificationPermissionFallbackDialog()
            }
        } else {
            requestLocationPermissionsIfNeeded()
        }
    }

    private fun requestLocationPermissionsIfNeeded() {
        val permissions = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            locationPermissionLauncher.launch(needed.toTypedArray())
        } else {
            evaluateTrackingRules(session.activeTicketsCount)
        }
    }

    private fun showNotificationPermissionFallbackDialog() {
        if (hasShownNotifDialogThisResume || isFinishing) return
        hasShownNotifDialogThisResume = true

        AlertDialog.Builder(this)
            .setTitle("Izin Notifikasi Diperlukan")
            .setMessage(
                "Aplikasi HelpDesk Teknisi memerlukan izin Notifikasi agar peringatan Chat Tim, Perubahan Status, dan Tugas Tiket Baru dapat muncul di Status Bar, Panel Notifikasi, dan Pop-up Layar.\n\nKetuk 'Aktifkan Sekarang' lalu nyalakan sakelar Izinkan Notifikasi."
            )
            .setCancelable(false)
            .setPositiveButton("Aktifkan Sekarang") { _, _ ->
                NotificationHelper.openNotificationSettings(this)
                requestLocationPermissionsIfNeeded()
            }
            .setNegativeButton("Nanti") { _, _ ->
                requestLocationPermissionsIfNeeded()
            }
            .show()
    }

    private fun triggerTestNotification() {
        if (!NotificationHelper.areSystemNotificationsEnabled(this)) {
            hasShownNotifDialogThisResume = false
            showNotificationPermissionFallbackDialog()
            return
        }

        val nowStr = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        val sampleTicket = allTickets.firstOrNull()
        val testItem = if (sampleTicket != null) {
            NotificationItem(
                id = "test_notif_${System.currentTimeMillis()}",
                type = "new_internal_note",
                title = "Chat Tim #${sampleTicket.ticketNumber} • NOC Dispatcher",
                message = "Notifikasi Status Bar, Panel Drawer, dan Pop-up Heads-Up aktif untuk tiket \"${sampleTicket.title}\".",
                ticketId = sampleTicket.id,
                ticketNumber = sampleTicket.ticketNumber,
                ticketTitle = sampleTicket.title,
                ticketStatus = sampleTicket.status,
                ticketPriority = sampleTicket.priority,
                ticketType = sampleTicket.ticketType,
                reporterName = sampleTicket.reporterName,
                reporterPhone = sampleTicket.reporterPhone,
                reporterAddress = sampleTicket.reporterAddress,
                reporterMapUrl = sampleTicket.reporterMapUrl,
                ticketDescription = sampleTicket.description,
                isRead = false,
                createdAt = nowStr
            )
        } else {
            NotificationItem(
                id = "test_notif_${System.currentTimeMillis()}",
                type = "new_internal_note",
                title = "Notifikasi HelpDesk Teknisi Aktif",
                message = "Status Bar, Panel Notifikasi, dan Pop-up Heads-Up telah aktif dan siap menerima pesan Chat Tim & Tiket.",
                ticketId = null,
                ticketNumber = 0,
                ticketTitle = "",
                ticketStatus = "assigned",
                ticketPriority = "medium",
                ticketType = null,
                reporterName = null,
                reporterPhone = null,
                reporterAddress = null,
                reporterMapUrl = null,
                ticketDescription = null,
                isRead = false,
                createdAt = nowStr
            )
        }

        NotificationHelper.dispatchCustomNotification(this, session, testItem)
        Toast.makeText(this, "Notifikasi Status Bar, Drawer & Pop-up dikirim!", Toast.LENGTH_SHORT).show()
    }

    private fun startTrackingService() {
        val intent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        updateDutyUi(true)
    }

    private fun stopTrackingService() {
        val intent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP
        }
        startService(intent)
        updateDutyUi(false)
    }

    private fun updateDutyUi(isActive: Boolean) {
        if (isActive && session.activeTicketsCount > 0) {
            tvDutyStatus.text = "GPS Aktif"
            if (session.lastLatitude != 0.0 && session.lastLongitude != 0.0) {
                tvGpsCoords.text = String.format(
                    Locale.US,
                    "%.13f, %.13f",
                    session.lastLatitude,
                    session.lastLongitude
                )
            } else {
                tvGpsCoords.text = "Mencari titik koordinat..."
            }
        } else {
            tvDutyStatus.text = "GPS Nonaktif"
            tvGpsCoords.text = "Tidak ada tiket aktif"
        }
    }

    @Suppress("UNUSED_PARAMETER")
    private fun updateGpsDisplay(lat: Double, lng: Double, acc: Float, battery: Int, time: Long) {
        if (session.activeTicketsCount > 0 && lat != 0.0 && lng != 0.0) {
            tvDutyStatus.text = "GPS Aktif"
            tvGpsCoords.text = String.format(Locale.US, "%.13f, %.13f", lat, lng)
        } else {
            updateDutyUi(session.activeTicketsCount > 0)
        }
    }

    /**
     * Parses an ISO-8601 or formatted timestamp string into a Date object.
     */
    private fun parseTicketTimestamp(raw: String?): Date? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        val patterns = arrayOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            "yyyy-MM-dd'T'HH:mm:ssX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd HH:mm",
            "yyyy-MM-dd"
        )
        for (p in patterns) {
            try {
                val sdf = SimpleDateFormat(p, Locale.US)
                if (p.endsWith("'Z'")) {
                    sdf.timeZone = TimeZone.getTimeZone("UTC")
                }
                val parsed = sdf.parse(trimmed)
                if (parsed != null) return parsed
            } catch (_: Exception) {}
        }
        return null
    }

    /**
     * Computes:
     * 1. Number of tickets resolved/closed TODAY (WIB)
     * 2. Weekly timeline ticket counts for Senin (0), Selasa (1), Rabu (2), Kamis (3), Jumat (4), Sabtu (5)
     *    in the current week. If there is no data on a day, its value is 0 and the chart line drops to 0.
     */
    private fun computeDashboardMetrics(tickets: List<TicketItem>): Pair<Int, IntArray> {
        val wibTz = TimeZone.getTimeZone("Asia/Jakarta")
        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = wibTz
        }
        val nowCal = Calendar.getInstance(wibTz)
        val todayKey = dayFmt.format(nowCal.time)

        // Compute Monday 00:00:00.000 of the current week (WIB)
        val mondayCal = (nowCal.clone() as Calendar).apply {
            firstDayOfWeek = Calendar.MONDAY
            val dow = get(Calendar.DAY_OF_WEEK)
            val diffToMonday = if (dow == Calendar.SUNDAY) -6 else (Calendar.MONDAY - dow)
            add(Calendar.DAY_OF_YEAR, diffToMonday)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val sundayEndCal = (mondayCal.clone() as Calendar).apply {
            add(Calendar.DAY_OF_YEAR, 6)
            set(Calendar.HOUR_OF_DAY, 23)
            set(Calendar.MINUTE, 59)
            set(Calendar.SECOND, 59)
            set(Calendar.MILLISECOND, 999)
        }

        var resolvedTodayCount = 0
        val weeklyCounts = IntArray(6) { 0 } // Senin, Selasa, Rabu, Kamis, Jumat, Sabtu

        for (t in tickets) {
            val statusLower = t.status.lowercase(Locale.ROOT)
            if (statusLower == "cancelled") continue

            val eventDate = parseTicketTimestamp(t.updatedAt) ?: parseTicketTimestamp(t.createdAt)
            if (eventDate != null) {
                val eventDayKey = dayFmt.format(eventDate)
                val isResolvedOrClosed = statusLower == "resolved" || statusLower == "closed"
                if (isResolvedOrClosed && eventDayKey == todayKey) {
                    resolvedTodayCount++
                }

                // Count tickets worked on / handled during the current week (Monday..Sunday)
                if (eventDate.time in mondayCal.timeInMillis..sundayEndCal.timeInMillis) {
                    val tCal = Calendar.getInstance(wibTz).apply { time = eventDate }
                    val dayIndex = when (tCal.get(Calendar.DAY_OF_WEEK)) {
                        Calendar.MONDAY -> 0
                        Calendar.TUESDAY -> 1
                        Calendar.WEDNESDAY -> 2
                        Calendar.THURSDAY -> 3
                        Calendar.FRIDAY -> 4
                        Calendar.SATURDAY, Calendar.SUNDAY -> 5
                        else -> -1
                    }
                    if (dayIndex in 0..5) {
                        weeklyCounts[dayIndex]++
                    }
                }
            }
        }

        return Pair(resolvedTodayCount, weeklyCounts)
    }

    private fun loadTickets(silent: Boolean = false) {
        if (!silent) swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            val token = session.token ?: return@launch
            val result = ApiClient.getTickets(session.serverUrl, token)
            if (!silent) swipeRefresh.isRefreshing = false

            result.onSuccess { tickets ->
                allTickets = tickets

                val activeCount = tickets.count { t ->
                    val s = t.status.lowercase()
                    s != "resolved" && s != "closed" && s != "cancelled"
                }

                val (resolvedTodayCount, weeklyCounts) = computeDashboardMetrics(tickets)
                latestWeeklyCounts = weeklyCounts

                tvCountActive.text = activeCount.toString()
                tvCountResolved.text = resolvedTodayCount.toString()
                chartWeeklyTimeline.setWeeklyCounts(weeklyCounts)

                session.activeTicketsCount = activeCount
                evaluateTrackingRules(activeCount)
                applyFiltersAndRender()

                val payload = NotificationHelper.syncAndDispatchNotifications(this@MainActivity, session, tickets)
                if (payload != null) {
                    cachedNotifications = payload.notifications
                    unreadNotifCount = payload.unreadCount
                    updateNotificationBadge(unreadNotifCount)
                }
            }.onFailure { err ->
                if (!silent) {
                    Toast.makeText(this@MainActivity, "Gagal memuat tiket: ${err.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /**
     * Strictly enforces the rule: GPS is ONLY active when activeCount > 0.
     * When activeCount <= 0, GPS automatically turns OFF.
     */
    private fun evaluateTrackingRules(activeCount: Int) {
        if (TrackingScheduleManager.isTrackingMandatory(activeCount)) {
            session.isDutyActive = true
            updateDutyUi(true)
            if (hasLocationPermission()) {
                startTrackingService()
            }
        } else {
            session.isDutyActive = false
            stopTrackingService()
        }
    }

    private fun loadUserProfile() {
        lifecycleScope.launch {
            val token = session.token ?: return@launch
            ApiClient.getMe(session.serverUrl, token).onSuccess { profile ->
                session.userId = profile.id
                session.userName = profile.name
                session.userEmail = profile.email
                session.userRole = profile.role
                tvTechnicianName.text = profile.name
                tvTechnicianRole.text = "Teknisi"
            }
        }
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle("Keluar Aplikasi")
            .setMessage("Apakah Anda yakin ingin keluar dari akun teknisi?")
            .setPositiveButton("Keluar") { _, _ ->
                session.activeTicketsCount = 0
                val logoutIntent = Intent(this, LocationTrackingService::class.java).apply {
                    action = LocationTrackingService.ACTION_LOGOUT
                }
                startService(logoutIntent)
                session.logout()
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        evaluateTrackingRules(session.activeTicketsCount)
        val filter = IntentFilter().apply {
            addAction(LocationTrackingService.ACTION_LOCATION_UPDATED)
            addAction(NotificationHelper.ACTION_NOTIFICATION_SYNCED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(systemEventReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(systemEventReceiver, filter)
        }

        syncNotificationsNow()

        // Start 6s real-time ticket & notification sync while screen is active
        realtimePollJob?.cancel()
        realtimePollJob = lifecycleScope.launch {
            while (isActive) {
                delay(6_000L)
                loadTickets(silent = true)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        realtimePollJob?.cancel()
        realtimePollJob = null
        try {
            unregisterReceiver(systemEventReceiver)
        } catch (e: Exception) {}
    }
}
