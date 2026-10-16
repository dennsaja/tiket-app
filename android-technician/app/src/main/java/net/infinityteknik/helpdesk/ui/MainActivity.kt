package net.infinityteknik.helpdesk.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
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
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import net.infinityteknik.helpdesk.service.LocationTrackingService
import net.infinityteknik.helpdesk.util.TrackingScheduleManager
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var session: SessionManager

    private lateinit var tvTechnicianName: TextView
    private lateinit var btnRefreshTop: ImageButton
    private lateinit var btnLogout: ImageButton
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
    private var selectedFilterIndex = 0 // 0 = All, 1 = Active, 2 = Resolved
    private var searchQuery = ""
    private var realtimePollJob: Job? = null

    private val detailLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadTickets(silent = true)
        }
    }

    private val permissionLauncher = registerForActivityResult(
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

    private val locationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == LocationTrackingService.ACTION_LOCATION_UPDATED) {
                val lat = intent.getDoubleExtra("lat", 0.0)
                val lng = intent.getDoubleExtra("lng", 0.0)
                val acc = intent.getFloatExtra("acc", 0f)
                val battery = intent.getIntExtra("battery", -1)
                updateGpsDisplay(lat, lng, acc, battery, System.currentTimeMillis())
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        session = SessionManager(this)

        initViews()
        setupRecyclerView()
        checkAndRequestPermissions()

        evaluateTrackingRules(session.activeTicketsCount)
        if (session.isDutyActive) {
            startTrackingService()
        } else {
            updateDutyUi(false)
        }

        loadTickets(silent = false)
        loadUserProfile()
    }

    private fun initViews() {
        tvTechnicianName = findViewById(R.id.tvTechnicianName)
        btnRefreshTop = findViewById(R.id.btnRefreshTop)
        btnLogout = findViewById(R.id.btnLogout)
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

        switchDuty.isChecked = session.isDutyActive
        switchDuty.setOnCheckedChangeListener { _, isChecked ->
            // Enforce smart tracking rules: cannot turn OFF if during 08:00-16:00 WIB or active tasks exist
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
        }

        swipeRefresh.setOnRefreshListener {
            loadTickets(silent = false)
            loadUserProfile()
        }

        btnLogout.setOnClickListener {
            confirmLogout()
        }

        // KPI Filter Click Listeners
        cardFilterAll.setOnClickListener { selectFilter(0) }
        cardFilterActive.setOnClickListener { selectFilter(1) }
        cardFilterResolved.setOnClickListener { selectFilter(2) }

        // Search input live listener
        etSearchTickets.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                searchQuery = s?.toString()?.trim() ?: ""
                applyFiltersAndRender()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Show cached coordinates if available
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
                Toast.makeText(this@MainActivity, "Status tiket #${ticket.ticketNumber} diperbarui!", Toast.LENGTH_SHORT).show()
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

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
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
                checkAndRequestPermissions()
                startTrackingService()
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
                session.userName = profile.name
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
                stopTrackingService()
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
        val filter = IntentFilter(LocationTrackingService.ACTION_LOCATION_UPDATED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(locationReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(locationReceiver, filter)
        }

        // Start 10s real-time ticket sync while screen is active
        realtimePollJob?.cancel()
        realtimePollJob = lifecycleScope.launch {
            while (isActive) {
                delay(10_000L)
                loadTickets(silent = true)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        realtimePollJob?.cancel()
        realtimePollJob = null
        try {
            unregisterReceiver(locationReceiver)
        } catch (e: Exception) {}
    }
}
