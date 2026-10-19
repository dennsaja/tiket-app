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
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
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
import net.infinityteknik.helpdesk.data.OfflineActionItem
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import net.infinityteknik.helpdesk.service.LocationTrackingService
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import net.infinityteknik.helpdesk.util.TrackingScheduleManager
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var session: SessionManager

    // Global Offline Sync Banner (FR-24)
    private lateinit var layoutOfflineSyncBanner: LinearLayout
    private lateinit var tvOfflineSyncStatus: TextView
    private lateinit var btnFlushSyncNow: TextView

    // 5 Main Tab Views
    private lateinit var viewBottomTabHome: LinearLayout
    private lateinit var viewBottomTabTasks: LinearLayout
    private lateinit var viewBottomTabMap: LinearLayout
    private lateinit var viewBottomTabHistory: LinearLayout
    private lateinit var viewBottomTabProfile: ScrollView

    // Bottom Navigation Views
    private lateinit var navTabHome: LinearLayout
    private lateinit var navTabTasks: LinearLayout
    private lateinit var navTabMap: LinearLayout
    private lateinit var navTabHistory: LinearLayout
    private lateinit var navTabProfile: LinearLayout
    private lateinit var ivNavHome: ImageView
    private lateinit var ivNavTasks: ImageView
    private lateinit var ivNavMap: ImageView
    private lateinit var ivNavHistory: ImageView
    private lateinit var ivNavProfile: ImageView
    private lateinit var tvNavLabelHome: TextView
    private lateinit var tvNavLabelTasks: TextView
    private lateinit var tvNavLabelMap: TextView
    private lateinit var tvNavLabelHistory: TextView
    private lateinit var tvNavLabelProfile: TextView
    private var currentBottomTab = 0

    // Top Blue Hero Dashboard Views (Tab 1: Beranda)
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

    // Workflow Pipeline Chips + Search & Filter Reset Row + Ticket List (Tab 1: Beranda)
    private lateinit var chipHomeWfAll: TextView
    private lateinit var chipHomeWfAssigned: TextView
    private lateinit var chipHomeWfEnRoute: TextView
    private lateinit var chipHomeWfOnSite: TextView
    private lateinit var chipHomeWfWorking: TextView
    private var homeWorkflowStage = "all" // all, assigned, accepted, on_site, in_progress
    private lateinit var cardFilterAll: LinearLayout
    private lateinit var etSearchTickets: EditText
    private lateinit var tvTicketCount: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTickets: RecyclerView
    private lateinit var tvEmptyState: TextView

    // Tab 2: Tugas (Full Filter & Sort)
    private lateinit var tvTasksTabSubtitle: TextView
    private lateinit var btnSortTasksTab: TextView
    private lateinit var etSearchTasksTab: EditText
    private lateinit var chipTaskTabAll: TextView
    private lateinit var chipTaskTabNew: TextView
    private lateinit var chipTaskTabRunning: TextView
    private lateinit var chipTaskTabPending: TextView
    private lateinit var chipTaskTabDone: TextView
    private lateinit var rvTasksTab: RecyclerView
    private var tasksTabFilterStatus = "all" // all, new, active, pending, done
    private var tasksTabSortMode = 0 // 0 = Prioritas, 1 = Jarak Terdekat, 2 = Jadwal / SLA
    private var tasksTabSearchQuery = ""

    // Tab 3: Peta (Interactive Field Map)
    private lateinit var tvMapHeaderStats: TextView
    private lateinit var btnMapHeaderSyncGps: LinearLayout
    private lateinit var btnMapRecenter: LinearLayout
    private lateinit var btnMapZoomIn: MaterialButton
    private lateinit var btnMapZoomOut: MaterialButton
    private lateinit var fieldMapView: FieldTechnicianMapView
    private lateinit var cardMapSelectedTicket: CardView
    private lateinit var tvMapPreviewTitle: TextView
    private lateinit var tvMapPreviewDistance: TextView
    private lateinit var tvMapPreviewAddress: TextView
    private lateinit var btnMapOpenNavigate: MaterialButton
    private lateinit var btnMapOpenDetail: MaterialButton
    private var selectedMapTicket: TicketItem? = null

    // Tab 4: Riwayat & Performa
    private lateinit var tvHistoryStatToday: TextView
    private lateinit var tvHistoryStatWeek: TextView
    private lateinit var tvHistoryStatTotal: TextView
    private lateinit var chipHistoryAll: TextView
    private lateinit var chipHistoryToday: TextView
    private lateinit var chipHistoryWeek: TextView
    private lateinit var rvHistoryTab: RecyclerView
    private var historyPeriodFilter = 0 // 0 = Semua, 1 = Hari Ini, 2 = Minggu Ini

    // Tab 5: Profil & Pengaturan
    private lateinit var tvProfileFullName: TextView
    private lateinit var tvProfileEmail: TextView
    private lateinit var tvProfileVersion: TextView
    private lateinit var tvProfileTrackingDetails: TextView
    private lateinit var btnProfilePingGps: MaterialButton
    private lateinit var btnProfileSyncQueue: MaterialButton
    private lateinit var tvProfilePermissionsStatus: TextView
    private lateinit var btnBatteryOptimizationGuide: MaterialButton
    private lateinit var btnProfileContactDispatcher: MaterialButton
    private lateinit var btnProfileLogout: MaterialButton

    private lateinit var homeTicketAdapter: TicketAdapter
    private lateinit var tasksTabAdapter: TicketAdapter
    private lateinit var historyTabAdapter: TicketAdapter

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
        refreshOfflineBannerAndProfile()
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
        refreshOfflineBannerAndProfile()
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
        refreshOfflineBannerAndProfile()
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
                    fieldMapView.setMapData(lat, lng, allTickets, selectedMapTicket?.id)
                    refreshOfflineBannerAndProfile()
                }
                OfflineSyncManager.ACTION_SYNC_STATE_CHANGED -> {
                    refreshOfflineBannerAndProfile()
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
        setupRecyclerViews()
        setupBottomNavigation()

        // Load offline cached tickets immediately so UI is responsive even offline (FR-23)
        val cachedTickets = OfflineSyncManager.getCachedTickets(this)
        if (cachedTickets.isNotEmpty()) {
            allTickets = cachedTickets
            renderAllTabsWithTickets(cachedTickets)
        }

        cachedNotifications = session.getLocalNotifications()
        unreadNotifCount = cachedNotifications.count { !it.isRead }
        updateNotificationBadge(unreadNotifCount)

        checkAndRequestPermissions()

        // Rule: GPS is ONLY active when there are active unfinished tickets
        evaluateTrackingRules(session.activeTicketsCount)

        loadTickets(silent = false)
        loadUserProfile()
        refreshOfflineBannerAndProfile()
    }

    private fun initViews() {
        layoutOfflineSyncBanner = findViewById(R.id.layoutOfflineSyncBanner)
        tvOfflineSyncStatus = findViewById(R.id.tvOfflineSyncStatus)
        btnFlushSyncNow = findViewById(R.id.btnFlushSyncNow)

        viewBottomTabHome = findViewById(R.id.viewBottomTabHome)
        viewBottomTabTasks = findViewById(R.id.viewBottomTabTasks)
        viewBottomTabMap = findViewById(R.id.viewBottomTabMap)
        viewBottomTabHistory = findViewById(R.id.viewBottomTabHistory)
        viewBottomTabProfile = findViewById(R.id.viewBottomTabProfile)

        navTabHome = findViewById(R.id.navTabHome)
        navTabTasks = findViewById(R.id.navTabTasks)
        navTabMap = findViewById(R.id.navTabMap)
        navTabHistory = findViewById(R.id.navTabHistory)
        navTabProfile = findViewById(R.id.navTabProfile)
        ivNavHome = findViewById(R.id.ivNavHome)
        ivNavTasks = findViewById(R.id.ivNavTasks)
        ivNavMap = findViewById(R.id.ivNavMap)
        ivNavHistory = findViewById(R.id.ivNavHistory)
        ivNavProfile = findViewById(R.id.ivNavProfile)
        tvNavLabelHome = findViewById(R.id.tvNavLabelHome)
        tvNavLabelTasks = findViewById(R.id.tvNavLabelTasks)
        tvNavLabelMap = findViewById(R.id.tvNavLabelMap)
        tvNavLabelHistory = findViewById(R.id.tvNavLabelHistory)
        tvNavLabelProfile = findViewById(R.id.tvNavLabelProfile)

        // Tab 1: Beranda Views
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

        chipHomeWfAll = findViewById(R.id.chipHomeWfAll)
        chipHomeWfAssigned = findViewById(R.id.chipHomeWfAssigned)
        chipHomeWfEnRoute = findViewById(R.id.chipHomeWfEnRoute)
        chipHomeWfOnSite = findViewById(R.id.chipHomeWfOnSite)
        chipHomeWfWorking = findViewById(R.id.chipHomeWfWorking)

        cardFilterAll = findViewById(R.id.cardFilterAll)
        etSearchTickets = findViewById(R.id.etSearchTickets)
        tvTicketCount = findViewById(R.id.tvTicketCount)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        rvTickets = findViewById(R.id.rvTickets)
        tvEmptyState = findViewById(R.id.tvEmptyState)

        // Tab 2: Tugas Views
        tvTasksTabSubtitle = findViewById(R.id.tvTasksTabSubtitle)
        btnSortTasksTab = findViewById(R.id.btnSortTasksTab)
        etSearchTasksTab = findViewById(R.id.etSearchTasksTab)
        chipTaskTabAll = findViewById(R.id.chipTaskTabAll)
        chipTaskTabNew = findViewById(R.id.chipTaskTabNew)
        chipTaskTabRunning = findViewById(R.id.chipTaskTabRunning)
        chipTaskTabPending = findViewById(R.id.chipTaskTabPending)
        chipTaskTabDone = findViewById(R.id.chipTaskTabDone)
        rvTasksTab = findViewById(R.id.rvTasksTab)

        // Tab 3: Peta Views
        tvMapHeaderStats = findViewById(R.id.tvMapHeaderStats)
        btnMapHeaderSyncGps = findViewById(R.id.btnMapHeaderSyncGps)
        btnMapRecenter = findViewById(R.id.btnMapRecenter)
        btnMapZoomIn = findViewById(R.id.btnMapZoomIn)
        btnMapZoomOut = findViewById(R.id.btnMapZoomOut)
        fieldMapView = findViewById(R.id.fieldMapView)
        cardMapSelectedTicket = findViewById(R.id.cardMapSelectedTicket)
        tvMapPreviewTitle = findViewById(R.id.tvMapPreviewTitle)
        tvMapPreviewDistance = findViewById(R.id.tvMapPreviewDistance)
        tvMapPreviewAddress = findViewById(R.id.tvMapPreviewAddress)
        btnMapOpenNavigate = findViewById(R.id.btnMapOpenNavigate)
        btnMapOpenDetail = findViewById(R.id.btnMapOpenDetail)

        // Tab 4: Riwayat Views
        tvHistoryStatToday = findViewById(R.id.tvHistoryStatToday)
        tvHistoryStatWeek = findViewById(R.id.tvHistoryStatWeek)
        tvHistoryStatTotal = findViewById(R.id.tvHistoryStatTotal)
        chipHistoryAll = findViewById(R.id.chipHistoryAll)
        chipHistoryToday = findViewById(R.id.chipHistoryToday)
        chipHistoryWeek = findViewById(R.id.chipHistoryWeek)
        rvHistoryTab = findViewById(R.id.rvHistoryTab)

        // Tab 5: Profil Views
        tvProfileFullName = findViewById(R.id.tvProfileFullName)
        tvProfileEmail = findViewById(R.id.tvProfileEmail)
        tvProfileVersion = findViewById(R.id.tvProfileVersion)
        tvProfileTrackingDetails = findViewById(R.id.tvProfileTrackingDetails)
        btnProfilePingGps = findViewById(R.id.btnProfilePingGps)
        btnProfileSyncQueue = findViewById(R.id.btnProfileSyncQueue)
        tvProfilePermissionsStatus = findViewById(R.id.tvProfilePermissionsStatus)
        btnBatteryOptimizationGuide = findViewById(R.id.btnBatteryOptimizationGuide)
        btnProfileContactDispatcher = findViewById(R.id.btnProfileContactDispatcher)
        btnProfileLogout = findViewById(R.id.btnProfileLogout)

        tvTechnicianName.text = session.userName ?: "Teknisi"
        tvTechnicianRole.text = "Teknisi"
        chartWeeklyTimeline.setWeeklyCounts(latestWeeklyCounts)

        // Offline Banner Action
        btnFlushSyncNow.setOnClickListener {
            flushOfflineQueuesManual()
        }

        // Tab 1 Listeners
        cardProfileAvatar.setOnClickListener {
            selectBottomTab(4)
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
        chipHomeWfAll.setOnClickListener { setHomeWorkflowChip("all") }
        chipHomeWfAssigned.setOnClickListener { setHomeWorkflowChip("assigned") }
        chipHomeWfEnRoute.setOnClickListener { setHomeWorkflowChip("accepted") }
        chipHomeWfOnSite.setOnClickListener { setHomeWorkflowChip("on_site") }
        chipHomeWfWorking.setOnClickListener { setHomeWorkflowChip("in_progress") }

        cardFilterAll.setOnClickListener {
            homeWorkflowStage = "all"
            updateHomeWorkflowChipStyles()
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

        // Tab 2 (Tugas) Listeners
        btnSortTasksTab.setOnClickListener {
            val sortOptions = arrayOf(
                "Urutkan: Prioritas Tertinggi",
                "Urutkan: Jarak Terdekat (GPS)",
                "Urutkan: Jadwal / Target SLA Terdekat"
            )
            AlertDialog.Builder(this)
                .setTitle("Urutkan Daftar Tugas")
                .setSingleChoiceItems(sortOptions, tasksTabSortMode) { d, which ->
                    tasksTabSortMode = which
                    btnSortTasksTab.text = when (which) {
                        1 -> "Urut: Jarak"
                        2 -> "Urut: SLA"
                        else -> "Urut: Prioritas"
                    }
                    renderTasksTab()
                    d.dismiss()
                }
                .show()
        }
        etSearchTasksTab.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                tasksTabSearchQuery = s?.toString()?.trim() ?: ""
                renderTasksTab()
            }
            override fun afterTextChanged(s: Editable?) {}
        })
        chipTaskTabAll.setOnClickListener { setTasksTabStatusChip("all") }
        chipTaskTabNew.setOnClickListener { setTasksTabStatusChip("new") }
        chipTaskTabRunning.setOnClickListener { setTasksTabStatusChip("active") }
        chipTaskTabPending.setOnClickListener { setTasksTabStatusChip("pending") }
        chipTaskTabDone.setOnClickListener { setTasksTabStatusChip("done") }

        // Tab 3 (Peta) Listeners
        btnMapHeaderSyncGps.setOnClickListener {
            handleGpsCardClick()
            loadTickets(silent = false)
        }
        btnMapRecenter.setOnClickListener {
            fieldMapView.recenterOnTechnician()
            Toast.makeText(this, "Peta dipusatkan ke posisi teknisi", Toast.LENGTH_SHORT).show()
        }
        btnMapZoomIn.setOnClickListener {
            fieldMapView.zoomIn()
        }
        btnMapZoomOut.setOnClickListener {
            fieldMapView.zoomOut()
        }
        fieldMapView.setOnTicketPinClickListener { ticket ->
            selectedMapTicket = ticket
            updateMapSelectedTicketCard(ticket)
        }
        btnMapOpenNavigate.setOnClickListener {
            val t = selectedMapTicket ?: return@setOnClickListener
            openExternalMapsForTicket(t)
        }
        btnMapOpenDetail.setOnClickListener {
            val t = selectedMapTicket ?: return@setOnClickListener
            openTicketDetail(t, initialTab = 0)
        }

        // Tab 4 (Riwayat) Listeners
        chipHistoryAll.setOnClickListener { setHistoryPeriodChip(0) }
        chipHistoryToday.setOnClickListener { setHistoryPeriodChip(1) }
        chipHistoryWeek.setOnClickListener { setHistoryPeriodChip(2) }

        // Tab 5 (Profil) Listeners
        btnProfilePingGps.setOnClickListener {
            handleGpsCardClick()
        }
        btnProfileSyncQueue.setOnClickListener {
            flushOfflineQueuesManual()
        }
        btnBatteryOptimizationGuide.setOnClickListener {
            showVendorBatteryOptimizationDialog()
        }
        btnProfileContactDispatcher.setOnClickListener {
            showSupportAndQuickChatDialog()
        }
        btnProfileLogout.setOnClickListener {
            confirmLogout()
        }

        updateDutyUi(session.activeTicketsCount > 0)
        if (session.lastLatitude != 0.0) {
            fieldMapView.setMapData(session.lastLatitude, session.lastLongitude, allTickets, null)
            if (session.activeTicketsCount > 0) {
                updateGpsDisplay(
                    session.lastLatitude,
                    session.lastLongitude,
                    session.lastAccuracy,
                    -1,
                    session.lastUpdateTime
                )
            }
        }
    }

    private fun setupBottomNavigation() {
        navTabHome.setOnClickListener { selectBottomTab(0) }
        navTabTasks.setOnClickListener { selectBottomTab(1) }
        navTabMap.setOnClickListener { selectBottomTab(2) }
        navTabHistory.setOnClickListener { selectBottomTab(3) }
        navTabProfile.setOnClickListener { selectBottomTab(4) }
        selectBottomTab(0)
    }

    private fun selectBottomTab(index: Int) {
        currentBottomTab = index
        viewBottomTabHome.visibility = if (index == 0) View.VISIBLE else View.GONE
        viewBottomTabTasks.visibility = if (index == 1) View.VISIBLE else View.GONE
        viewBottomTabMap.visibility = if (index == 2) View.VISIBLE else View.GONE
        viewBottomTabHistory.visibility = if (index == 3) View.VISIBLE else View.GONE
        viewBottomTabProfile.visibility = if (index == 4) View.VISIBLE else View.GONE

        val activeColor = Color.parseColor("#004C9E")
        val inactiveColor = Color.parseColor("#64748B")
        val labels = arrayOf(tvNavLabelHome, tvNavLabelTasks, tvNavLabelMap, tvNavLabelHistory, tvNavLabelProfile)
        val icons = arrayOf(ivNavHome, ivNavTasks, ivNavMap, ivNavHistory, ivNavProfile)

        for (i in 0..4) {
            val isSelected = i == index
            labels[i].setTextColor(if (isSelected) activeColor else inactiveColor)
            labels[i].setTypeface(null, if (isSelected) Typeface.BOLD else Typeface.NORMAL)
            icons[i].setColorFilter(if (isSelected) activeColor else inactiveColor)
        }

        when (index) {
            1 -> renderTasksTab()
            2 -> renderMapTab()
            3 -> renderHistoryTab()
            4 -> refreshOfflineBannerAndProfile()
        }
    }

    private fun refreshOfflineBannerAndProfile() {
        val pendingActions = OfflineSyncManager.getQueuedActions(this).size
        val pendingGps = OfflineSyncManager.getBufferedGpsPoints(this).size
        val totalPending = pendingActions + pendingGps

        if (totalPending > 0) {
            layoutOfflineSyncBanner.visibility = View.VISIBLE
            tvOfflineSyncStatus.text =
                "Antrean Offline: $pendingActions laporan/status • $pendingGps titik GPS menunggu sinkronisasi"
        } else {
            layoutOfflineSyncBanner.visibility = View.GONE
        }

        // Update Profile Tab views
        tvProfileFullName.text = session.userName ?: "Teknisi Lapangan"
        tvProfileEmail.text = "${session.userEmail ?: "-"} • ${session.userRole?.uppercase() ?: "TEKNISI"}"
        tvProfileVersion.text = "HelpDesk Teknisi v2.1.0 (Build 8) • ${session.serverUrl}"

        val gpsStatusLine = if (session.activeTicketsCount > 0) {
            val lastCoord = if (session.lastLatitude != 0.0) {
                String.format(Locale.US, "%.6f, %.6f (+/-%.0fm)", session.lastLatitude, session.lastLongitude, session.lastAccuracy)
            } else {
                "Mencari sinyal satelit..."
            }
            "[AKTIF] Status GPS: AKTIF (${session.activeTicketsCount} Tiket Belum Selesai)\n" +
                "• Koordinat Terakhir: $lastCoord\n" +
                "• Interval Hemat Daya: 1 Menit (Anti Panas)\n"
        } else {
            "[SIAGA] Status GPS: NONAKTIF (0 Tiket Aktif)\n" +
                "• GPS otomatis berhenti saat semua tiket selesai untuk menghemat baterai.\n"
        }

        val lastSyncMs = OfflineSyncManager.getLastSyncTime(this)
        val lastSyncStr = if (lastSyncMs > 0L) {
            SimpleDateFormat("dd MMM HH:mm:ss", Locale.getDefault()).format(Date(lastSyncMs))
        } else "Belum pernah"

        tvProfileTrackingDetails.text = gpsStatusLine +
            "• Buffer Lokasi Offline: $pendingGps titik GPS\n" +
            "• Antrean Status/Laporan Offline: $pendingActions item\n" +
            "• Sinkronisasi Terakhir: $lastSyncStr"

        // Permission checklist (No emojis, clean status tags)
        val locOk = hasLocationPermission()
        val notifOk = NotificationHelper.areSystemNotificationsEnabled(this)
        val camOk = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val batteryUnrestricted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm?.isIgnoringBatteryOptimizations(packageName) == true
        } else true

        val sb = StringBuilder()
        sb.append(if (locOk) "[AKTIF] " else "[PERLU IZIN] ").append("Izin Lokasi GPS Presisi: ").append(if (locOk) "Diizinkan\n" else "Belum Diizinkan\n")
        sb.append(if (notifOk) "[AKTIF] " else "[PERLU IZIN] ").append("Izin Notifikasi Tugas & Chat: ").append(if (notifOk) "Diizinkan\n" else "Belum Diizinkan\n")
        sb.append(if (camOk) "[AKTIF] " else "[SIAP] ").append("Izin Kamera Dokumentasi & Barcode: ").append(if (camOk) "Diizinkan\n" else "Diminta saat foto\n")
        sb.append(if (batteryUnrestricted) "[AKTIF] " else "[SARAN] ").append("Pengecualian Optimasi Baterai Background: ").append(if (batteryUnrestricted) "Aktif (Tanpa Pembatasan)" else "Disarankan Diaktifkan")
        tvProfilePermissionsStatus.text = sb.toString()
    }

    private fun flushOfflineQueuesManual() {
        Toast.makeText(this, "Menyinkronkan antrean offline ke server...", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            val flushedCount = OfflineSyncManager.flushAllPendingQueues(this@MainActivity, session)
            refreshOfflineBannerAndProfile()
            if (flushedCount > 0) {
                Toast.makeText(
                    this@MainActivity,
                    "Sinkronisasi berhasil ($flushedCount item terkirim ke server)!",
                    Toast.LENGTH_LONG
                ).show()
                loadTickets(silent = true)
            } else {
                val rem = OfflineSyncManager.getTotalPendingSyncCount(this@MainActivity)
                if (rem == 0) {
                    Toast.makeText(this@MainActivity, "Semua data sudah tersinkronisasi.", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Masih menunggu koneksi server stabil ($rem item).", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showVendorBatteryOptimizationDialog() {
        val manufacturer = Build.MANUFACTURER.lowercase(Locale.ROOT)
        val vendorGuide = when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") ->
                "Perangkat Xiaomi / Redmi / POCO (MIUI / HyperOS):\n" +
                    "1. Ketuk 'Matikan Optimasi Baterai' di bawah.\n" +
                    "2. Di Info Aplikasi → Penghemat Baterai → Pilih 'Tidak ada pembatasan'.\n" +
                    "3. Aktifkan 'Mulai Otomatis' (Autostart) agar GPS & Notifikasi tidak dimatikan sistem."
            manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus") ->
                "Perangkat OPPO / Realme (ColorOS):\n" +
                    "1. Ketuk 'Matikan Optimasi Baterai' di bawah.\n" +
                    "2. Di Info Aplikasi → Penggunaan Baterai → Aktifkan 'Izinkan Aktivitas Latar Belakang' & 'Mulai Otomatis'."
            manufacturer.contains("vivo") || manufacturer.contains("iqoo") ->
                "Perangkat Vivo (FuntouchOS):\n" +
                    "1. Ketuk 'Matikan Optimasi Baterai' di bawah.\n" +
                    "2. Di Pengaturan Baterai → Konsumsi Daya Latar Belakang Tinggi → Aktifkan untuk HelpDesk Teknisi."
            manufacturer.contains("samsung") ->
                "Perangkat Samsung (One UI):\n" +
                    "1. Ketuk 'Matikan Optimasi Baterai' di bawah.\n" +
                    "2. Di Info Aplikasi → Baterai → Pilih 'Tidak dibatasi' (Unrestricted)."
            else ->
                "Panduan Optimasi Baterai Android:\n" +
                    "1. Ketuk 'Matikan Optimasi Baterai' di bawah.\n" +
                    "2. Pilih 'Tidak dibatasi' (Unrestricted) pada pengaturan baterai aplikasi agar pelacakan GPS & Notifikasi berjalan lancar."
        }

        AlertDialog.Builder(this)
            .setTitle("Panduan Baterai & Background (${Build.MANUFACTURER})")
            .setMessage(vendorGuide)
            .setPositiveButton("Matikan Optimasi Baterai") { _, _ ->
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
                        if (pm?.isIgnoringBatteryOptimizations(packageName) == false) {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                        } else {
                            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                            startActivity(intent)
                        }
                    }
                } catch (_: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:$packageName")
                        }
                        startActivity(intent)
                    } catch (_: Exception) {}
                }
            }
            .setNeutralButton("Periksa Izin Lokasi/Notif") { _, _ ->
                checkAndRequestPermissions()
            }
            .setNegativeButton("Tutup", null)
            .show()
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
            "Sinkronkan Antrean Offline Sekarang",
            "Panduan Optimasi Baterai Background",
            "Tes Notifikasi Pop-up & Suara",
            "Pengaturan Izin Notifikasi HP",
            "Ping Lokasi GPS Sekarang",
            "Buka Tab Profil & Diagnostik",
            "Keluar Akun (Logout)"
        )

        AlertDialog.Builder(this)
            .setTitle("${session.userName ?: "Teknisi"} • Pengaturan (v2.1.0)")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> {
                        Toast.makeText(this, "Menyegarkan data tiket & notifikasi...", Toast.LENGTH_SHORT).show()
                        loadTickets(silent = false)
                        loadUserProfile()
                        syncNotificationsNow()
                    }
                    1 -> flushOfflineQueuesManual()
                    2 -> showVendorBatteryOptimizationDialog()
                    3 -> triggerTestNotification()
                    4 -> NotificationHelper.openNotificationSettings(this)
                    5 -> handleGpsCardClick()
                    6 -> selectBottomTab(4)
                    7 -> confirmLogout()
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
                            "Versi Aplikasi: v2.1.0 (Build 8)"
                    )
                    .setPositiveButton("Tutup", null)
                    .show()
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

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
            .setPositiveButton("Buka Tab Riwayat") { _, _ ->
                selectBottomTab(3)
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun showSupportAndQuickChatDialog() {
        val activeTicket = allTickets.firstOrNull { t ->
            val s = t.status.lowercase(Locale.ROOT)
            s != "resolved" && s != "closed" && s != "cancelled"
        } ?: allTickets.firstOrNull()

        if (activeTicket != null) {
            AlertDialog.Builder(this)
                .setTitle("Bantuan Teknisi & Koordinasi NOC")
                .setMessage(
                    "Hubungi NOC Dispatcher langsung melalui ruang Chat Tim pada tiket aktif #${activeTicket.ticketNumber} (${activeTicket.title})."
                )
                .setPositiveButton("Buka Chat Tim #${activeTicket.ticketNumber}") { _, _ ->
                    openTicketDetail(activeTicket, initialTab = 1)
                }
                .setNeutralButton("Tes Notifikasi") { _, _ ->
                    triggerTestNotification()
                }
                .setNegativeButton("Tutup", null)
                .show()
        } else {
            AlertDialog.Builder(this)
                .setTitle("Koordinasi NOC Dispatcher")
                .setMessage(
                    "Saat ini Anda belum memiliki tiket tugas aktif.\n\n" +
                        "Ketika ada tiket yang ditugaskan kepada Anda, ketuk tombol ini untuk langsung membuka ruang Chat Tim bersama NOC Dispatcher."
                )
                .setPositiveButton("Tes Notifikasi") { _, _ ->
                    triggerTestNotification()
                }
                .setNegativeButton("Tutup", null)
                .show()
        }
    }

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
                text = "Ketuk di sini untuk mengaktifkan izin Status Bar & Pop-up Notifikasi di pengaturan HP Anda ->"
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
                    text = if (isChat) "Ketuk untuk membuka Chat Tim ->" else "Ketuk untuk membuka Detail Tiket ->"
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

    private fun setHomeWorkflowChip(stage: String) {
        homeWorkflowStage = if (homeWorkflowStage == stage && stage != "all") "all" else stage
        if (homeWorkflowStage != "all") {
            selectedFilterIndex = 0
            cardFilterActive.setBackgroundResource(R.drawable.bg_glass_blue_card)
            cardFilterResolved.setBackgroundResource(R.drawable.bg_glass_blue_card)
        }
        updateHomeWorkflowChipStyles()
        applyFiltersAndRender()
    }

    private fun updateHomeWorkflowChipStyles() {
        val map = mapOf(
            "all" to chipHomeWfAll,
            "assigned" to chipHomeWfAssigned,
            "accepted" to chipHomeWfEnRoute,
            "on_site" to chipHomeWfOnSite,
            "in_progress" to chipHomeWfWorking
        )
        for ((k, tv) in map) {
            if (k == homeWorkflowStage) {
                tv.setBackgroundResource(R.drawable.bg_chip_selected_blue)
                tv.setTextColor(Color.WHITE)
            } else {
                tv.setBackgroundResource(R.drawable.bg_chip_unselected)
                tv.setTextColor(Color.parseColor("#334155"))
            }
        }
    }

    private fun selectFilter(index: Int) {
        selectedFilterIndex = index
        if (index != 0) {
            homeWorkflowStage = "all"
            updateHomeWorkflowChipStyles()
        }

        cardFilterActive.setBackgroundResource(
            if (index == 1) R.drawable.bg_glass_blue_card_selected else R.drawable.bg_glass_blue_card
        )
        cardFilterResolved.setBackgroundResource(
            if (index == 2) R.drawable.bg_glass_blue_card_selected else R.drawable.bg_glass_blue_card
        )

        applyFiltersAndRender()
    }

    private fun applyFiltersAndRender() {
        // Update live workflow stage counts on Home Pipeline Chips
        var cAssigned = 0
        var cEnRoute = 0
        var cOnSite = 0
        var cWorking = 0
        for (t in allTickets) {
            when (t.status.lowercase(Locale.ROOT)) {
                "open", "assigned", "reopened" -> cAssigned++
                "accepted" -> cEnRoute++
                "on_site", "pending", "waiting_for_user", "waiting_for_third_party" -> cOnSite++
                "in_progress" -> cWorking++
            }
        }
        chipHomeWfAssigned.text = "1. Ditugaskan ($cAssigned)"
        chipHomeWfEnRoute.text = "2. Perjalanan ($cEnRoute)"
        chipHomeWfOnSite.text = "3. Di Lokasi ($cOnSite)"
        chipHomeWfWorking.text = "4. Dikerjakan ($cWorking)"

        val filtered = allTickets.filter { t ->
            val s = t.status.lowercase(Locale.ROOT)
            val isResolved = s == "resolved" || s == "closed" || s == "cancelled"

            val matchesTab = when (selectedFilterIndex) {
                1 -> !isResolved
                2 -> isResolved
                else -> true
            }

            val matchesWorkflowStage = when (homeWorkflowStage) {
                "assigned" -> s == "open" || s == "assigned" || s == "reopened"
                "accepted" -> s == "accepted"
                "on_site" -> s == "on_site" || s == "pending" || s == "waiting_for_user" || s == "waiting_for_third_party"
                "in_progress" -> s == "in_progress"
                else -> true
            }

            val q = searchQuery.lowercase(Locale.ROOT)
            val matchesQuery = if (q.isEmpty()) {
                true
            } else {
                t.ticketNumber.toString().contains(q) ||
                    t.title.lowercase(Locale.ROOT).contains(q) ||
                    (t.reporterName?.lowercase(Locale.ROOT)?.contains(q) == true) ||
                    (t.reporterAddress?.lowercase(Locale.ROOT)?.contains(q) == true)
            }

            matchesTab && matchesWorkflowStage && matchesQuery
        }

        homeTicketAdapter.submitList(filtered)
        val filterName = when {
            homeWorkflowStage == "assigned" -> "Ditugaskan (${filtered.size})"
            homeWorkflowStage == "accepted" -> "Perjalanan (${filtered.size})"
            homeWorkflowStage == "on_site" -> "Di Lokasi (${filtered.size})"
            homeWorkflowStage == "in_progress" -> "Dikerjakan (${filtered.size})"
            selectedFilterIndex == 1 -> "Belum Selesai (${filtered.size})"
            selectedFilterIndex == 2 -> "Selesai (${filtered.size})"
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

    private fun setTasksTabStatusChip(statusKey: String) {
        tasksTabFilterStatus = statusKey
        val map = mapOf(
            "all" to chipTaskTabAll,
            "new" to chipTaskTabNew,
            "active" to chipTaskTabRunning,
            "pending" to chipTaskTabPending,
            "done" to chipTaskTabDone
        )
        for ((k, tv) in map) {
            if (k == statusKey) {
                tv.setBackgroundResource(R.drawable.bg_chip_selected_blue)
                tv.setTextColor(Color.WHITE)
            } else {
                tv.setBackgroundResource(R.drawable.bg_chip_unselected)
                tv.setTextColor(Color.parseColor("#334155"))
            }
        }
        renderTasksTab()
    }

    private fun renderTasksTab() {
        val filtered = allTickets.filter { t ->
            val s = t.status.lowercase(Locale.ROOT)
            val matchesStatus = when (tasksTabFilterStatus) {
                "new" -> s == "open" || s == "assigned" || s == "reopened"
                "active" -> s == "accepted" || s == "on_site" || s == "in_progress"
                "pending" -> s == "pending" || s == "waiting_for_user" || s == "waiting_for_third_party"
                "done" -> s == "resolved" || s == "closed"
                else -> true
            }
            val q = tasksTabSearchQuery.lowercase(Locale.ROOT)
            val matchesQuery = if (q.isEmpty()) {
                true
            } else {
                t.ticketNumber.toString().contains(q) ||
                    t.title.lowercase(Locale.ROOT).contains(q) ||
                    (t.reporterName?.lowercase(Locale.ROOT)?.contains(q) == true) ||
                    (t.reporterAddress?.lowercase(Locale.ROOT)?.contains(q) == true)
            }
            matchesStatus && matchesQuery
        }

        val sorted = when (tasksTabSortMode) {
            1 -> { // Jarak Terdekat
                val techLat = session.lastLatitude
                val techLng = session.lastLongitude
                if (techLat != 0.0 && techLng != 0.0) {
                    filtered.sortedBy { t ->
                        if (t.latitude != null && t.longitude != null && t.latitude != 0.0 && t.longitude != 0.0) {
                            val res = FloatArray(1)
                            Location.distanceBetween(techLat, techLng, t.latitude, t.longitude, res)
                            res[0]
                        } else {
                            Float.MAX_VALUE
                        }
                    }
                } else filtered
            }
            2 -> { // Jadwal / Target SLA Terdekat
                filtered.sortedBy { t ->
                    parseTicketTimestamp(t.slaResolutionDue)?.time ?: Long.MAX_VALUE
                }
            }
            else -> { // Prioritas Tertinggi
                filtered.sortedWith(
                    compareBy<TicketItem> { t ->
                        when (t.priority.lowercase(Locale.ROOT)) {
                            "critical" -> 0
                            "high" -> 1
                            "medium" -> 2
                            "low" -> 3
                            else -> 4
                        }
                    }.thenByDescending { it.ticketNumber }
                )
            }
        }

        tvTasksTabSubtitle.text = "Menampilkan ${sorted.size} dari ${allTickets.size} tugas lapangan"
        tasksTabAdapter.submitList(sorted)
    }

    private fun renderMapTab() {
        val activeCount = allTickets.count {
            val s = it.status.lowercase(Locale.ROOT)
            s != "resolved" && s != "closed" && s != "cancelled"
        }
        tvMapHeaderStats.text = "$activeCount Aktif / ${allTickets.size} Total Tiket"

        val sel = selectedMapTicket ?: allTickets.firstOrNull {
            val s = it.status.lowercase(Locale.ROOT)
            s != "resolved" && s != "closed" && s != "cancelled"
        } ?: allTickets.firstOrNull()

        selectedMapTicket = sel
        fieldMapView.setMapData(session.lastLatitude, session.lastLongitude, allTickets, sel?.id)
        if (sel != null) {
            updateMapSelectedTicketCard(sel)
        }
    }

    private fun updateMapSelectedTicketCard(ticket: TicketItem) {
        cardMapSelectedTicket.visibility = View.VISIBLE
        val statusName = NotificationHelper.formatStatusName(ticket.status)
        tvMapPreviewTitle.text = "#${ticket.ticketNumber} • ${ticket.title} ($statusName)"
        tvMapPreviewAddress.text = "${ticket.reporterName ?: "Pelanggan"} — ${ticket.reporterAddress ?: "Alamat belum dilengkapi"}"

        val techLat = session.lastLatitude
        val techLng = session.lastLongitude
        val tLat = ticket.latitude
        val tLng = ticket.longitude
        if (techLat != 0.0 && techLng != 0.0 && tLat != null && tLng != null && tLat != 0.0 && tLng != 0.0) {
            val res = FloatArray(1)
            Location.distanceBetween(techLat, techLng, tLat, tLng, res)
            val m = res[0]
            tvMapPreviewDistance.text = if (m < 1000f) "${m.toInt()} m" else String.format(Locale.US, "%.1f km", m / 1000f)
        } else {
            tvMapPreviewDistance.text = "Titik Area"
        }
    }

    private fun openExternalMapsForTicket(ticket: TicketItem) {
        val mapUrl = ticket.reporterMapUrl
        val lat = ticket.latitude
        val lng = ticket.longitude
        val uri = when {
            !mapUrl.isNullOrBlank() && (mapUrl.startsWith("http://") || mapUrl.startsWith("https://")) -> Uri.parse(mapUrl)
            lat != null && lng != null && lat != 0.0 && lng != 0.0 -> Uri.parse("google.navigation:q=$lat,$lng")
            !ticket.reporterAddress.isNullOrBlank() -> Uri.parse("geo:0,0?q=${Uri.encode(ticket.reporterAddress)}")
            else -> null
        }
        if (uri != null) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (_: Exception) {
                Toast.makeText(this, "Aplikasi Peta tidak ditemukan", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setHistoryPeriodChip(period: Int) {
        historyPeriodFilter = period
        val chips = arrayOf(chipHistoryAll, chipHistoryToday, chipHistoryWeek)
        for (i in chips.indices) {
            if (i == period) {
                chips[i].setBackgroundResource(R.drawable.bg_chip_selected_blue)
                chips[i].setTextColor(Color.WHITE)
            } else {
                chips[i].setBackgroundResource(R.drawable.bg_chip_unselected)
                chips[i].setTextColor(Color.parseColor("#475569"))
            }
        }
        renderHistoryTab()
    }

    private fun renderHistoryTab() {
        val wibTz = TimeZone.getTimeZone("Asia/Jakarta")
        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = wibTz }
        val nowCal = Calendar.getInstance(wibTz)
        val todayKey = dayFmt.format(nowCal.time)

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

        val completedAll = allTickets.filter {
            val s = it.status.lowercase(Locale.ROOT)
            s == "resolved" || s == "closed"
        }

        var todayCount = 0
        var weekCount = 0

        completedAll.forEach { t ->
            val dt = parseTicketTimestamp(t.resolvedAt) ?: parseTicketTimestamp(t.updatedAt) ?: parseTicketTimestamp(t.createdAt)
            if (dt != null) {
                if (dayFmt.format(dt) == todayKey) todayCount++
                if (dt.time >= mondayCal.timeInMillis) weekCount++
            }
        }

        tvHistoryStatToday.text = todayCount.toString()
        tvHistoryStatWeek.text = weekCount.toString()
        tvHistoryStatTotal.text = completedAll.size.toString()

        val filteredHistory = completedAll.filter { t ->
            val dt = parseTicketTimestamp(t.resolvedAt) ?: parseTicketTimestamp(t.updatedAt) ?: parseTicketTimestamp(t.createdAt)
            when (historyPeriodFilter) {
                1 -> dt != null && dayFmt.format(dt) == todayKey
                2 -> dt != null && dt.time >= mondayCal.timeInMillis
                else -> true
            }
        }

        historyTabAdapter.submitList(filteredHistory)
    }

    /**
     * FR-29: Menampilkan ringkasan laporan pekerjaan yang telah dikirim pada tiket selesai.
     */
    private fun showCompletedTicketReportSummaryDialog(ticket: TicketItem) {
        val report = ticket.latestReport
        val sb = StringBuilder()
        sb.append("Tiket: #${ticket.ticketNumber} — ${ticket.title}\n")
        sb.append("Pelanggan: ${ticket.reporterName ?: "-"}\n")
        sb.append("Status: ${NotificationHelper.formatStatusName(ticket.status)}\n\n")

        if (report != null) {
            sb.append("RINGKASAN LAPORAN TEKNISI:\n")
            sb.append("• Ringkasan: ${report.summary}\n")
            sb.append("• Tindakan: ${report.actionTaken}\n")
            if (!report.materialsUsed.isNullOrBlank()) {
                sb.append("• Material Digunakan: ${report.materialsUsed}\n")
            }
            if (!report.finalResult.isNullOrBlank()) {
                sb.append("• Hasil Akhir: ${report.finalResult}\n")
            }
            sb.append("• Foto Dokumentasi: ${report.beforePhotos.size} Before, ${report.afterPhotos.size} After\n")
            sb.append("• Waktu Laporan: ${report.createdAt}\n")
        } else if (!ticket.resolution.isNullOrBlank()) {
            sb.append("RINGKASAN PENYELESAIAN:\n${ticket.resolution}\n")
        } else {
            sb.append("Tiket ini telah diselesaikan. Ketuk 'Buka Detail & Foto' untuk melihat dokumentasi lengkap.\n")
        }

        AlertDialog.Builder(this)
            .setTitle("Laporan Selesai #${ticket.ticketNumber}")
            .setMessage(sb.toString())
            .setPositiveButton("Buka Detail & Foto") { _, _ ->
                openTicketDetail(ticket, initialTab = 0)
            }
            .setNeutralButton("Chat Tim") { _, _ ->
                openTicketDetail(ticket, initialTab = 1)
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun setupRecyclerViews() {
        homeTicketAdapter = TicketAdapter(
            context = this,
            onPrimaryActionClick = { ticket -> handlePrimaryAction(ticket) },
            onDetailClick = { ticket -> openTicketDetail(ticket, initialTab = 0) },
            onChatClick = { ticket -> openTicketDetail(ticket, initialTab = 1) }
        )
        rvTickets.layoutManager = LinearLayoutManager(this)
        rvTickets.adapter = homeTicketAdapter

        tasksTabAdapter = TicketAdapter(
            context = this,
            onPrimaryActionClick = { ticket -> handlePrimaryAction(ticket) },
            onDetailClick = { ticket -> openTicketDetail(ticket, initialTab = 0) },
            onChatClick = { ticket -> openTicketDetail(ticket, initialTab = 1) }
        )
        rvTasksTab.layoutManager = LinearLayoutManager(this)
        rvTasksTab.adapter = tasksTabAdapter

        historyTabAdapter = TicketAdapter(
            context = this,
            onPrimaryActionClick = { ticket -> showCompletedTicketReportSummaryDialog(ticket) },
            onDetailClick = { ticket -> showCompletedTicketReportSummaryDialog(ticket) },
            onChatClick = { ticket -> openTicketDetail(ticket, initialTab = 1) }
        )
        rvHistoryTab.layoutManager = LinearLayoutManager(this)
        rvHistoryTab.adapter = historyTabAdapter
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

        // Check-In Radius Validation (FR-12) when transitioning to on_site
        val techLat = session.lastLatitude
        val techLng = session.lastLongitude
        var distMeters: Double? = null
        if (nextStatus == "on_site" && techLat != 0.0 && techLng != 0.0 &&
            ticket.latitude != null && ticket.longitude != null && ticket.latitude != 0.0 && ticket.longitude != 0.0
        ) {
            val res = FloatArray(1)
            Location.distanceBetween(techLat, techLng, ticket.latitude, ticket.longitude, res)
            distMeters = res[0].toDouble()
            if (res[0] > 100f) {
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
                serverUrl = session.serverUrl,
                token = token,
                ticketId = ticket.id,
                status = nextStatus,
                notes = "Diperbarui langsung dari aplikasi teknisi",
                summary = null,
                latitude = techLat.takeIf { it != 0.0 },
                longitude = techLng.takeIf { it != 0.0 },
                distanceMeters = distMeters
            )
            result.onSuccess {
                val statusLabel = NotificationHelper.formatStatusName(nextStatus)
                Toast.makeText(this@MainActivity, "Status tiket #${ticket.ticketNumber}: $statusLabel", Toast.LENGTH_SHORT).show()
                loadTickets(silent = true)
            }.onFailure {
                OfflineSyncManager.enqueueOfflineAction(
                    this@MainActivity,
                    OfflineActionItem(
                        id = UUID.randomUUID().toString(),
                        actionType = "status_update",
                        ticketId = ticket.id,
                        ticketNumber = ticket.ticketNumber,
                        status = nextStatus,
                        notes = "Diperbarui dari aplikasi teknisi (Tersimpan Offline)",
                        latitude = techLat.takeIf { it != 0.0 },
                        longitude = techLng.takeIf { it != 0.0 },
                        distanceMeters = distMeters
                    )
                )
                OfflineSyncManager.updateCachedTicketStatusLocally(this@MainActivity, ticket.id, nextStatus)
                refreshOfflineBannerAndProfile()
                Toast.makeText(
                    this@MainActivity,
                    "Koneksi lemah: Status disimpan di antrean offline & akan dikirim otomatis.",
                    Toast.LENGTH_LONG
                ).show()
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

    private fun computeDashboardMetrics(tickets: List<TicketItem>): Pair<Int, IntArray> {
        val wibTz = TimeZone.getTimeZone("Asia/Jakarta")
        val dayFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
            timeZone = wibTz
        }
        val nowCal = Calendar.getInstance(wibTz)
        val todayKey = dayFmt.format(nowCal.time)

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
        val weeklyCounts = IntArray(6) { 0 }

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

    private fun renderAllTabsWithTickets(tickets: List<TicketItem>) {
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
        renderTasksTab()
        renderMapTab()
        renderHistoryTab()
        refreshOfflineBannerAndProfile()
    }

    private fun loadTickets(silent: Boolean = false) {
        if (!silent) {
            swipeRefresh.isRefreshing = true
        }
        lifecycleScope.launch {
            val token = session.token ?: return@launch

            // Opportunistically flush any pending offline actions first
            if (OfflineSyncManager.getTotalPendingSyncCount(this@MainActivity) > 0) {
                OfflineSyncManager.flushAllPendingQueues(this@MainActivity, session)
            }

            val result = ApiClient.getTickets(session.serverUrl, token)
            if (!silent) {
                swipeRefresh.isRefreshing = false
            }

            result.onSuccess { tickets ->
                allTickets = tickets
                OfflineSyncManager.saveCachedTickets(this@MainActivity, tickets)
                renderAllTabsWithTickets(tickets)

                val payload = NotificationHelper.syncAndDispatchNotifications(this@MainActivity, session, tickets)
                if (payload != null) {
                    cachedNotifications = payload.notifications
                    unreadNotifCount = payload.unreadCount
                    updateNotificationBadge(unreadNotifCount)
                }
            }.onFailure { err ->
                val cached = OfflineSyncManager.getCachedTickets(this@MainActivity)
                if (cached.isNotEmpty() && allTickets.isEmpty()) {
                    allTickets = cached
                    renderAllTabsWithTickets(cached)
                }
                if (!silent) {
                    Toast.makeText(
                        this@MainActivity,
                        "Mode Offline Aktif: Menampilkan data tiket tersimpan (${err.message})",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

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
                refreshOfflineBannerAndProfile()
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
        refreshOfflineBannerAndProfile()
        val filter = IntentFilter().apply {
            addAction(LocationTrackingService.ACTION_LOCATION_UPDATED)
            addAction(OfflineSyncManager.ACTION_SYNC_STATE_CHANGED)
            addAction(NotificationHelper.ACTION_NOTIFICATION_SYNCED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(systemEventReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(systemEventReceiver, filter)
        }

        syncNotificationsNow()

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
