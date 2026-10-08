package net.infinityteknik.helpdesk.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
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
    private lateinit var btnLogout: ImageButton
    private lateinit var viewGpsDot: View
    private lateinit var tvDutyStatus: TextView
    private lateinit var switchDuty: SwitchMaterial
    private lateinit var tvGpsCoords: TextView
    private lateinit var tvLastUpdated: TextView
    private lateinit var btnForceLocation: MaterialButton
    private lateinit var tvTicketCount: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTickets: RecyclerView
    private lateinit var tvEmptyState: TextView

    private lateinit var ticketAdapter: TicketAdapter

    private val detailLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadTickets()
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

        loadTickets()
        loadUserProfile()
    }

    private fun initViews() {
        tvTechnicianName = findViewById(R.id.tvTechnicianName)
        btnLogout = findViewById(R.id.btnLogout)
        viewGpsDot = findViewById(R.id.viewGpsDot)
        tvDutyStatus = findViewById(R.id.tvDutyStatus)
        switchDuty = findViewById(R.id.switchDuty)
        tvGpsCoords = findViewById(R.id.tvGpsCoords)
        tvLastUpdated = findViewById(R.id.tvLastUpdated)
        btnForceLocation = findViewById(R.id.btnForceLocation)
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
                startTrackingService()
                Toast.makeText(this, "Memperbarui koordinat GPS...", Toast.LENGTH_SHORT).show()
            }
        }

        swipeRefresh.setOnRefreshListener {
            loadTickets()
            loadUserProfile()
        }

        btnLogout.setOnClickListener {
            confirmLogout()
        }

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

    private fun setupRecyclerView() {
        ticketAdapter = TicketAdapter(
            context = this,
            onUpdateClick = { ticket -> showUpdateStatusDialog(ticket) },
            onDetailClick = { ticket -> openTicketDetail(ticket) }
        )
        rvTickets.layoutManager = LinearLayoutManager(this)
        rvTickets.adapter = ticketAdapter
    }

    private fun openTicketDetail(ticket: TicketItem) {
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
            putExtra(TicketDetailActivity.EXTRA_LATITUDE, ticket.latitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_LONGITUDE, ticket.longitude ?: 0.0)
            putExtra(TicketDetailActivity.EXTRA_DESCRIPTION, ticket.description ?: "")
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
            tvDutyStatus.text = getString(R.string.duty_active)
        } else {
            viewGpsDot.setBackgroundResource(R.drawable.circle_red)
            tvDutyStatus.text = getString(R.string.duty_inactive)
            tvGpsCoords.text = "GPS: Pelacakan Nonaktif"
        }
    }

    private fun updateGpsDisplay(lat: Double, lng: Double, acc: Float, battery: Int, time: Long) {
        val accStr = if (acc > 0) " (±${acc.toInt()}m)" else ""
        tvGpsCoords.text = String.format(Locale.US, "GPS: %.6f, %.6f%s", lat, lng, accStr)

        val timeStr = if (time > 0) {
            val sdf = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            sdf.format(Date(time))
        } else "-"

        val batStr = if (battery >= 0) " • Bat: $battery%" else ""
        tvLastUpdated.text = "Update: $timeStr$batStr"
    }

    private fun loadTickets() {
        swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            val token = session.token ?: return@launch
            val result = ApiClient.getTickets(session.serverUrl, token)
            swipeRefresh.isRefreshing = false

            result.onSuccess { tickets ->
                ticketAdapter.submitList(tickets)
                tvTicketCount.text = "${tickets.size} Tiket"

                // Calculate active tasks count
                val activeCount = tickets.count { t ->
                    val s = t.status.lowercase()
                    s != "resolved" && s != "closed" && s != "cancelled"
                }
                session.activeTicketsCount = activeCount
                evaluateTrackingRules(activeCount)

                if (tickets.isEmpty()) {
                    tvEmptyState.visibility = View.VISIBLE
                    rvTickets.visibility = View.GONE
                } else {
                    tvEmptyState.visibility = View.GONE
                    rvTickets.visibility = View.VISIBLE
                }
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Gagal memuat tiket: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun evaluateTrackingRules(activeCount: Int) {
        if (TrackingScheduleManager.isTrackingMandatory(activeCount)) {
            // Auto ON & Locked
            if (!session.isDutyActive) {
                session.isDutyActive = true
                switchDuty.isChecked = true
                checkAndRequestPermissions()
                startTrackingService()
            }
        } else if (TrackingScheduleManager.shouldAutoTurnOff(activeCount)) {
            // Auto OFF (outside work hours and no active tasks left)
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

    private fun showUpdateStatusDialog(ticket: TicketItem) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_update_status, null)
        val tvSubtitle = dialogView.findViewById<TextView>(R.id.tvDialogSubtitle)
        val rgStatus = dialogView.findViewById<RadioGroup>(R.id.rgStatus)
        val rbInProgress = dialogView.findViewById<RadioButton>(R.id.rbInProgress)
        val rbOnSite = dialogView.findViewById<RadioButton>(R.id.rbOnSite)
        val rbResolved = dialogView.findViewById<RadioButton>(R.id.rbResolved)
        val etNotes = dialogView.findViewById<EditText>(R.id.etStatusNotes)
        val btnCancel = dialogView.findViewById<Button>(R.id.btnCancelDialog)
        val btnSave = dialogView.findViewById<Button>(R.id.btnSaveDialog)

        tvSubtitle.text = "#${ticket.ticketNumber} - ${ticket.title}"

        // Pre-check corresponding radio button
        when (ticket.status.lowercase()) {
            "on_site" -> rbOnSite.isChecked = true
            "resolved" -> rbResolved.isChecked = true
            else -> rbInProgress.isChecked = true
        }

        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        btnCancel.setOnClickListener { dialog.dismiss() }

        btnSave.setOnClickListener {
            val selectedStatus = when (rgStatus.checkedRadioButtonId) {
                R.id.rbOnSite -> "on_site"
                R.id.rbResolved -> "resolved"
                else -> "in_progress"
            }
            val notes = etNotes.text.toString().trim()

            dialog.dismiss()
            performUpdateTicket(ticket.id, selectedStatus, notes)
        }

        dialog.show()
    }

    private fun performUpdateTicket(ticketId: String, status: String, notes: String) {
        val token = session.token ?: return
        Toast.makeText(this, "Menyimpan status...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch {
            val result = ApiClient.updateTicketStatus(
                session.serverUrl,
                token,
                ticketId,
                status,
                notes,
                if (status == "resolved") notes else null
            )

            result.onSuccess {
                Toast.makeText(this@MainActivity, "Status tiket berhasil diperbarui!", Toast.LENGTH_SHORT).show()
                loadTickets()
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Gagal: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle("Keluar Aplikasi")
            .setMessage("Apakah Anda yakin ingin keluar? Pelacakan lokasi akan dihentikan.")
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
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(locationReceiver)
        } catch (e: Exception) {}
    }
}
