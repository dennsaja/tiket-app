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
import com.google.android.material.switchmaterial.SwitchMaterial
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

    private lateinit var tvTechnicianName: TextView
    private lateinit var btnNotificationBell: FrameLayout
    private lateinit var tvNotificationBadge: TextView
    private lateinit var btnRefreshTop: ImageButton
    private lateinit var btnLogout: ImageButton

    // In-App Heads-Up Notification Pop-up Banner
    private lateinit var cardHeadsUpBanner: CardView
    private lateinit var tvHeadsUpCategory: TextView
    private lateinit var tvHeadsUpTitle: TextView
    private lateinit var tvHeadsUpMessage: TextView
    private lateinit var btnHeadsUpOpen: MaterialButton
    private lateinit var btnHeadsUpDismiss: ImageButton
    private var currentHeadsUpNotif: NotificationItem? = null
    private var headsUpAutoHideJob: Job? = null

    // GPS Bar
    private lateinit var viewGpsDot: View
    private lateinit var tvDutyStatus: TextView
    private lateinit var switchDuty: SwitchMaterial
    private lateinit var tvGpsCoords: TextView
    private lateinit var tvLastUpdated: TextView
    private lateinit var btnForceLocation: MaterialButton

    // KPI Filter Cards
    private lateinit var cardFilterAll: LinearLayout
    private lateinit var cardFilterActive: LinearLayout
    private lateinit var cardFilterResolved: LinearLayout
    private lateinit var tvFilterAllLabel: TextView
    private lateinit var tvFilterActiveLabel: TextView
    private lateinit var tvFilterResolvedLabel: TextView
    private lateinit var tvCountAll: TextView
    private lateinit var tvCountActive: TextView
    private lateinit var tvCountResolved: TextView

    private lateinit var etSearchTickets: EditText
    private lateinit var tvTicketCount: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTickets: RecyclerView
    private lateinit var tvEmptyState: TextView

    private lateinit var ticketAdapter: TicketAdapter
    private var allTickets = listOf<TicketItem>()
    private var cachedNotifications = listOf<NotificationItem>()
    private var unreadNotifCount = 0
    private var selectedFilterIndex = 0 // 0 = All, 1 = Active, 2 = Resolved
    private var searchQuery = ""
    private var realtimePollJob: Job? = null

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
            if (session.isDutyActive) {
                startTrackingService()
            }
        } else {
            Toast.makeText(
                this,
                "Izin lokasi GPS diperlukan untuk pelacakan tugas lapangan",
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

        if (TrackingScheduleManager.isTrackingMandatory(session.activeTicketsCount)) {
            session.isDutyActive = true
            switchDuty.isChecked = true
        }

        if (session.isDutyActive && hasLocationPermission()) {
            startTrackingService()
        } else {
            updateDutyUi(session.isDutyActive)
        }

        loadTickets(silent = false)
        loadUserProfile()
    }

    private fun initViews() {
        tvTechnicianName = findViewById(R.id.tvTechnicianName)
        btnNotificationBell = findViewById(R.id.btnNotificationBell)
        tvNotificationBadge = findViewById(R.id.tvNotificationBadge)
        btnRefreshTop = findViewById(R.id.btnRefreshTop)
        btnLogout = findViewById(R.id.btnLogout)

        cardHeadsUpBanner = findViewById(R.id.cardHeadsUpBanner)
        tvHeadsUpCategory = findViewById(R.id.tvHeadsUpCategory)
        tvHeadsUpTitle = findViewById(R.id.tvHeadsUpTitle)
        tvHeadsUpMessage = findViewById(R.id.tvHeadsUpMessage)
        btnHeadsUpOpen = findViewById(R.id.btnHeadsUpOpen)
        btnHeadsUpDismiss = findViewById(R.id.btnHeadsUpDismiss)

        viewGpsDot = findViewById(R.id.viewGpsDot)
        tvDutyStatus = findViewById(R.id.tvDutyStatus)
        switchDuty = findViewById(R.id.switchDuty)
        tvGpsCoords = findViewById(R.id.tvGpsCoords)
        tvLastUpdated = findViewById(R.id.tvLastUpdated)
        btnForceLocation = findViewById(R.id.btnForceLocation)

        cardFilterAll = findViewById(R.id.cardFilterAll)
        cardFilterActive = findViewById(R.id.cardFilterActive)
        cardFilterResolved = findViewById(R.id.cardFilterResolved)
        tvFilterAllLabel = findViewById(R.id.tvFilterAllLabel)
        tvFilterActiveLabel = findViewById(R.id.tvFilterActiveLabel)
        tvFilterResolvedLabel = findViewById(R.id.tvFilterResolvedLabel)
        tvCountAll = findViewById(R.id.tvCountAll)
        tvCountActive = findViewById(R.id.tvCountActive)
        tvCountResolved = findViewById(R.id.tvCountResolved)

        etSearchTickets = findViewById(R.id.etSearchTickets)
        tvTicketCount = findViewById(R.id.tvTicketCount)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        rvTickets = findViewById(R.id.rvTickets)
        tvEmptyState = findViewById(R.id.tvEmptyState)

        tvTechnicianName.text = session.userName

        btnNotificationBell.setOnClickListener {
            showNotificationDrawerDialog()
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

        switchDuty.isChecked = session.isDutyActive
        switchDuty.setOnCheckedChangeListener { _, isChecked ->
            if (!isChecked && TrackingScheduleManager.isTrackingMandatory(session.activeTicketsCount)) {
                switchDuty.isChecked = true
                Toast.makeText(
                    this,
                    TrackingScheduleManager.getLockedReasonMessage(),
                    Toast.LENGTH_LONG
                ).show()
                return@setOnCheckedChangeListener
            }

            session.isDutyActive = isChecked
            updateDutyUi(isChecked)
            if (isChecked) {
                checkAndRequestPermissions()
                startTrackingService()
            } else {
                stopTrackingService()
            }
        }

        btnForceLocation.setOnClickListener {
            if (!session.isDutyActive) {
                switchDuty.isChecked = true
            } else {
                val forceIntent = Intent(this, LocationTrackingService::class.java).apply {
                    action = LocationTrackingService.ACTION_FORCE_PING
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(forceIntent)
                } else {
                    startService(forceIntent)
                }
                Toast.makeText(this, "Mengirim ping lokasi GPS sekarang...", Toast.LENGTH_SHORT).show()
            }
        }

        btnRefreshTop.setOnClickListener {
            loadTickets(silent = false)
            loadUserProfile()
            syncNotificationsNow()
        }

        swipeRefresh.setOnRefreshListener {
            loadTickets(silent = false)
            loadUserProfile()
            syncNotificationsNow()
        }

        btnLogout.setOnClickListener {
            confirmLogout()
        }

        cardFilterAll.setOnClickListener { selectFilter(0) }
        cardFilterActive.setOnClickListener { selectFilter(1) }
        cardFilterResolved.setOnClickListener { selectFilter(2) }

        etSearchTickets.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.trim() ?: ""
                applyFiltersAndRender()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        if (session.lastLatitude != 0.0) {
            updateGpsDisplay(
                session.lastLatitude,
                session.lastLongitude,
                session.lastAccuracy,
                -1,
                session.lastUpdateTime
            )
        }
    }

    private fun updateNotificationBadge(count: Int) {
        if (count > 0) {
            tvNotificationBadge.visibility = View.VISIBLE
            tvNotificationBadge.text = if (count > 99) "99+" else count.toString()
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

        // Top Header Bar (#09090B dark header matching Web)
        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#09090B"))
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
            setTextColor(Color.parseColor("#A1A1AA"))
            textSize = 11f
        }
        titleCol.addView(tvHeaderTitle)
        titleCol.addView(tvHeaderSub)
        headerRow.addView(titleCol)

        var dialogRef: AlertDialog? = null

        val btnTestNotif = TextView(this).apply {
            text = "Tes Pop-up"
            setTextColor(Color.parseColor("#34D399"))
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
                setTextColor(Color.parseColor("#38BDF8"))
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

                // Top meta row: Unread dot + Category badge + Ticket #
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
                        setTypeface( Typeface.MONOSPACE, Typeface.BOLD)
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

        cardFilterAll.setBackgroundResource(if (index == 0) R.drawable.card_active_bg else R.drawable.card_border_bg)
        tvFilterAllLabel.setTextColor(Color.parseColor(if (index == 0) "#A1A1AA" else "#71717A"))
        tvCountAll.setTextColor(Color.parseColor(if (index == 0) "#FFFFFF" else "#09090B"))

        cardFilterActive.setBackgroundResource(if (index == 1) R.drawable.card_active_bg else R.drawable.card_border_bg)
        tvFilterActiveLabel.setTextColor(Color.parseColor(if (index == 1) "#A1A1AA" else "#71717A"))
        tvCountActive.setTextColor(Color.parseColor(if (index == 1) "#FFFFFF" else "#09090B"))

        cardFilterResolved.setBackgroundResource(if (index == 2) R.drawable.card_active_bg else R.drawable.card_border_bg)
        tvFilterResolvedLabel.setTextColor(Color.parseColor(if (index == 2) "#A1A1AA" else "#71717A"))
        tvCountResolved.setTextColor(Color.parseColor(if (index == 2) "#FFFFFF" else "#16A34A"))

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
        tvTicketCount.text = "${filtered.size} Tiket"

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
        } else if (session.isDutyActive) {
            startTrackingService()
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
        if (isActive) {
            viewGpsDot.setBackgroundResource(R.drawable.circle_green)
            tvDutyStatus.text = "GPS Aktif (Interval 1 Menit • Hemat Daya)"
        } else {
            viewGpsDot.setBackgroundResource(R.drawable.circle_red)
            tvDutyStatus.text = "GPS Nonaktif (Di Luar Jam Tugas)"
            tvGpsCoords.text = "GPS: Pelacakan Nonaktif"
        }
    }

    private fun updateGpsDisplay(lat: Double, lng: Double, acc: Float, battery: Int, time: Long) {
        val accStr = if (acc > 0) " (±${acc.toInt()}m)" else ""
        tvGpsCoords.text = String.format(Locale.US, "%.5f, %.5f%s", lat, lng, accStr)

        val timeStr = if (time > 0) {
            val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
            sdf.format(Date(time))
        } else "-"

        val batStr = if (battery >= 0) " • Bat $battery%" else ""
        tvLastUpdated.text = "• $timeStr$batStr"
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
                val resolvedCount = tickets.size - activeCount

                tvCountAll.text = tickets.size.toString()
                tvCountActive.text = activeCount.toString()
                tvCountResolved.text = resolvedCount.toString()

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

    private fun evaluateTrackingRules(activeCount: Int) {
        if (TrackingScheduleManager.isTrackingMandatory(activeCount)) {
            if (!session.isDutyActive) {
                session.isDutyActive = true
                switchDuty.isChecked = true
                if (hasLocationPermission()) {
                    startTrackingService()
                }
            }
        } else if (TrackingScheduleManager.shouldAutoTurnOff(activeCount)) {
            if (session.isDutyActive) {
                session.isDutyActive = false
                switchDuty.isChecked = false
                stopTrackingService()
            }
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
