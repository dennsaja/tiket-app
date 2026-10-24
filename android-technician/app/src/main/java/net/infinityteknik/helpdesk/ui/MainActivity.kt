package net.infinityteknik.helpdesk.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.service.LocationTrackingService
import net.infinityteknik.helpdesk.util.LocationPolicy
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var pages: FrameLayout
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var syncBanner: TextView
    private lateinit var notificationCount: TextView
    private lateinit var heading: TextView
    private lateinit var ticketBadge: TextView
    private lateinit var navigation: LinearLayout
    private lateinit var ticketsAdapter: TicketAdapter
    private lateinit var ticketList: RecyclerView
    private lateinit var ticketCount: TextView
    private lateinit var ticketEmpty: TextView
    private lateinit var searchInput: EditText
    private lateinit var homeRecent: LinearLayout
    private lateinit var gpsTitle: TextView
    private lateinit var gpsSummary: TextView
    private lateinit var accountGps: TextView
    private lateinit var mapSummary: TextView
    private lateinit var mapPreview: LinearLayout
    private lateinit var fieldMap: FieldTechnicianMapView
    private lateinit var chart: WeeklyTimelineChartView
    private lateinit var greeting: TextView
    private lateinit var accountName: TextView
    private lateinit var accountEmail: TextView
    private lateinit var accountAvatar: AvatarView
    private lateinit var roomList: RecyclerView
    private lateinit var roomStatus: TextView
    private lateinit var roomEmpty: TextView
    private lateinit var roomAdapter: ChatRoomAdapter
    private var rooms = emptyList<ChatRoom>()
    private var roomQuery = ""
    private var roomsLoading = false
    private var roomsLoaded = false
    private var roomError: String? = null
    private val profileLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (::accountName.isInitialized) {
            accountName.text = session.userName; accountEmail.text = session.userEmail
            accountAvatar.bind(session.userName.orEmpty(), session.userAvatar)
            greeting.text = "Halo, " + (session.userName ?: "Tim").substringBefore(" ") + "."
        }
    }
    private val statValues = mutableListOf<TextView>()
    private val screens = mutableListOf<View>()
    private val navIcons = mutableListOf<ImageView>()
    private val navLabels = mutableListOf<TextView>()
    private val filterLabels = mutableMapOf<String, TextView>()
    private var allTickets = emptyList<TicketItem>()
    private var notifications = emptyList<NotificationItem>()
    private var activeTab = 0
    private var ticketFilter = "active"
    private var query = ""
    private var loading = false
    private var realtimeRefreshPending = false
    private var hasData = false
    private var connected = true
    private var polling: Job? = null
    private var permissionsBusy = false
    private var selectedTicket: TicketItem? = null
    private var mobileConfiguration = MobileConfiguration()
    private var configurationJob: Job? = null
    private var configurationLastAttempt = 0L
    private var configurationAppVersion = 0L
    private var configurationRefreshPending = false
    private var configurationDialog: AlertDialog? = null
    private var offeredConfigurationVersion = -1L
    private var deferredConfigurationVersion = -1L
    private var acknowledgedConfigurationVersion = -1L
    private var acknowledgementBusy = false
    private lateinit var homeSubtitle: TextView
    private lateinit var announcement: LinearLayout
    private lateinit var announcementTitle: TextView
    private lateinit var announcementBody: TextView
    private lateinit var activityPanel: LinearLayout
    private lateinit var configurationStatus: TextView
    private val preferences by lazy { getSharedPreferences("helpdesk_permission_choices", MODE_PRIVATE) }

    private val detailLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.data?.getBooleanExtra("report_completed", false) == true) { ticketFilter = "all"; selectTab(1) }
        allTickets = OfflineSyncManager.getCachedTickets(this); render(); refreshTickets(false)
    }
    private var realtimeJob: Job? = null
    private val locationPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        permissionsBusy = false; updateGpsUi(); ensureService()
    }
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        permissionsBusy = false; maybeRequestLocation()
    }
    private val updates = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == NotificationHelper.ACTION_NOTIFICATION_SYNCED) {
                NotificationHelper.latestCachedPayload?.let { notifications = it.notifications }
                renderNotificationCount()
            }
            updateGpsUi(); updateSyncBanner()
            if (activeTab == 3) renderMap()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        if (!session.isLoggedIn) { openLogin(); return }
        val packageInfo = packageManager.getPackageInfo(packageName, 0)
        configurationAppVersion = if (Build.VERSION.SDK_INT >= 28) packageInfo.longVersionCode else packageInfo.versionCode.toLong()
        mobileConfiguration = session.mobileConfigurationJson?.let { raw ->
            runCatching { MobileConfiguration.parse(raw, configurationAppVersion) }.getOrNull()
        } ?: MobileConfiguration()
        session.userId?.let { OfflineSyncManager.prepareAccount(this, it) }
        activeTab = if (intent.getBooleanExtra("report_completed", false)) 1 else savedInstanceState?.getInt("tab", 0) ?: 0
        ticketFilter = if (intent.getBooleanExtra("report_completed", false)) "all" else savedInstanceState?.getString("filter") ?: "active"
        query = savedInstanceState?.getString("query") ?: ""
        setContentView(R.layout.activity_main)
        pages = findViewById(R.id.workspacePages)
        swipe = findViewById(R.id.swipeWorkspace)
        syncBanner = findViewById(R.id.tvSyncBanner)
        notificationCount = findViewById(R.id.tvNotificationCount)
        heading = findViewById(R.id.tvWorkspaceTitle)
        navigation = findViewById(R.id.bottomNavigation)
        findViewById<ImageButton>(R.id.btnNotifications).setOnClickListener { showNotifications() }
        swipe.setColorSchemeColors(HelpdeskTheme.blue)
        swipe.setProgressBackgroundColorSchemeColor(HelpdeskTheme.surface)
        swipe.setOnRefreshListener { if(activeTab==2) { swipe.isRefreshing=false; refreshRooms() } else refreshTickets(true) }
        swipe.setOnChildScrollUpCallback { _, _ ->
            when (activeTab) { 1 -> ticketList.canScrollVertically(-1); 2 -> roomList.canScrollVertically(-1); 3 -> true; else -> screens[activeTab].canScrollVertically(-1) }
        }
        buildOverview(); buildTickets(); buildChats(); buildMap(); buildAccount(); buildNavigation()
        applyMobileConfiguration()
        selectTab(activeTab)
        allTickets = OfflineSyncManager.getCachedTickets(this)
        hasData = allTickets.isNotEmpty()
        notifications = session.getLocalNotifications()
        render()
        session.chatRoomsJson?.let { raw -> runCatching {
            val array = org.json.JSONArray(raw); rooms = (0 until array.length()).map { ApiClient.parseChatRoom(array.getJSONObject(it)) }; roomsLoaded = true
        } }
        renderRooms()
        NotificationHelper.ensureAlertChannel(this)
    }

    private fun dp(value: Int) = HelpdeskTheme.dp(this, value)
    private fun label(value: String, size: Float = 14f, color: Int = HelpdeskTheme.text, bold: Boolean = false) =
        HelpdeskTheme.text(this, value, size, color, bold)
    private fun column(padding: Int = 0) = HelpdeskTheme.column(this, padding)
    private fun gap(parent: LinearLayout, value: Int = 16) { parent.addView(View(this), LinearLayout.LayoutParams(1, dp(value))) }
    private fun addScreen(screen: View) { screens.add(screen); pages.addView(screen, FrameLayout.LayoutParams(-1, -1)) }
    private fun scroll(content: LinearLayout) = ScrollView(this).apply { isFillViewport = true; clipToPadding = false; addView(content) }
    private fun panel(padding: Int = 20) = column(padding).apply { background = HelpdeskTheme.shape(this@MainActivity) }
    private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    private fun button(parent: LinearLayout, title: String, primary: Boolean = false, action: () -> Unit) {
        parent.addView(HelpdeskTheme.button(this, title, primary, action), LinearLayout.LayoutParams(-1, dp(48)))
    }
    private fun buildOverview() {
        val root = column(20)
        root.addView(label("SUPPORT WORKSPACE", 10f, HelpdeskTheme.muted).apply { letterSpacing = .13f })
        gap(root, 10)
        greeting = label("Halo, " + (session.userName ?: "Tim").substringBefore(" ") + ".", 32f, bold = true)
        root.addView(greeting)
        gap(root, 6)
        homeSubtitle = label(mobileConfiguration.homeSubtitle, 13f, HelpdeskTheme.muted)
        root.addView(homeSubtitle)
        gap(root, 10)
        root.addView(label(SimpleDateFormat("EEEE, dd MMMM", Locale("id", "ID")).apply { timeZone = TimeZone.getTimeZone("Asia/Jakarta") }.format(Date()), 11f, Color.rgb(156,174,255)))
        gap(root, 24)
        announcement = panel(18)
        announcement.background = HelpdeskTheme.shape(this, Color.rgb(23, 30, 56), 22, Color.rgb(49, 67, 113))
        announcementTitle = label("Informasi tim", 15f, Color.rgb(172, 189, 255), true)
        announcementBody = label("", 13f, HelpdeskTheme.text)
        announcement.addView(announcementTitle); gap(announcement, 6); announcement.addView(announcementBody)
        root.addView(announcement, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(20) })
        val titles = listOf("Total tiket", "Dalam proses", "SLA terlewat", "Tiket selesai")
        for (r in 0..1) {
            val grid = row()
            for (c in 0..1) {
                val index = r * 2 + c
                val featured = index == 0
                val card = panel(17)
                card.background = HelpdeskTheme.shape(this, if (featured) Color.rgb(250, 250, 250) else HelpdeskTheme.surface)
                card.minimumHeight = dp(128)
                val foreground = if (featured) Color.rgb(24, 24, 27) else HelpdeskTheme.text
                card.addView(label(titles[index] + "  ↗", 12f, foreground, true))
                gap(card, 20)
                val number = label("—", 34f, foreground, true)
                card.addView(number); statValues.add(number)
                card.addView(label(listOf("Seluruh tiket penugasan", "Sedang ditangani", "Perlu perhatian", "Selesai & ditutup")[index], 10f, if (featured) Color.rgb(112, 112, 123) else HelpdeskTheme.muted))
                card.isClickable = true; card.isFocusable = true; card.contentDescription = titles[index]
                card.setOnClickListener {
                    ticketFilter = when (index) { 1 -> "working"; 2 -> "overdue"; 3 -> "done"; else -> "all" }
                    selectTab(1); renderTickets()
                }
                HelpdeskTheme.interactive(card)
                grid.addView(card, LinearLayout.LayoutParams(0, -2, 1f).apply { if (c == 0) marginEnd = dp(6) else marginStart = dp(6) })
            }
            root.addView(grid); gap(root, 12)
        }
        gap(root, 4)
        val activity = panel()
        activityPanel = activity
        activity.addView(label("Aktivitas tiket", 17f, bold = true))
        activity.addView(label("Tiket masuk · 7 hari terakhir · WIB", 11f, HelpdeskTheme.muted))
        chart = WeeklyTimelineChartView(this)
        activity.addView(chart, LinearLayout.LayoutParams(-1, dp(190)).apply { topMargin = dp(14) })
        root.addView(activity); gap(root)
        val gps = panel(18)
        gps.background = OrbitBackdrop()
        gpsTitle = label("Status lokasi", 14f, bold = true)
        gpsSummary = label("", 12f, HelpdeskTheme.muted)
        gps.addView(gpsTitle); gap(gps, 6); gps.addView(gpsSummary)
        gps.setOnClickListener { showLocationHelp() }; gps.isFocusable = true
        root.addView(gps); gap(root, 24)
        val titleRow = row()
        titleRow.addView(label("Tiket terbaru", 18f, bold = true), LinearLayout.LayoutParams(0, -2, 1f))
        titleRow.addView(label("Lihat semua ↗", 12f, Color.rgb(156,174,255)).apply {
            setPadding(dp(8), dp(14), 0, dp(14))
            setOnClickListener { ticketFilter = "active"; selectTab(1); renderTickets() }
            isFocusable = true
        })
        root.addView(titleRow)
        homeRecent = column(); root.addView(homeRecent); gap(root, 24)
        root.addView(label("HelpDesk  /  Your support, simplified.", 10f, HelpdeskTheme.muted))
        addScreen(scroll(root))
    }
    private fun buildTickets() {
        val root = column(20)
        root.addView(label("Tiket kamu", 28f, bold = true))
        ticketCount = label("Memuat penugasan...", 12f, HelpdeskTheme.muted)
        root.addView(ticketCount); gap(root, 18)
        searchInput = EditText(this).apply {
            hint = "Cari nomor, judul, atau pelanggan"
            textSize = 13f
            setTextColor(HelpdeskTheme.text); setHintTextColor(HelpdeskTheme.muted)
            background = HelpdeskTheme.shape(this@MainActivity, radius = 16)
            setPadding(dp(16), 0, dp(16), 0)
            isSingleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT
            setText(query); contentDescription = "Cari tiket"
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { query = s?.toString().orEmpty(); renderTickets() }
                override fun afterTextChanged(s: Editable?) {}
            })
        }
        root.addView(searchInput, LinearLayout.LayoutParams(-1, dp(50))); gap(root, 14)
        val chips = row()
        listOf("active" to "Aktif", "working" to "Dikerjakan", "pending" to "Menunggu", "done" to "Selesai", "all" to "Semua").forEach { (key, name) ->
            val chip = label(name, 11f).apply {
                gravity = Gravity.CENTER; minHeight = dp(44)
                setPadding(dp(15), 0, dp(15), 0)
                setOnClickListener { ticketFilter = key; renderTickets() }
                isFocusable = true
            }
            filterLabels[key] = chip
            chips.addView(chip, LinearLayout.LayoutParams(-2, dp(44)).apply { marginEnd = dp(7) })
        }
        root.addView(HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(chips) })
        gap(root, 16)
        ticketEmpty = label("Belum ada tiket yang cocok.", 13f, HelpdeskTheme.muted).apply { gravity = Gravity.CENTER; setPadding(0, dp(32), 0, dp(24)) }
        root.addView(ticketEmpty)
        ticketsAdapter = TicketAdapter(this, { openTicket(it, if (it.status == "in_progress") 2 else 0, it.status in setOf("open", "assigned", "reopened")) }, { openTicket(it) }, { openTicket(it, 1) })
        ticketList = RecyclerView(this).apply { layoutManager = LinearLayoutManager(this@MainActivity); adapter = ticketsAdapter; clipToPadding = false }
        root.addView(ticketList, LinearLayout.LayoutParams(-1, 0, 1f))
        addScreen(root)
    }

    private fun buildChats() {
        val root = column(20)
        root.addView(label("Chat tim", 30f, bold = true))
        roomStatus = label("Memuat grup tiket...", 12f, HelpdeskTheme.muted); root.addView(roomStatus); gap(root,18)
        val search = EditText(this).apply {
            hint = "Cari grup, tiket, atau pesan terakhir"; textSize = 13f; isSingleLine = true
            setTextColor(HelpdeskTheme.text); setHintTextColor(HelpdeskTheme.muted)
            background = HelpdeskTheme.shape(this@MainActivity,radius=18); setPadding(dp(16),0,dp(16),0)
            addTextChangedListener(object:TextWatcher {
                override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int) {}
                override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int) { roomQuery=s.toString(); renderRooms() }
                override fun afterTextChanged(s:Editable?) {}
            })
        }; root.addView(search,LinearLayout.LayoutParams(-1,dp(52))); gap(root,18)
        roomAdapter = ChatRoomAdapter { room -> startActivity(Intent(this,TeamChatActivity::class.java)
            .putExtra("ticket_id",room.ticketId).putExtra("ticket_number",room.ticketNumber).putExtra("title",room.title)) }
        roomList = RecyclerView(this).apply { layoutManager=LinearLayoutManager(this@MainActivity); adapter=roomAdapter; clipToPadding=false }
        roomEmpty = label("",14f,HelpdeskTheme.muted).apply { gravity=Gravity.CENTER; setPadding(dp(18),dp(28),dp(18),dp(28)) }
        root.addView(roomEmpty); root.addView(roomList,LinearLayout.LayoutParams(-1,0,1f)); addScreen(root)
    }
    private fun renderRooms() {
        if(!::roomAdapter.isInitialized) return
        val query=roomQuery.trim()
        val filtered=rooms.filter { query.isBlank() || (it.ticketNumber.toString()+" "+it.title+" "+it.department+" "+it.lastMessage.orEmpty()).contains(query,true) }
        roomAdapter.submitList(filtered)
        roomStatus.text=roomError ?: if(roomsLoaded) rooms.size.toString()+" grup sesuai akses tiket kamu"+(if(!OfflineSyncManager.isOnline(this)) " · Offline" else "") else "Memuat grup tiket..."
        roomEmpty.visibility=if(filtered.isEmpty()) View.VISIBLE else View.GONE
        roomEmpty.text=when { !roomsLoaded -> "Grup akan muncul setelah terhubung ke helpdesk."; query.isNotEmpty() -> "Tidak ada grup yang cocok dengan pencarian."; else -> "Belum ada grup tiket.\nGrup akan muncul saat kamu masuk dalam tim penanganan." }
    }
    private fun refreshRooms() {
        if(roomsLoading || !OfflineSyncManager.isOnline(this)) { renderRooms(); return }
        val token=session.token ?: return
        roomsLoading=true
        lifecycleScope.launch {
            try {
                ApiClient.getChatRooms(session.serverUrl,token).onSuccess { fetched ->
                    if(session.token!=token) return@onSuccess
                    rooms=fetched; roomsLoaded=true; roomError=null
                    session.chatRoomsJson=org.json.JSONArray(rooms.map { room -> org.json.JSONObject().apply {
                        put("ticketId",room.ticketId); put("ticketNumber",room.ticketNumber); put("title",room.title); put("status",room.status)
                        put("department",org.json.JSONObject().put("name",room.department)); put("updatedAt",room.updatedAt)
                        if(room.lastMessage!=null) put("lastMessage",org.json.JSONObject().put("id",room.lastMessageId).put("authorId",room.lastAuthorId)
                            .put("content",room.lastMessage).put("authorName",room.lastAuthor).put("createdAt",room.updatedAt))
                    } }).toString()
                }.onFailure { error ->
                    if(error is ApiException && error.statusCode==401) { expireSession(); return@onFailure }
                    roomError="Grup belum dapat diperbarui. Tarik untuk mencoba lagi."
                }
                renderRooms()
            } finally { roomsLoading=false; if(activeTab==2) swipe.isRefreshing=false }
        }
    }
    private fun buildMap() {
        val root = column(20)
        root.addView(label("Peta penugasan", 28f, bold = true))
        mapSummary = label("", 12f, HelpdeskTheme.muted); root.addView(mapSummary); gap(root, 12)
        root.addView(label("Sebaran koordinat tiket. Buka navigasi untuk rute jalan.", 11f, HelpdeskTheme.muted)); gap(root, 16)
        val controls = row()
        listOf("Pusatkan" to { fieldMap.recenterOnTechnician() }, "+" to { fieldMap.zoomIn() }, "−" to { fieldMap.zoomOut() }).forEach { (name, action) ->
            controls.addView(HelpdeskTheme.button(this, name, false, action), LinearLayout.LayoutParams(0, dp(46), 1f).apply { marginEnd = dp(8) })
        }
        root.addView(controls); gap(root, 12)
        fieldMap = FieldTechnicianMapView(this).apply {
            background = HelpdeskTheme.shape(this@MainActivity); clipToOutline = true
            setOnTicketPinClickListener { selectedTicket = it; renderMapPreview(it) }
        }
        root.addView(fieldMap, LinearLayout.LayoutParams(-1, 0, 1f))
        mapPreview = panel(16)
        root.addView(mapPreview, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
        addScreen(root)
    }

    private fun buildAccount() {
        val root = column(20)
        root.addView(label("Akun kamu", 28f, bold = true)); gap(root, 24)
        val identity = panel()
        identity.background=OrbitBackdrop()
        accountAvatar=AvatarView(this).apply { bind(session.userName.orEmpty(),session.userAvatar) }
        identity.addView(accountAvatar,LinearLayout.LayoutParams(dp(58),dp(58))); gap(identity,16)
        accountName=label(session.userName ?: "Tim",22f,bold=true); identity.addView(accountName)
        accountEmail=label(session.userEmail.orEmpty(),13f,HelpdeskTheme.muted); identity.addView(accountEmail); gap(identity,10)
        identity.addView(label(ProfileActivity.roleLabel(session.userRole)+" · v" + packageManager.getPackageInfo(packageName, 0).versionName, 11f, Color.rgb(156, 174, 255)))
        gap(identity,18); button(identity,"Edit profil  ↗") { profileLauncher.launch(Intent(this,ProfileActivity::class.java)) }
        root.addView(identity); gap(root)
        val tracking = panel()
        tracking.addView(label("Lokasi & notifikasi", 17f, bold = true)); gap(tracking, 8)
        accountGps = label("", 12f, HelpdeskTheme.muted); tracking.addView(accountGps); gap(tracking)
        button(tracking, "Periksa izin lokasi") { showLocationHelp() }; gap(tracking, 10)
        button(tracking, "Pengaturan notifikasi") { NotificationHelper.openNotificationSettings(this) }; gap(tracking, 10)
        button(tracking, "Pengaturan baterai aplikasi") { safeOpen(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + packageName))) }
        root.addView(tracking); gap(root)
        button(root, "Sinkronkan data sekarang") { refreshTickets(true) }; gap(root, 10)
        val updatesPanel = panel(18)
        updatesPanel.addView(label("Pembaruan tampilan", 16f, bold = true)); gap(updatesPanel, 8)
        configurationStatus = label("", 12f, HelpdeskTheme.muted)
        updatesPanel.addView(configurationStatus); gap(updatesPanel, 12)
        button(updatesPanel, "Periksa pembaruan tampilan") { refreshMobileConfiguration(true) }
        root.addView(updatesPanel); gap(root, 16)
        button(root, "Buka helpdesk di browser") { safeOpen(Intent(Intent.ACTION_VIEW, Uri.parse(session.serverUrl))) }; gap(root, 24)
        button(root, "Keluar dari akun") { confirmLogout() }; gap(root, 24)
        root.addView(label("Draf dan antrean offline disimpan per akun. GPS hanya aktif saat ada pekerjaan yang belum selesai.", 11f, HelpdeskTheme.muted))
        addScreen(scroll(root))
    }

    private fun buildNavigation() {
        val labels = listOf("Beranda", "Tiket", "Chat", "Peta", "Akun")
        val icons = listOf(R.drawable.ic_ln_home, R.drawable.ic_ln_tasks, R.drawable.ic_ln_chat_round, R.drawable.ic_ln_map, R.drawable.ic_ln_user)
        labels.forEachIndexed { index, name ->
            val item = column().apply {
                gravity = Gravity.CENTER; isClickable = true; isFocusable = true; contentDescription = name
                setOnClickListener { selectTab(index) }
            }
            val icon = ImageView(this).apply { setImageResource(icons[index]); importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
            val text = label(name, 10f)
            navIcons.add(icon); navLabels.add(text)
            val iconRow = FrameLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(36), dp(24)).apply { gravity = Gravity.CENTER }
            }
            iconRow.addView(icon, FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER))
            if (index == 1) {
                ticketBadge = label("", 9f, Color.WHITE, bold = true).apply {
                    gravity = Gravity.CENTER
                    minWidth = dp(16)
                    setPadding(dp(4), dp(1), dp(4), dp(1))
                    background = HelpdeskTheme.shape(this@MainActivity, Color.rgb(220, 38, 38), 10, Color.TRANSPARENT)
                    visibility = View.GONE
                }
                iconRow.addView(ticketBadge, FrameLayout.LayoutParams(-2, dp(15), Gravity.TOP or Gravity.END).apply {
                    topMargin = 0
                    rightMargin = 0
                })
            }
            item.addView(iconRow)
            item.addView(text, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(2) })
            navigation.addView(item, LinearLayout.LayoutParams(0, dp(58), 1f).apply { setMargins(dp(2), 0, dp(2), 0) })
        }
    }

    private fun selectTab(index: Int) {
        val changed=activeTab!=index
        activeTab = index.coerceIn(0, 4)
        screens.forEachIndexed { i, screen -> screen.visibility = if (i == activeTab) View.VISIBLE else View.GONE }
        for (i in 0..4) {
            val active = i == activeTab
            navigation.getChildAt(i).background = HelpdeskTheme.shape(this, if (active) HelpdeskTheme.blue else Color.TRANSPARENT, 22, Color.TRANSPARENT)
            navigation.getChildAt(i).isSelected = active
            navIcons[i].setColorFilter(if (active) HelpdeskTheme.text else HelpdeskTheme.muted)
            navLabels[i].setTextColor(if (active) HelpdeskTheme.text else HelpdeskTheme.muted)
        }
        heading.text = listOf("HelpDesk", "Daftar tiket", "Chat tim", "Peta lapangan", "Profil")[activeTab]
        swipe.isEnabled = activeTab != 3
        if (activeTab == 1) renderTickets()
        if (activeTab == 2) { renderRooms(); refreshRooms() }
        if (activeTab == 3) renderMap()
        if(changed && (Build.VERSION.SDK_INT<26 || android.animation.ValueAnimator.areAnimatorsEnabled())) {
            screens[activeTab].apply { alpha=0f; translationY=dp(8).toFloat(); animate().alpha(1f).translationY(0f).setDuration(180).start() }
        }
    }

    private fun render() {
        val active = allTickets.count { !LocationPolicy.isFinished(it.status) }
        ticketBadge.text = if (active > 99) "99+" else active.toString()
        ticketBadge.visibility = if (active > 0) View.VISIBLE else View.GONE
        if (navLabels.size > 1) {
            navLabels[1].text = if (active > 0) "Tiket ($active)" else "Tiket"
        }
        navigation.getChildAt(1).contentDescription = "Tiket, $active harus dikerjakan"
        val working = allTickets.count { it.status in setOf("accepted", "on_site", "in_progress") }
        val overdue = allTickets.count { !LocationPolicy.isFinished(it.status) && (TicketAdapter.parseIsoDate(it.slaResolutionDue)?.time ?: Long.MAX_VALUE) < System.currentTimeMillis() }
        val done = allTickets.count { it.status in setOf("resolved", "closed") }
        listOf(allTickets.size, working, overdue, done).forEachIndexed { index, count -> statValues[index].text = if (hasData) count.toString() else "—" }
        if (hasData) session.activeTicketsCount = active
        val zone = TimeZone.getTimeZone("Asia/Jakarta")
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }
        val keys = (6 downTo 0).map { offset -> Calendar.getInstance(zone).apply { add(Calendar.DAY_OF_YEAR, -offset) }.time }
        chart.setData(keys.map { date -> allTickets.count { TicketAdapter.parseIsoDate(it.createdAt)?.let { created -> day.format(created) == day.format(date) } == true } }.toIntArray(),
            keys.map { SimpleDateFormat("EEE", Locale("id", "ID")).apply { timeZone = zone }.format(it) })
        homeRecent.removeAllViews()
        if (hasData && active > 0) homeRecent.addView(label("$active tiket aktif menunggu penanganan", 14f, HelpdeskTheme.blue, bold = true).apply { setPadding(0, 0, 0, dp(12)); setOnClickListener { selectTab(1) } })
        val recent = allTickets.filter { !LocationPolicy.isFinished(it.status) }.take(mobileConfiguration.recentTicketLimit)
        if (recent.isEmpty()) homeRecent.addView(label(if (hasData) "Tidak ada tiket aktif. Semua sudah tertangani." else "Tiket akan tampil setelah data berhasil dimuat.", 13f, HelpdeskTheme.muted))
        recent.forEach { ticket ->
            val card = panel(17)
            card.addView(label("#" + ticket.ticketNumber + "  ·  " + NotificationHelper.formatStatusName(ticket.status), 10f, Color.rgb(156, 174, 255))); gap(card, 8)
            card.addView(label(ticket.title, 14f, bold = true)); gap(card, 5)
            card.addView(label(ticket.reporterName ?: "Pelanggan", 11f, HelpdeskTheme.muted))
            card.isClickable = true; card.isFocusable = true; card.setOnClickListener { openTicket(ticket) }
            homeRecent.addView(card); gap(homeRecent, 10)
        }
        updateGpsUi(); updateSyncBanner(); renderTickets(); renderNotificationCount()
        if (activeTab == 3) renderMap()
    }

    private fun renderTickets() {
        if (!::ticketsAdapter.isInitialized) return
        val filtered = allTickets.filter { ticket ->
            val matches = when (ticketFilter) {
                "active" -> !LocationPolicy.isFinished(ticket.status)
                "working" -> ticket.status in setOf("accepted", "on_site", "in_progress")
                "pending" -> ticket.status in setOf("pending", "waiting_for_user", "waiting_for_third_party")
                "done" -> ticket.status in setOf("resolved", "closed")
                "overdue" -> !LocationPolicy.isFinished(ticket.status) && (TicketAdapter.parseIsoDate(ticket.slaResolutionDue)?.time ?: Long.MAX_VALUE) < System.currentTimeMillis()
                else -> true
            }
            matches && (query.isBlank() || listOf(ticket.title, ticket.ticketNumber.toString(), ticket.reporterName.orEmpty(), ticket.reporterAddress.orEmpty()).any { it.contains(query.trim(), ignoreCase = true) })
        }.sortedWith(compareBy<TicketItem> { if (LocationPolicy.isFinished(it.status)) 1 else 0 }.thenBy { listOf("critical", "high", "medium", "low").indexOf(it.priority).let { rank -> if (rank < 0) 4 else rank } }.thenBy { TicketAdapter.parseIsoDate(it.slaResolutionDue)?.time ?: Long.MAX_VALUE })
        ticketsAdapter.submitList(filtered)
        ticketCount.text = filtered.size.toString() + " tiket · " + if (ticketFilter == "overdue") "SLA terlewat" else "urut prioritas & batas SLA"
        ticketEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        filterLabels.forEach { (key, chip) ->
            val active = key == ticketFilter
            chip.background = HelpdeskTheme.shape(this, if (active) HelpdeskTheme.blue else HelpdeskTheme.surface, 24)
            chip.setTextColor(if (active) Color.WHITE else HelpdeskTheme.muted); chip.isSelected = active
        }
    }

    private fun renderMap() {
        val active = allTickets.filter { !LocationPolicy.isFinished(it.status) }
        val mapped = active.count { LocationPolicy.hasCoordinates(it.latitude, it.longitude) }
        mapSummary.text = mapped.toString() + " titik tersedia · " + (active.size - mapped) + " tiket belum memiliki koordinat"
        val fresh = LocationPolicy.isFresh(session.lastUpdateTime)
        fieldMap.setMapData(if (fresh) session.lastLatitude else 0.0, if (fresh) session.lastLongitude else 0.0, active, selectedTicket?.id)
        val chosen = selectedTicket?.let { selected -> active.firstOrNull { it.id == selected.id } }
        if (chosen != null) renderMapPreview(chosen)
        else {
            mapPreview.removeAllViews()
            mapPreview.addView(label(if (mapped == 0) "Belum ada koordinat tiket. Perbarui titik pelanggan dari halaman detail." else "Ketuk pin untuk melihat tiket dan membuka navigasi.", 12f, HelpdeskTheme.muted))
        }
    }
    private fun renderMapPreview(ticket: TicketItem) {
        selectedTicket = ticket; mapPreview.removeAllViews()
        mapPreview.addView(label("#" + ticket.ticketNumber + " · " + ticket.title, 14f, bold = true))
        mapPreview.addView(label(ticket.reporterAddress ?: "Alamat belum tersedia", 11f, HelpdeskTheme.muted)); gap(mapPreview, 12)
        button(mapPreview, "Buka detail & navigasi", true) { openTicket(ticket) }
    }
    private fun refreshTickets(showLoading: Boolean) {
        if (loading || !session.isLoggedIn) { swipe.isRefreshing = false; return }
        val token = session.token ?: return
        loading = true
        if (showLoading) swipe.isRefreshing = true
        lifecycleScope.launch {
            try {
                if (OfflineSyncManager.isOnline(this@MainActivity)) OfflineSyncManager.flushAllPendingQueues(this@MainActivity, session)
                val result = ApiClient.getTickets(session.serverUrl, token)
                result.onSuccess {
                    val pending = OfflineSyncManager.getQueuedActions(this@MainActivity)
                    connected = true; allTickets = it.map { ticket ->
                        val action = pending.lastOrNull { action -> action.ticketId == ticket.id && action.actionType in setOf("work_report", "status_update") }
                        if (action != null) ticket.copy(status = if (action.actionType == "work_report") "resolved" else action.status ?: ticket.status) else ticket
                    }; hasData = true
                    OfflineSyncManager.saveCachedTickets(this@MainActivity, allTickets)
                    render()
                    NotificationHelper.syncAndDispatchNotifications(this@MainActivity, session, it)?.let { payload -> notifications = payload.notifications }
                }.onFailure {
                    connected = false
                    if (it is ApiException && it.statusCode in setOf(401, 403)) { expireSession(); return@launch }
                    val cached = OfflineSyncManager.getCachedTickets(this@MainActivity)
                    if (cached.isNotEmpty()) { allTickets = cached; hasData = true }
                }
                render(); ensureService(); maybeRequestLocation()
            } finally {
                loading = false; swipe.isRefreshing = false
                if (realtimeRefreshPending && !isFinishing) { realtimeRefreshPending = false; refreshTickets(false) }
            }
        }
    }

    private fun hasLocationPermission() = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    private fun locationEnabled() = LocationManagerCompat.isLocationEnabled(getSystemService(LOCATION_SERVICE) as LocationManager)

    private fun maybeRequestLocation() {
        if (permissionsBusy || session.userRole != "agent" || session.activeTicketsCount <= 0 || hasLocationPermission()) return
        if (!preferences.getBoolean("asked_location", false)) {
            preferences.edit().putBoolean("asked_location", true).apply()
            permissionsBusy = true
            locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    private fun showLocationHelp() {
        if (session.userRole != "agent") { toast("Pelacakan lokasi hanya untuk akun teknisi."); return }
        if (session.activeTicketsCount <= 0) { toast("GPS otomatis aktif saat kamu memiliki tiket yang belum selesai."); return }
        if (!hasLocationPermission()) {
            if (!preferences.getBoolean("asked_location", false) || shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
                permissionsBusy = true; preferences.edit().putBoolean("asked_location", true).apply()
                locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            } else safeOpen(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + packageName)))
        } else if (!locationEnabled()) safeOpen(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        else {
            try {
                ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java).setAction(LocationTrackingService.ACTION_FORCE_PING))
                toast("Memperbarui lokasi...")
            } catch (_: RuntimeException) { toast("Lokasi belum dapat dimulai. Coba buka ulang aplikasi.") }
        }
    }

    private fun ensureService() {
        if (!session.isLoggedIn || isFinishing) return
        try { ContextCompat.startForegroundService(this, Intent(this, LocationTrackingService::class.java).setAction(LocationTrackingService.ACTION_START)) }
        catch (_: RuntimeException) { session.isDutyActive = false; updateGpsUi() }
    }

    private fun updateGpsUi() {
        if (!::gpsTitle.isInitialized) return
        val ready = LocationPolicy.canTrack(session.isLoggedIn, session.userRole, session.activeTicketsCount, hasLocationPermission(), locationEnabled())
        val fresh = LocationPolicy.isFresh(session.lastUpdateTime)
        val title = when {
            session.userRole != "agent" -> "Lokasi khusus teknisi"
            session.activeTicketsCount <= 0 -> "GPS siaga · Tidak ada tiket aktif"
            !hasLocationPermission() -> "GPS memerlukan izin lokasi"
            !locationEnabled() -> "GPS perangkat belum aktif"
            !ready || !session.isDutyActive -> "GPS sedang disiapkan"
            !fresh -> "Mencari lokasi terbaru..."
            !OfflineSyncManager.isOnline(this) -> "GPS aktif · Menunggu koneksi"
            else -> "GPS aktif · Lokasi terbaru"
        }
        val summary = if (ready && fresh && LocationPolicy.hasCoordinates(session.lastLatitude, session.lastLongitude)) {
            String.format(Locale.US, "%.5f, %.5f · ±%.0f m", session.lastLatitude, session.lastLongitude, session.lastAccuracy)
        } else "Aktif otomatis saat ada tiket. Ketuk untuk memeriksa lokasi."
        gpsTitle.text = title
        gpsTitle.setTextColor(if (ready && fresh && session.isDutyActive) HelpdeskTheme.green else HelpdeskTheme.text)
        gpsSummary.text = summary
        accountGps.text = title + "\n\nGPS mengirim lokasi setiap 5 menit selama ada pekerjaan aktif (mode optimal & hemat baterai). Izin notifikasi tidak menghalangi izin lokasi."
    }

    private fun updateSyncBanner() {
        val pending = OfflineSyncManager.getTotalPendingSyncCount(this)
        syncBanner.visibility = if (!connected || !OfflineSyncManager.isOnline(this) || pending > 0) View.VISIBLE else View.GONE
        syncBanner.text = when {
            pending > 0 -> pending.toString() + " perubahan tersimpan · Akan dikirim saat terhubung. Ketuk untuk mencoba."
            hasData -> "Koneksi belum tersedia · Menampilkan tiket tersimpan. Tarik untuk mencoba lagi."
            else -> "Data belum dapat dimuat · Periksa koneksi lalu tarik untuk mencoba lagi."
        }
        syncBanner.setOnClickListener { refreshTickets(true) }
    }

    private fun renderNotificationCount() {
        val count = notifications.count { !it.isRead }
        notificationCount.visibility = if (count > 0) View.VISIBLE else View.GONE
        notificationCount.text = if (count > 9) "9+" else count.toString()
    }

    private fun showNotifications() {
        val content = column(20)
        content.addView(label("Notifikasi", 22f, bold = true)); gap(content)
        val dialog = AlertDialog.Builder(this).setView(scroll(content)).setPositiveButton("Tutup", null).create()
        if (notifications.any { !it.isRead }) {
            val markRead = HelpdeskTheme.button(this, "Tandai semua dibaca") {}
            markRead.setOnClickListener {
                markRead.isEnabled = false; markRead.text = "Menyimpan..."
                lifecycleScope.launch {
                    val saved = NotificationHelper.markAllRead(this@MainActivity, session, notifications)
                    if (saved) {
                        notifications = NotificationHelper.latestCachedPayload?.notifications ?: notifications.map { it.copy(isRead = true) }
                        renderNotificationCount(); dialog.dismiss(); toast("Semua notifikasi sudah dibaca.")
                    } else {
                        markRead.isEnabled = true; markRead.text = "Tandai semua dibaca"
                        toast("Belum tersimpan. Periksa koneksi lalu coba lagi.")
                    }
                }
            }
            content.addView(markRead); gap(content, 12)
        }
        if (notifications.isEmpty()) content.addView(label("Belum ada notifikasi baru.", 13f, HelpdeskTheme.muted))
        notifications.take(20).forEach { notification ->
            val item = panel(14)
            item.addView(label(notification.title, 14f, bold = !notification.isRead))
            item.addView(label(notification.message, 12f, HelpdeskTheme.muted))
            item.isClickable = true; item.isFocusable = true
            item.setOnClickListener {
                session.markLocalNotificationRead(notification.id)
                notifications = notifications.map { if (it.id == notification.id) it.copy(isRead = true) else it }
                renderNotificationCount()
                lifecycleScope.launch { session.token?.let { ApiClient.markNotificationRead(session.serverUrl, it, notification.id) } }
                dialog.dismiss()
                notification.ticketId?.let { id ->
                    val cached = allTickets.firstOrNull { it.id == id }
                    if (cached != null) openTicket(cached, if (notification.type == "new_message") 1 else 0)
                    else detailLauncher.launch(Intent(this, TicketDetailActivity::class.java)
                        .putExtra(TicketDetailActivity.EXTRA_TICKET_ID, id)
                        .putExtra(TicketDetailActivity.EXTRA_TICKET_NUMBER, notification.ticketNumber)
                        .putExtra(TicketDetailActivity.EXTRA_TITLE, notification.ticketTitle)
                        .putExtra(TicketDetailActivity.EXTRA_INITIAL_TAB, if (notification.type == "new_message") 1 else 0))
                }
            }
            content.addView(item); gap(content, 8)
        }
        dialog.show()
    }

    private fun openTicket(ticket: TicketItem, tab: Int = 0, accept: Boolean = false) {
        if(tab==1) { startActivity(Intent(this,TeamChatActivity::class.java).putExtra("ticket_id",ticket.id).putExtra("ticket_number",ticket.ticketNumber).putExtra("title",ticket.title)); return }
        detailLauncher.launch(Intent(this, TicketDetailActivity::class.java).apply {
            putExtra(TicketDetailActivity.EXTRA_TICKET_ID, ticket.id)
            putExtra(TicketDetailActivity.EXTRA_TICKET_NUMBER, ticket.ticketNumber)
            putExtra(TicketDetailActivity.EXTRA_TITLE, ticket.title)
            putExtra(TicketDetailActivity.EXTRA_STATUS, ticket.status)
            putExtra(TicketDetailActivity.EXTRA_PRIORITY, ticket.priority)
            putExtra(TicketDetailActivity.EXTRA_TYPE, ticket.ticketType)
            putExtra(TicketDetailActivity.EXTRA_REPORTER_NAME, ticket.reporterName)
            putExtra(TicketDetailActivity.EXTRA_REPORTER_PHONE, ticket.reporterPhone)
            putExtra(TicketDetailActivity.EXTRA_REPORTER_ADDRESS, ticket.reporterAddress)
            putExtra(TicketDetailActivity.EXTRA_REPORTER_MAP_URL, ticket.reporterMapUrl)
            putExtra(TicketDetailActivity.EXTRA_LATITUDE, ticket.latitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_LONGITUDE, ticket.longitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_DESCRIPTION, ticket.description)
            putExtra(TicketDetailActivity.EXTRA_INITIAL_TAB, tab)
            putExtra("accept_ticket", accept)
        })
    }

    private fun confirmLogout() {
        val pending = OfflineSyncManager.getTotalPendingSyncCount(this)
        AlertDialog.Builder(this).setTitle("Keluar dari HelpDesk?")
            .setMessage(if (pending > 0) pending.toString() + " perubahan offline tetap tersimpan untuk akun ini. Masuk kembali untuk menyinkronkannya." else "Kamu dapat masuk kembali lewat web atau akun.")
            .setNegativeButton("Batal", null).setPositiveButton("Keluar") { _, _ -> expireSession() }.show()
    }
    private fun expireSession() {
        val oldToken = session.token
        stopService(Intent(this, LocationTrackingService::class.java))
        polling?.cancel()
        session.logout()
        lifecycleScope.launch {
            if (oldToken != null) kotlinx.coroutines.withTimeoutOrNull(2500) { ApiClient.stopLocation(session.serverUrl, oldToken) }
            openLogin()
        }
    }
    private fun openLogin() {
        startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        finish()
    }
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    private fun safeOpen(intent: Intent) {
        try { startActivity(intent) } catch (_: RuntimeException) { toast("Aplikasi yang diperlukan belum tersedia.") }
    }

    private fun applyMobileConfiguration() {
        homeSubtitle.text = mobileConfiguration.homeSubtitle
        announcement.visibility = if (mobileConfiguration.announcementBody.isBlank()) View.GONE else View.VISIBLE
        announcementTitle.text = mobileConfiguration.announcementTitle.ifBlank { "Informasi tim" }
        announcementBody.text = mobileConfiguration.announcementBody
        activityPanel.visibility = if (mobileConfiguration.showActivityChart) View.VISIBLE else View.GONE
        configurationStatus.text = if (mobileConfiguration.version == 0L) "Pengaturan bawaan · diperbarui otomatis saat online."
            else "Konfigurasi v${mobileConfiguration.version} aktif · tersimpan untuk penggunaan offline."
    }

    private fun refreshMobileConfiguration(manual: Boolean = false, force: Boolean = false) {
        if (configurationJob?.isActive == true) { if (force || manual) configurationRefreshPending = true; return }
        val now = android.os.SystemClock.elapsedRealtime()
        if (!manual && !force && configurationLastAttempt > 0 && now - configurationLastAttempt < 60_000) return
        val token = session.token ?: return
        val account = session.userId ?: return
        configurationLastAttempt = now
        configurationJob = lifecycleScope.launch {
            try {
            val result = ApiClient.getMobileConfiguration(session.serverUrl, token)
            if (!isActive || session.token != token || session.userId != account) return@launch
            val raw = result.getOrNull()
            val incoming = raw?.let { runCatching { MobileConfiguration.parse(it, configurationAppVersion) }.getOrNull() }
            if (incoming != null) {
                showApkUpdate(raw, manual)
                if (incoming.version != mobileConfiguration.version && incoming.version > 0) {
                    configurationStatus.text = "Pembaruan v${incoming.version} tersedia · menunggu diterapkan."
                    if ((manual || deferredConfigurationVersion != incoming.version) && (configurationDialog?.isShowing != true || offeredConfigurationVersion != incoming.version)) {
                        configurationDialog?.dismiss()
                        offeredConfigurationVersion = incoming.version
                        configurationDialog = AlertDialog.Builder(this@MainActivity)
                            .setTitle("Pembaruan tersedia")
                            .setMessage("Pembaruan tampilan v${incoming.version} dari pengelola helpdesk.\n\n" + incoming.releaseNote.ifBlank { "Pengaturan tampilan terbaru tersedia untuk tim." } + "\n\nTerapkan sekarang? Draft laporan dan data offline tetap tersimpan.")
                            .setPositiveButton("Terapkan sekarang") { _, _ ->
                                if (session.token == token && session.userId == account) {
                                    session.mobileConfigurationJson = raw
                                    mobileConfiguration = incoming
                                    applyMobileConfiguration(); render(); acknowledgeMobileConfiguration()
                                    toast("Pembaruan v${incoming.version} berhasil diterapkan.")
                                }
                            }
                            .setNegativeButton("Nanti") { _, _ -> deferredConfigurationVersion = incoming.version }
                            .setOnCancelListener { deferredConfigurationVersion = incoming.version }
                            .create().also { it.show() }
                    }
                } else {
                    session.mobileConfigurationJson = raw
                    mobileConfiguration = incoming
                    applyMobileConfiguration()
                    acknowledgeMobileConfiguration()
                    showApkUpdate(raw, manual)
                    if (manual) toast("Konfigurasi tampilan sudah terbaru.")
                }
            } else {
                configurationStatus.text = "Belum dapat memeriksa pembaruan. Pengaturan terakhir tetap digunakan."
                if (manual) toast("Belum dapat memuat pembaruan. Coba lagi saat online.")
            }
            } finally {
                configurationJob = null
                if (configurationRefreshPending && !isFinishing) {
                    configurationRefreshPending = false
                    refreshMobileConfiguration(force = true)
                }
            }
        }
    }

    private fun acknowledgeMobileConfiguration() {
        if (acknowledgementBusy || acknowledgedConfigurationVersion == mobileConfiguration.version) return
        val token = session.token ?: return
        val account = session.userId
        val version = mobileConfiguration.version
        acknowledgementBusy = true
        lifecycleScope.launch {
            try {
                val appVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: "3.3.1"
                val result = ApiClient.acknowledgeConfiguration(session.serverUrl, token, version, configurationAppVersion, appVersion)
                if (result.isSuccess && session.token == token && session.userId == account) acknowledgedConfigurationVersion = version
            } finally { acknowledgementBusy = false }
        }
    }

    private fun showApkUpdate(raw: String, manual: Boolean) {
        val apk = runCatching { org.json.JSONObject(raw).optJSONObject("apk") }.getOrNull() ?: return
        val code = apk.optLong("versionCode")
        if (code <= configurationAppVersion || configurationDialog?.isShowing == true) return
        val shown = preferences.getLong("apk_update_shown", 0)
        if (!manual && shown == code) return
        preferences.edit().putLong("apk_update_shown", code).apply()
        configurationDialog = AlertDialog.Builder(this)
            .setTitle("Versi aplikasi baru tersedia")
            .setMessage("HelpDesk " + apk.optString("versionName").take(24) + "\n\n" + apk.optString("releaseNotes").take(1200))
            .setPositiveButton("Buka pembaruan") { _, _ -> safeOpen(Intent(Intent.ACTION_VIEW, Uri.parse(session.serverUrl + "/download"))) }
            .setNegativeButton("Nanti", null).create().also { it.show() }
    }

    override fun onResume() {
        super.onResume()
        if (!::swipe.isInitialized || !session.isLoggedIn) return
        ContextCompat.registerReceiver(this, updates, IntentFilter().apply {
            addAction(LocationTrackingService.ACTION_LOCATION_UPDATED)
            addAction(OfflineSyncManager.ACTION_SYNC_STATE_CHANGED)
            addAction(NotificationHelper.ACTION_NOTIFICATION_SYNCED)
            addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
        }, ContextCompat.RECEIVER_NOT_EXPORTED)
        ensureService(); refreshTickets(false); refreshRooms()
        realtimeJob?.cancel()
        realtimeJob = net.infinityteknik.helpdesk.util.RealtimeUpdates.start(this, session) {
            if (loading) realtimeRefreshPending = true else refreshTickets(false)
            refreshRooms()
            refreshMobileConfiguration(force = true)
        }
        refreshMobileConfiguration(force = true)
        polling?.cancel()
        polling = lifecycleScope.launch {
            var lastDataRefresh = android.os.SystemClock.elapsedRealtime()
            while (isActive) {
                delay(5_000)
                refreshMobileConfiguration()
                val now = android.os.SystemClock.elapsedRealtime()
                if (now - lastDataRefresh >= mobileConfiguration.refreshIntervalSeconds * 1000L) {
                    lastDataRefresh = now
                    refreshTickets(false); if (activeTab == 2) refreshRooms()
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 33 && !preferences.getBoolean("asked_notifications", false)) {
            preferences.edit().putBoolean("asked_notifications", true).apply()
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsBusy = true; notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        updateGpsUi()
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("report_completed", false) && ::swipe.isInitialized) {
            ticketFilter = "all"; query = ""; searchInput.setText("")
            allTickets = OfflineSyncManager.getCachedTickets(this)
            selectTab(1); render(); refreshTickets(false)
        }
    }
    override fun onPause() {
        configurationRefreshPending = false
        configurationDialog?.dismiss(); configurationDialog = null
        realtimeRefreshPending = false
        realtimeJob?.cancel(); realtimeJob = null
        polling?.cancel(); polling = null
        configurationJob?.cancel(); configurationJob = null
        try { unregisterReceiver(updates) } catch (_: IllegalArgumentException) {}
        super.onPause()
    }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putInt("tab", activeTab); outState.putString("filter", ticketFilter); outState.putString("query", query)
        super.onSaveInstanceState(outState)
    }
}
