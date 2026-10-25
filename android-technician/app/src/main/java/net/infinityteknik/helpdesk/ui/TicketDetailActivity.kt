package net.infinityteknik.helpdesk.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
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
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import net.infinityteknik.helpdesk.util.PhotoWatermarkHelper
import net.infinityteknik.helpdesk.util.LocationPolicy
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class TicketDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_TICKET_ID = "ticket_id"
        const val EXTRA_TICKET_NUMBER = "ticket_number"
        const val EXTRA_TITLE = "title"
        const val EXTRA_STATUS = "status"
        const val EXTRA_PRIORITY = "priority"
        const val EXTRA_TYPE = "type"
        const val EXTRA_REPORTER_NAME = "reporter_name"
        const val EXTRA_REPORTER_PHONE = "reporter_phone"
        const val EXTRA_REPORTER_ADDRESS = "reporter_address"
        const val EXTRA_REPORTER_MAP_URL = "reporter_map_url"
        const val EXTRA_LATITUDE = "latitude"
        const val EXTRA_LONGITUDE = "longitude"
        const val EXTRA_DESCRIPTION = "description"
        const val EXTRA_INITIAL_TAB = "initial_tab"
    }

    private lateinit var session: SessionManager

    private var ticketId: String = ""
    private var ticketNumber: Int = 0
    private var ticketTitle: String = ""
    private var ticketStatus: String = "open"
    private var latestReport: WorkReportSnapshot? = null
    private var metadataLoading = false
    private var realtimeRefreshPending = false
    private var statusUpdating = false
    private var detailSnapshot: TicketItem? = null
    private var ticketPriority: String = "medium"
    private var ticketType: String = ""
    private var reporterName: String = ""
    private var reporterPhone: String = ""
    private var reporterAddress: String = ""
    private var reporterMapUrl: String = ""
    private var latitude: Double = 0.0
    private var longitude: Double = 0.0
    private var ticketDescription: String = ""
    private var slaResolutionDue: String? = null
    private var statusHistory: List<TicketStatusHistoryItem> = emptyList()
    private var initialTab: Int = 0
    private var currentTab: Int = 0
    private var metadataPoll: Job? = null
    private var isRestoringDraft = false

    // Views: Top Bar
    private lateinit var btnBack: ImageButton
    private lateinit var tvDetailTicketNumber: TextView
    private lateinit var tvDetailTicketTitle: TextView
    private lateinit var tvDetailStatusBadge: TextView

    // Views: Tabs
    private lateinit var tabDetail: TextView
    private lateinit var tabChat: TextView
    private lateinit var viewTabDetail: ScrollView

    // Views: Stepper & Progressive Workflow
    private lateinit var tvDetailDistanceRadius: TextView
    private lateinit var btnWorkflowPrimary: MaterialButton
    private lateinit var tvWorkflowSubtitle: TextView
    private lateinit var btnPendingTask: MaterialButton
    private lateinit var layoutResolvedBanner: LinearLayout

    // Views: Customer & Detail Card
    private lateinit var tvInfoTitle: TextView
    private lateinit var tvInfoType: TextView
    private lateinit var tvInfoSla: TextView
    private lateinit var tvInfoCustomerName: TextView
    private lateinit var tvInfoCustomerPhone: TextView
    private lateinit var tvInfoCustomerAddress: TextView
    private lateinit var tvInfoCoordinates: TextView
    private lateinit var tvInfoDescription: TextView
    private lateinit var btnDetailChatShortcut: MaterialButton
    private lateinit var btnDetailCall: MaterialButton
    private lateinit var btnDetailWhatsApp: MaterialButton
    private lateinit var btnDetailMap: MaterialButton
    private lateinit var btnCopyAddress: MaterialButton
    private lateinit var btnUpdateCustomerCoord: MaterialButton
    private lateinit var btnUpdateOdpCoord: MaterialButton
    private lateinit var layoutStatusTimeline: LinearLayout

    // Views: Chat Tab

    // Views: Report Tab (Full PRD Sections)
    private lateinit var tvDraftSavedStatus: TextView
    private lateinit var tvChecklistHeader: TextView
    private lateinit var layoutChecklistContainer: LinearLayout
    private lateinit var etReportOntSerial: EditText
    private lateinit var etReportRouterType: EditText
    private lateinit var etReportSsid: EditText
    private lateinit var etReportOpticalDbm: EditText
    private lateinit var etReportOdpPort: EditText
    private lateinit var tvDbmValidationHint: TextView
    private lateinit var etReportCableLength: EditText
    private lateinit var etReportPingSpeed: EditText
    private lateinit var spinnerRootCause: Spinner
    private lateinit var etReportSummary: EditText
    private lateinit var etReportActionTaken: EditText
    private lateinit var layoutQuickMaterialChips: LinearLayout
    private lateinit var etReportMaterials: EditText
    private lateinit var etReportFinalResult: EditText
    private lateinit var btnCameraBefore: MaterialButton
    private lateinit var tvBeforePhotosCount: TextView
    private lateinit var layoutBeforePreviews: LinearLayout
    private lateinit var btnCameraAfter: MaterialButton
    private lateinit var tvAfterPhotosCount: TextView
    private lateinit var layoutAfterPreviews: LinearLayout
    private lateinit var btnClearSignature: TextView
    private lateinit var etCustomerRecipientName: EditText
    private lateinit var signaturePadView: SignaturePadView
    private lateinit var btnSubmitReport: MaterialButton

    private val checklistCheckBoxes = ArrayList<CheckBox>()
    private val beforePhotoFiles = ArrayList<File>()
    private val afterPhotoFiles = ArrayList<File>()

    private var currentCameraTempFile: File? = null
    private var isCapturingBefore = true
    private var reportSubmitting = false
    private var reportCompleted = false
    private var realtimeJob: Job? = null
    private val submissionPreferences by lazy { getSharedPreferences("report_submissions_" + session.userId, MODE_PRIVATE) }
    private fun reportRequestKey(): String {
        val key = "request_" + ticketId
        return submissionPreferences.getString(key, null) ?: UUID.randomUUID().toString().also {
            submissionPreferences.edit().putString(key, it).commit()
        }
    }
    private val addImageLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val raw = currentCameraTempFile
        if (result.resultCode == RESULT_OK) {
            val before = isCapturingBefore
            val uris = mutableListOf<Uri>()
            if (raw != null && raw.length() > 0) uris.add(FileProvider.getUriForFile(this, "$packageName.fileprovider", raw))
            else {
                result.data?.clipData?.let { clips -> for (i in 0 until clips.itemCount.coerceAtMost(12)) uris.add(clips.getItemAt(i).uri) }
                if (uris.isEmpty()) result.data?.data?.let { uris.add(it) }
            }
            lifecycleScope.launch {
                val photos = withContext(Dispatchers.IO) { uris.distinct().mapNotNull { uri ->
                    runCatching { PhotoWatermarkHelper.processAndWatermarkUri(this@TicketDetailActivity, uri, ticketNumber,
                        if (before) "BEFORE" else "AFTER", session.userName ?: "Teknisi",
                        if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLatitude else 0.0,
                        if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLongitude else 0.0, session.lastAccuracy) }.getOrNull()
                } }
                if (before) beforePhotoFiles.addAll(photos) else afterPhotoFiles.addAll(photos)
                refreshPhotoPreviews(before)
                if (photos.isEmpty() && uris.isNotEmpty()) Toast.makeText(this@TicketDetailActivity, "Gambar belum dapat dibaca. Pilih ulang gambar.", Toast.LENGTH_LONG).show()
                raw?.delete()
            }
        } else raw?.delete()
    }

    private val rootCauseOptions = arrayOf(
        "Instalasi Baru / Pekerjaan Normal",
        "Kabel Dropcore Putus / Terjepit",
        "Konektor / Patchcord Rusak atau Kotor",
        "Redaman Tinggi dari ODP / Splitter",
        "Perangkat ONT / Adaptor / Router Rusak",
        "Konfigurasi Perangkat Ter-reset",
        "Kamera CCTV / DVR / Adaptor Bermasalah",
        "Kendala Lainnya (Lihat Catatan Tindakan)"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ticket_detail)
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = handleBackNavigation()
        })

        session = SessionManager(this)
        readIntentExtras()
        savedInstanceState?.let { state ->
            beforePhotoFiles.addAll(state.getStringArrayList("before_photo_paths").orEmpty().map { File(it) }.filter { it.exists() })
            afterPhotoFiles.addAll(state.getStringArrayList("after_photo_paths").orEmpty().map { File(it) }.filter { it.exists() })
            currentCameraTempFile = state.getString("camera_temp_path")?.let { File(it) }
            isCapturingBefore = state.getBoolean("camera_before", true)
            initialTab = state.getInt("selected_detail_tab", initialTab)
        }
        initViews()
        findViewById<TextView>(R.id.toggleTechnicalDetails).setOnClickListener {
            val cards = listOf(findViewById<View>(R.id.technicalDetailsCard), findViewById<View>(R.id.checklistDetailsCard))
            val expanded = cards.first().visibility != View.VISIBLE
            cards.forEach { card -> card.visibility = if (expanded) View.VISIBLE else View.GONE }
            (it as TextView).text = if (expanded) "Tutup detail teknis opsional −" else "Detail teknis opsional +"
        }
        findViewById<TextView>(R.id.toggleCustomerConfirmation).setOnClickListener {
            val group = findViewById<View>(R.id.customerConfirmation)
            group.visibility = if (group.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            (it as TextView).text = if (group.visibility == View.VISIBLE) "Tutup konfirmasi pelanggan −" else "Konfirmasi pelanggan (opsional) +"
        }
        setupReportChecklistAndMaterials()
        bindTicketData()
        restoreDraftIfAvailable()
        refreshPhotoPreviews(true)
        refreshPhotoPreviews(false)
        setupAutoDraftWatchers()
        updateWorkflowUi(ticketStatus)
        switchTab(initialTab)
        if (intent.getBooleanExtra("accept_ticket", false) && ticketStatus in setOf("open", "assigned", "reopened")) {
            intent.removeExtra("accept_ticket")
            updateStatusTo("accepted", "Teknisi menerima penugasan")
        }
    }

    private fun readIntentExtras() {
        ticketId = intent.getStringExtra(EXTRA_TICKET_ID) ?: ""
        ticketNumber = intent.getIntExtra(EXTRA_TICKET_NUMBER, 0)
        ticketTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        ticketStatus = intent.getStringExtra(EXTRA_STATUS) ?: "open"
        ticketPriority = intent.getStringExtra(EXTRA_PRIORITY) ?: "medium"
        ticketType = intent.getStringExtra(EXTRA_TYPE) ?: ""
        reporterName = intent.getStringExtra(EXTRA_REPORTER_NAME) ?: ""
        reporterPhone = intent.getStringExtra(EXTRA_REPORTER_PHONE) ?: ""
        reporterAddress = intent.getStringExtra(EXTRA_REPORTER_ADDRESS) ?: ""
        reporterMapUrl = intent.getStringExtra(EXTRA_REPORTER_MAP_URL) ?: ""
        latitude = intent.getDoubleExtra(EXTRA_LATITUDE, 0.0)
        longitude = intent.getDoubleExtra(EXTRA_LONGITUDE, 0.0)
        ticketDescription = intent.getStringExtra(EXTRA_DESCRIPTION) ?: ""
        initialTab = intent.getIntExtra(EXTRA_INITIAL_TAB, 0)

        // Chat and notification links only carry an ID; restore the full offline ticket.
        val cached = OfflineSyncManager.getCachedTickets(this).find { it.id == ticketId }
        if (cached != null) {
            detailSnapshot = cached
            if (ticketNumber == 0) ticketNumber = cached.ticketNumber
            if (ticketTitle.isBlank()) ticketTitle = cached.title
            if (!intent.hasExtra(EXTRA_STATUS)) ticketStatus = cached.status
            if (!intent.hasExtra(EXTRA_PRIORITY)) ticketPriority = cached.priority
            if (ticketType.isBlank()) ticketType = cached.ticketType.orEmpty()
            if (reporterName.isBlank()) reporterName = cached.reporterName.orEmpty()
            if (reporterPhone.isBlank()) reporterPhone = cached.reporterPhone.orEmpty()
            if (reporterAddress.isBlank()) reporterAddress = cached.reporterAddress.orEmpty()
            if (reporterMapUrl.isBlank()) reporterMapUrl = cached.reporterMapUrl.orEmpty()
            if (ticketDescription.isBlank()) ticketDescription = cached.description.orEmpty()
            latestReport = cached.latestReport
            slaResolutionDue = cached.slaResolutionDue
            statusHistory = cached.statusHistory
            if (latitude == 0.0 && cached.latitude != null) latitude = cached.latitude
            if (longitude == 0.0 && cached.longitude != null) longitude = cached.longitude
        }
    }

    private fun initViews() {
        btnBack = findViewById(R.id.btnBack)
        tvDetailTicketNumber = findViewById(R.id.tvDetailTicketNumber)
        tvDetailTicketTitle = findViewById(R.id.tvDetailTicketTitle)
        tvDetailStatusBadge = findViewById(R.id.tvDetailStatusBadge)

        tabDetail = findViewById(R.id.tabDetail)
        tabChat = findViewById(R.id.tabChat)
        viewTabDetail = findViewById(R.id.viewTabDetail)

        tvDetailDistanceRadius = findViewById(R.id.tvDetailDistanceRadius)
        btnWorkflowPrimary = findViewById(R.id.btnWorkflowPrimary)
        tvWorkflowSubtitle = findViewById(R.id.tvWorkflowSubtitle)
        btnPendingTask = findViewById(R.id.btnPendingTask)
        layoutResolvedBanner = findViewById(R.id.layoutResolvedBanner)

        tvInfoTitle = findViewById(R.id.tvInfoTitle)
        tvInfoType = findViewById(R.id.tvInfoType)
        tvInfoSla = findViewById(R.id.tvInfoSla)
        tvInfoCustomerName = findViewById(R.id.tvInfoCustomerName)
        tvInfoCustomerPhone = findViewById(R.id.tvInfoCustomerPhone)
        tvInfoCustomerAddress = findViewById(R.id.tvInfoCustomerAddress)
        tvInfoCoordinates = findViewById(R.id.tvInfoCoordinates)
        tvInfoDescription = findViewById(R.id.tvInfoDescription)
        btnDetailChatShortcut = findViewById(R.id.btnDetailChatShortcut)
        btnDetailCall = findViewById(R.id.btnDetailCall)
        btnDetailWhatsApp = findViewById(R.id.btnDetailWhatsApp)
        btnDetailMap = findViewById(R.id.btnDetailMap)
        btnCopyAddress = findViewById(R.id.btnCopyAddress)
        btnUpdateCustomerCoord = findViewById(R.id.btnUpdateCustomerCoord)
        btnUpdateOdpCoord = findViewById(R.id.btnUpdateOdpCoord)
        layoutStatusTimeline = findViewById(R.id.layoutStatusTimeline)

        tvDraftSavedStatus = findViewById(R.id.tvDraftSavedStatus)
        tvChecklistHeader = findViewById(R.id.tvChecklistHeader)
        layoutChecklistContainer = findViewById(R.id.layoutChecklistContainer)
        etReportOntSerial = findViewById(R.id.etReportOntSerial)
        etReportRouterType = findViewById(R.id.etReportRouterType)
        etReportSsid = findViewById(R.id.etReportSsid)
        etReportOpticalDbm = findViewById(R.id.etReportOpticalDbm)
        etReportOdpPort = findViewById(R.id.etReportOdpPort)
        tvDbmValidationHint = findViewById(R.id.tvDbmValidationHint)
        etReportCableLength = findViewById(R.id.etReportCableLength)
        etReportPingSpeed = findViewById(R.id.etReportPingSpeed)
        spinnerRootCause = findViewById(R.id.spinnerRootCause)
        etReportSummary = findViewById(R.id.etReportSummary)
        etReportActionTaken = findViewById(R.id.etReportActionTaken)
        layoutQuickMaterialChips = findViewById(R.id.layoutQuickMaterialChips)
        etReportMaterials = findViewById(R.id.etReportMaterials)
        etReportFinalResult = findViewById(R.id.etReportFinalResult)
        btnCameraBefore = findViewById(R.id.btnCameraBefore)
        tvBeforePhotosCount = findViewById(R.id.tvBeforePhotosCount)
        layoutBeforePreviews = findViewById(R.id.layoutBeforePreviews)
        btnCameraAfter = findViewById(R.id.btnCameraAfter)
        tvAfterPhotosCount = findViewById(R.id.tvAfterPhotosCount)
        layoutAfterPreviews = findViewById(R.id.layoutAfterPreviews)
        btnClearSignature = findViewById(R.id.btnClearSignature)
        etCustomerRecipientName = findViewById(R.id.etCustomerRecipientName)
        signaturePadView = findViewById(R.id.signaturePadView)
        btnSubmitReport = findViewById(R.id.btnSubmitReport)

        btnBack.setOnClickListener { handleBackNavigation() }

        tabDetail.setOnClickListener { switchTab(0) }
        tabChat.setOnClickListener { openTeamChat() }
        btnDetailChatShortcut.setOnClickListener { openTeamChat() }

        btnWorkflowPrimary.setOnClickListener {
            handlePrimaryWorkflowStep()
        }



        btnPendingTask.setOnClickListener {
            showPendingOrEscalateDialog()
        }

        btnDetailCall.setOnClickListener {
            if (reporterPhone.isNotBlank()) {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$reporterPhone")))
            } else {
                Toast.makeText(this, "Nomor telepon tidak tersedia", Toast.LENGTH_SHORT).show()
            }
        }

        btnDetailWhatsApp.setOnClickListener {
            TicketAdapter.openWhatsAppChat(this, reporterPhone, reporterName, ticketNumber, ticketTitle)
        }

        btnDetailMap.setOnClickListener {
            openGoogleMapsRoute()
        }

        btnCopyAddress.setOnClickListener {
            val cb = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clipText = buildString {
                append(reporterAddress.ifBlank { ticketTitle })
                if (latitude != 0.0 && longitude != 0.0) {
                    append(" ($latitude, $longitude)")
                }
            }
            cb.setPrimaryClip(ClipData.newPlainText("Alamat Pelanggan", clipText))
            Toast.makeText(this, "Alamat pelanggan disalin ke papan klip", Toast.LENGTH_SHORT).show()
        }

        btnUpdateCustomerCoord.setOnClickListener {
            confirmRecordCurrentCoordinate("customer")
        }

        btnUpdateOdpCoord.setOnClickListener {
            confirmRecordCurrentCoordinate("odp")
        }

        btnCameraBefore.text = "Tambah gambar"
        btnCameraBefore.setOnClickListener { chooseImage(true) }
        btnCameraAfter.text = "Tambah gambar"
        btnCameraAfter.setOnClickListener { chooseImage(false) }

        btnClearSignature.setOnClickListener {
            signaturePadView.clearSignature()
            Toast.makeText(this, "Kanvas tanda tangan dibersihkan", Toast.LENGTH_SHORT).show()
        }

        btnSubmitReport.setOnClickListener {
            showPreviewAndSubmitReport()
        }
    }

    private fun dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun setupReportChecklistAndMaterials() {
        // 1. Root Cause Spinner (FR-18)
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, rootCauseOptions)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerRootCause.adapter = adapter

        // 2. Dynamic Checklist per Ticket Type (FR-13)
        val items = when (ticketType.lowercase(Locale.ROOT)) {
            "psb" -> listOf(
                "Tarik kabel dropcore dari ODP ke rumah pelanggan",
                "Pasang roset optik & terminasi Fast Connector / Splicing",
                "Pasang perangkat ONT/Modem & konfigurasi WAN/PPPoE",
                "Uji redaman optik (dBm) dalam batas normal (-8 s/d -25 dBm)",
                "Uji koneksi internet (Speedtest / Ping) & pengaturan SSID WiFi",
                "Rapikan jalur kabel & edukasi penggunaan ke pelanggan"
            )
            "perbaikan_infrastruktur" -> listOf(
                "Identifikasi titik putus / sumber kendala redaman tinggi (LOS)",
                "Perbaikan / splicing ulang core fiber optik atau ganti konektor",
                "Pengecekan port ODP dan redaman di sisi pelanggan",
                "Verifikasi ONT online stabil (indikator PON hijau tenang)",
                "Uji ping & speedtest bersama pelanggan"
            )
            "pemasangan_cctv", "perbaikan_cctv" -> listOf(
                "Pemeriksaan titik sudut pandang kamera & jalur kabel",
                "Pemasangan / perbaikan unit kamera CCTV & konektor BNC/RJ45",
                "Konfigurasi DVR/NVR, penyimpanan HDD, & kualitas rekaman",
                "Integrasi pantauan aplikasi CCTV di HP pelanggan",
                "Pembersihan lensa & uji tampilan siang/malam (Infrared)"
            )
            else -> listOf(
                "Pemeriksaan fisik perangkat & jalur kabel di lokasi",
                "Pembersihan konektor optik / pengecekan catu daya adaptor",
                "Pengukuran redaman optik & pengecekan status perangkat",
                "Uji coba fungsi layanan & konfirmasi ke pelanggan"
            )
        }

        tvChecklistHeader.text = "1. CHECKLIST PEKERJAAN (${ticketType.ifBlank { "UMUM" }.replace("_", " ").uppercase()})"
        layoutChecklistContainer.removeAllViews()
        checklistCheckBoxes.clear()

        items.forEachIndexed { idx, label ->
            val cb = CheckBox(this).apply {
                text = label
                setTextColor(Color.parseColor("#1E293B"))
                textSize = 12.5f
                setPadding(dp(6), dp(6), dp(6), dp(6))
                setOnCheckedChangeListener { _, _ ->
                    if (!isRestoringDraft) saveDraftNow()
                }
            }
            checklistCheckBoxes.add(cb)
            layoutChecklistContainer.addView(cb)
        }

        // 3. Quick Material Chips (FR-21)
        val quickMaterials = listOf(
            "Kabel Dropcore 50m",
            "Kabel Dropcore 100m",
            "2x Fast Connector SC",
            "1x Protection Sleeve",
            "1x Unit ONT/Modem",
            "1x Patchcord SC-UPC",
            "1x Roset Optik",
            "2x Konektor RJ45/BNC"
        )
        layoutQuickMaterialChips.removeAllViews()
        for (mat in quickMaterials) {
            val chip = TextView(this).apply {
                text = "+ $mat"
                setTextColor(Color.parseColor("#9CAEFF"))
                textSize = 11f
                setTypeface(typeface, Typeface.BOLD)
                setBackgroundResource(R.drawable.badge_bg)
                setPadding(dp(10), dp(6), dp(10), dp(6))
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = dp(6) }
                layoutParams = lp
                setOnClickListener {
                    val cur = etReportMaterials.text.toString().trim()
                    val next = if (cur.isEmpty()) mat else "$cur, $mat"
                    etReportMaterials.setText(next)
                    etReportMaterials.setSelection(next.length)
                    saveDraftNow()
                }
            }
            layoutQuickMaterialChips.addView(chip)
        }
    }

    private fun setupAutoDraftWatchers() {
        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (!isRestoringDraft) saveDraftNow()
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        listOf(
            etReportOntSerial,
            etReportRouterType,
            etReportSsid,
            etReportOdpPort,
            etReportCableLength,
            etReportPingSpeed,
            etReportSummary,
            etReportActionTaken,
            etReportMaterials,
            etReportFinalResult,
            etCustomerRecipientName
        ).forEach { it.addTextChangedListener(watcher) }

        // FR-15: Real-time Optical Power (dBm) range validation
        etReportOpticalDbm.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                validateOpticalDbmInput(s?.toString()?.trim() ?: "")
                if (!isRestoringDraft) saveDraftNow()
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun validateOpticalDbmInput(raw: String) {
        if (raw.isEmpty()) {
            tvDbmValidationHint.text = "Rentang redaman normal: -8.0 dBm s/d -25.0 dBm"
            tvDbmValidationHint.setTextColor(Color.parseColor("#93939F"))
            return
        }
        val dbm = raw.replace(",", ".").toDoubleOrNull()
        if (dbm == null) {
            tvDbmValidationHint.text = "Masukkan angka desimal (contoh: -19.5)"
            tvDbmValidationHint.setTextColor(Color.parseColor("#F2D282"))
            return
        }
        when {
            dbm in -25.0..-8.0 -> {
                tvDbmValidationHint.text = "[NORMAL] Redaman Optik Normal ($dbm dBm — Kualitas sinyal baik)"
                tvDbmValidationHint.setTextColor(Color.parseColor("#6BDFA7"))
            }
            dbm in -27.9..-25.01 -> {
                tvDbmValidationHint.text = "[PERINGATAN] Redaman agak tinggi ($dbm dBm — Cek konektor/bending)"
                tvDbmValidationHint.setTextColor(Color.parseColor("#F2D282"))
            }
            else -> {
                tvDbmValidationHint.text = "[DI LUAR BATAS] Redaman ($dbm dBm) di luar batas wajar (-8 s/d -27 dBm)!"
                tvDbmValidationHint.setTextColor(Color.parseColor("#FF9AA5"))
            }
        }
    }

    private fun saveDraftNow() {
        if (reportCompleted || reportSubmitting || ticketStatus in setOf("resolved", "closed", "cancelled")) return
        if (LocationPolicy.isFinished(ticketStatus)) return
        val checked = checklistCheckBoxes.mapIndexedNotNull { idx, cb -> if (cb.isChecked) idx else null }.toSet()
        val draft = ReportDraftData(
            ticketId = ticketId,
            summary = etReportSummary.text.toString(),
            actionTaken = etReportActionTaken.text.toString(),
            materialsUsed = etReportMaterials.text.toString(),
            finalResult = etReportFinalResult.text.toString(),
            ontSerial = etReportOntSerial.text.toString(),
            routerType = etReportRouterType.text.toString(),
            ssidName = etReportSsid.text.toString(),
            opticalPowerDbm = etReportOpticalDbm.text.toString(),
            odpNamePort = etReportOdpPort.text.toString(),
            cableLengthMeter = etReportCableLength.text.toString(),
            pingSpeedResult = etReportPingSpeed.text.toString(),
            rootCauseIndex = spinnerRootCause.selectedItemPosition,
            customerRecipientName = etCustomerRecipientName.text.toString(),
            checkedIndices = checked,
            beforePhotoPaths = beforePhotoFiles.map { it.absolutePath },
            afterPhotoPaths = afterPhotoFiles.map { it.absolutePath }
        )
        OfflineSyncManager.saveReportDraft(this, draft)
        val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        tvDraftSavedStatus.text = "Draf tersimpan otomatis ($timeFmt)"
    }

    private fun restoreDraftIfAvailable() {
        val draft = OfflineSyncManager.getReportDraft(this, ticketId) ?: return
        isRestoringDraft = true
        try {
            beforePhotoFiles.clear()
            beforePhotoFiles.addAll(draft.beforePhotoPaths.map { File(it) }.filter { it.exists() })
            afterPhotoFiles.clear()
            afterPhotoFiles.addAll(draft.afterPhotoPaths.map { File(it) }.filter { it.exists() })
            if (draft.summary.isNotBlank()) etReportSummary.setText(draft.summary)
            if (draft.actionTaken.isNotBlank()) etReportActionTaken.setText(draft.actionTaken)
            if (draft.materialsUsed.isNotBlank()) etReportMaterials.setText(draft.materialsUsed)
            if (draft.finalResult.isNotBlank()) etReportFinalResult.setText(draft.finalResult)
            if (draft.ontSerial.isNotBlank()) etReportOntSerial.setText(draft.ontSerial)
            if (draft.routerType.isNotBlank()) etReportRouterType.setText(draft.routerType)
            if (draft.ssidName.isNotBlank()) etReportSsid.setText(draft.ssidName)
            if (draft.opticalPowerDbm.isNotBlank()) {
                etReportOpticalDbm.setText(draft.opticalPowerDbm)
                validateOpticalDbmInput(draft.opticalPowerDbm)
            }
            if (draft.odpNamePort.isNotBlank()) etReportOdpPort.setText(draft.odpNamePort)
            if (draft.cableLengthMeter.isNotBlank()) etReportCableLength.setText(draft.cableLengthMeter)
            if (draft.pingSpeedResult.isNotBlank()) etReportPingSpeed.setText(draft.pingSpeedResult)
            if (draft.rootCauseIndex in rootCauseOptions.indices) {
                spinnerRootCause.setSelection(draft.rootCauseIndex)
            }
            if (draft.customerRecipientName.isNotBlank()) {
                etCustomerRecipientName.setText(draft.customerRecipientName)
            }
            checklistCheckBoxes.forEachIndexed { index, cb ->
                cb.isChecked = draft.checkedIndices.contains(index)
            }
            tvDraftSavedStatus.text = "Draf sebelumnya berhasil dipulihkan otomatis"
        } finally {
            isRestoringDraft = false
        }
    }

    private fun bindTicketData() {
        tvDetailTicketNumber.text = "#$ticketNumber"
        tvDetailTicketTitle.text = ticketTitle
        updateStatusBadge(ticketStatus)

        tvInfoTitle.text = ticketTitle
        tvInfoType.text = "Jenis Pekerjaan: ${ticketType.ifBlank { "Umum" }.replace("_", " ").uppercase()} • Prioritas: ${ticketPriority.uppercase()}"
        tvInfoTitle.visibility = View.GONE
        tvInfoType.visibility = View.GONE
        tvInfoSla.visibility = if (slaResolutionDue.isNullOrBlank()) View.GONE else View.VISIBLE
        tvInfoSla.text = slaResolutionDue?.let { due -> "Target SLA: " + (TicketAdapter.parseIsoDate(due)?.let { date ->
            SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID")).apply { timeZone = TimeZone.getTimeZone("Asia/Jakarta") }.format(date) + " WIB"
        } ?: due) }.orEmpty()
        tvInfoCustomerName.text = "Pelapor: $reporterName"
        tvInfoCustomerName.visibility = if (reporterName.isNotBlank()) View.VISIBLE else View.GONE
        tvInfoCustomerPhone.text = "Telepon / WA: $reporterPhone"
        tvInfoCustomerPhone.visibility = if (reporterPhone.isNotBlank()) View.VISIBLE else View.GONE
        tvInfoCustomerAddress.text = "Alamat: $reporterAddress"
        tvInfoCustomerAddress.visibility = if (reporterAddress.isNotBlank()) View.VISIBLE else View.GONE
        tvInfoDescription.text = ticketDescription
        tvInfoDescription.visibility = if (ticketDescription.isNotBlank()) View.VISIBLE else View.GONE
        renderAdminDetails()

        if (latitude != 0.0 && longitude != 0.0) {
            tvInfoCoordinates.text = String.format(Locale.US, "Koordinat Pelanggan: %.6f, %.6f", latitude, longitude)
        } else {
            tvInfoCoordinates.text = ""
        }
        tvInfoCoordinates.visibility = if (tvInfoCoordinates.text.isNotBlank()) View.VISIBLE else View.GONE
        btnCopyAddress.visibility = if (reporterAddress.isNotBlank()) View.VISIBLE else View.GONE
        btnDetailMap.visibility = if (reporterMapUrl.isNotBlank() || LocationPolicy.hasCoordinates(latitude, longitude)) View.VISIBLE else View.GONE

        // Update distance & check-in radius badge
        updateDistanceAndRadiusUi()

        val hasPhone = reporterPhone.isNotBlank()
        btnDetailCall.visibility = if (hasPhone) View.VISIBLE else View.GONE
        btnDetailWhatsApp.visibility = if (hasPhone) View.VISIBLE else View.GONE

        if (etReportSummary.text.isNullOrBlank()) {
            etReportSummary.setText("Penyelesaian Tiket #$ticketNumber - $ticketTitle")
        }
        if (etCustomerRecipientName.text.isNullOrBlank() && reporterName.isNotBlank()) {
            etCustomerRecipientName.setText(reporterName)
        }

        renderStatusTimeline()
    }

    private fun renderAdminDetails() {
        val summary = findViewById<LinearLayout>(R.id.ticketBrief)
        summary.removeAllViews()
        summary.addView(HelpdeskTheme.text(this,"DETAIL TIKET  /  #$ticketNumber",11f,HelpdeskTheme.blue,true))
        summary.addView(HelpdeskTheme.text(this,ticketTitle,25f,Color.rgb(20,20,26),true).apply { setPadding(0,dp(10),0,dp(8)) })
        summary.addView(HelpdeskTheme.text(this,TicketPresentation.typeLabel(ticketType) + "  ·  " + ticketPriority.replaceFirstChar { it.uppercase() },12f,Color.rgb(93,93,108)))
        val container = findViewById<LinearLayout>(R.id.adminTicketDetails)
        container.removeAllViews()
        val snapshot = detailSnapshot ?: return
        val fields = TicketPresentation.fields(snapshot)
        if (fields.isNotEmpty()) {
            container.addView(HelpdeskTheme.text(this,"Rincian dari admin",17f,bold=true))
            fields.forEach { (label,value) ->
                val row = HelpdeskTheme.column(this,14).apply { background=HelpdeskTheme.shape(this@TicketDetailActivity, HelpdeskTheme.surface,16) }
                row.addView(HelpdeskTheme.text(this,label,11f,HelpdeskTheme.muted))
                row.addView(HelpdeskTheme.text(this,value,14f).apply { setPadding(0,dp(4),0,0); setTextIsSelectable(true) })
                container.addView(row,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
            }
        }
        if (snapshot.attachments.isNotEmpty()) {
            container.addView(HelpdeskTheme.text(this,"Lampiran admin · ${snapshot.attachments.size}",17f,bold=true).apply { setPadding(0,dp(22),0,dp(8)) })
            snapshot.attachments.forEach { file ->
                val button = HelpdeskTheme.button(this,(if(file.mimeType.startsWith("image/")) "Foto" else "Berkas") + "  ·  " + file.name + "  ↗") {}
                button.maxLines=3
                button.setOnClickListener {
                    if(file.mimeType.startsWith("image/")) startActivity(Intent(this,ReportPhotoActivity::class.java).putExtra("photo_path","/api/attachments/"+file.id))
                    else {
                        button.isEnabled=false
                        lifecycleScope.launch {
                            val token=session.token
                            val downloaded=if(token!=null) ApiClient.downloadAttachment(this@TicketDetailActivity,session.serverUrl,token,file) else Result.failure(java.io.IOException("Silakan masuk kembali"))
                            button.isEnabled=true
                            downloaded.onSuccess { saved ->
                                val uri=FileProvider.getUriForFile(this@TicketDetailActivity,packageName+".fileprovider",saved)
                                try { startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,file.mimeType).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }
                                catch(_:android.content.ActivityNotFoundException) { Toast.makeText(this@TicketDetailActivity,"Aplikasi pembuka berkas belum tersedia.",Toast.LENGTH_LONG).show() }
                            }.onFailure { Toast.makeText(this@TicketDetailActivity,it.message ?: "Lampiran belum dapat dibuka.",Toast.LENGTH_LONG).show() }
                        }
                    }
                }
                container.addView(button,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(8) })
            }
        }
        container.visibility=if(container.childCount>0) View.VISIBLE else View.GONE
    }

    private fun getCurrentDistanceToCustomerMeters(): Float? {
        if (!LocationPolicy.isFresh(session.lastUpdateTime) || !LocationPolicy.hasCoordinates(session.lastLatitude, session.lastLongitude) || !LocationPolicy.hasCoordinates(latitude, longitude)) {
            return null
        }
        val res = FloatArray(1)
        android.location.Location.distanceBetween(
            session.lastLatitude,
            session.lastLongitude,
            latitude,
            longitude,
            res
        )
        return res[0]
    }

    private fun updateDistanceAndRadiusUi() {
        val dist = getCurrentDistanceToCustomerMeters()
        if (dist == null) {
            tvDetailDistanceRadius.text = "Jarak belum tersedia"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#9CAEFF"))
        } else if (dist <= 100f) {
            tvDetailDistanceRadius.text = "Jarak ${dist.toInt()}m dari pelanggan"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#6BDFA7"))
        } else {
            val fmt = if (dist >= 1000f) String.format(Locale.US, "%.1f km", dist / 1000f) else "${dist.toInt()}m"
            tvDetailDistanceRadius.text = "Jarak $fmt dari pelanggan"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#F2D282"))
        }
    }

    private fun renderStatusTimeline() {
        layoutStatusTimeline.removeAllViews()
        val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm 'WIB'", Locale("id", "ID")).apply {
            timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        }

        val entries = ArrayList<Triple<String, String, String>>()
        if (statusHistory.isEmpty()) {
            entries.add(
                Triple(
                    "Status Saat Ini: ${NotificationHelper.formatStatusName(ticketStatus)}",
                    "Aktif",
                    "Riwayat status tercatat otomatis setiap kali teknisi memperbarui progres."
                )
            )
        } else {
            for (sh in statusHistory) {
                val d = TicketAdapter.parseIsoDate(sh.createdAt)
                val timeStr = if (d != null) sdf.format(d) else sh.createdAt
                entries.add(
                    Triple(
                        NotificationHelper.formatStatusName(sh.toStatus),
                        timeStr,
                        sh.reason ?: "Diperbarui oleh sistem/teknisi"
                    )
                )
            }
        }

        for ((title, time, desc) in entries) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(8), dp(6), dp(8), dp(8))
            }
            val top = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val tvSt = TextView(this).apply {
                text = "• $title"
                setTextColor(Color.parseColor("#F6F6F8"))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val tvTm = TextView(this).apply {
                text = time
                setTextColor(Color.parseColor("#93939F"))
                textSize = 10.5f
            }
            top.addView(tvSt)
            top.addView(tvTm)

            val tvRsn = TextView(this).apply {
                text = desc
                setTextColor(Color.parseColor("#C1C1CC"))
                textSize = 11.5f
                setPadding(dp(12), dp(2), 0, 0)
            }
            row.addView(top)
            row.addView(tvRsn)
            layoutStatusTimeline.addView(row)
        }
    }

    private fun updateStatusBadge(status: String) {
        ticketStatus = status
        val statusDisplay = when (status.lowercase()) {
            "open" -> "BARU"
            "assigned" -> "DITUGASKAN"
            "accepted" -> "DALAM PERJALANAN"
            "on_site" -> "TIBA DI LOKASI"
            "in_progress" -> "SEDANG DIKERJAKAN"
            "pending", "waiting_for_user", "waiting_for_third_party" -> "TERTUNDA"
            "resolved" -> "MENUNGGU VERIFIKASI"
            "closed" -> "TERVERIFIKASI"
            else -> status.replace("_", " ").uppercase()
        }
        tvDetailStatusBadge.text = statusDisplay
        when (status.lowercase()) {
            "resolved", "closed" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#6BDFA7"))
            "in_progress", "on_site", "accepted" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#FFB276"))
            "pending", "waiting_for_user", "waiting_for_third_party" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#F2D282"))
            else -> tvDetailStatusBadge.setTextColor(Color.parseColor("#7890FF"))
        }
    }

    private fun updateWorkflowUi(status: String) {
        val finished = session.userRole != "agent" || status in setOf("resolved", "closed", "cancelled")
        btnSubmitReport.isEnabled = !finished && !reportSubmitting && !reportCompleted
        findViewById<View>(R.id.btnCameraBefore).isEnabled = !finished
        findViewById<View>(R.id.btnCameraAfter).isEnabled = !finished
        findViewById<View>(R.id.reportSection).visibility = if(finished) View.GONE else View.VISIBLE
        val completed = findViewById<View>(R.id.completedReport)
        completed.visibility = if(latestReport != null) View.VISIBLE else View.GONE
        latestReport?.let { report ->
            findViewById<TextView>(R.id.submittedReportSummary).text = "Laporan pekerjaan\n\n" + report.summary + "\n\nTindakan\n" + report.actionTaken +
                (report.materialsUsed?.takeIf { it.isNotBlank() }?.let { "\n\nMaterial\n" + it } ?: "") + (report.finalResult?.takeIf { it.isNotBlank() }?.let { "\n\nHasil akhir\n" + it } ?: "")
            val photos = findViewById<LinearLayout>(R.id.submittedReportPhotos); photos.removeAllViews()
            (report.beforePhotos.mapIndexed { i,path -> "Foto sebelum / proses " + (i+1) to path } + report.afterPhotos.mapIndexed { i,path -> "Foto sesudah " + (i+1) to path }).forEach { (label,path) ->
                photos.addView(HelpdeskTheme.button(this,label+"  ↗") { startActivity(Intent(this,ReportPhotoActivity::class.java).putExtra("photo_path",path)) },LinearLayout.LayoutParams(-1,dp(48)).apply { topMargin=dp(10) })
            }
        }
        btnWorkflowPrimary.visibility = if (finished) View.GONE else View.VISIBLE
        tvWorkflowSubtitle.visibility = if (finished) View.GONE else View.VISIBLE
        btnPendingTask.visibility = if (finished) View.GONE else View.VISIBLE
        layoutResolvedBanner.visibility = if (finished) View.VISIBLE else View.GONE
        btnWorkflowPrimary.text = when(status) { "open", "assigned", "reopened" -> "Terima tiket"; "in_progress" -> "Isi laporan & selesaikan"; else -> "Mulai pengerjaan" }
        btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(HelpdeskTheme.blue)
        tvWorkflowSubtitle.text = if (status == "in_progress") "Catat hasil pekerjaan dan tambahkan foto bukti."
            else "Mulai penanganan saat siap. Navigasi dan chat tim tetap tersedia."
    }
    private fun handlePrimaryWorkflowStep() {
        if (session.userRole != "agent") return
        if (LocationPolicy.isFinished(ticketStatus)) return
        if (ticketStatus == "in_progress") switchTab(2)
        else if (ticketStatus in setOf("open", "assigned", "reopened")) updateStatusTo("accepted", "Teknisi menerima penugasan")
        else updateStatusTo("in_progress", "Teknisi mulai melakukan penanganan")
    }
    private fun showPendingOrEscalateDialog() {
        val standardReasons = arrayOf(
            "Tertunda: Pelanggan tidak ada di tempat / rumah kosong",
            "Tertunda: Izin gedung / RT / lingkungan belum keluar",
            "Tertunda: Material atau perangkat tambahan kurang",
            "Tertunda: Cuaca buruk / hujan deras berisiko tinggi",
            "Eskalasi: Butuh bantuan tim jaringan utama / splicer",
            "Tolak Tugas: Di luar jangkauan / kendala darurat teknisi"
        )

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(10), dp(20), dp(4))
        }

        val spinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@TicketDetailActivity,
                android.R.layout.simple_spinner_dropdown_item,
                standardReasons
            )
        }

        val etCustomNote = EditText(this).apply {
            hint = "Tambahkan keterangan detail (wajib jika ada kendala khusus)..."
            setBackgroundResource(R.drawable.input_field_bg)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            textSize = 13f
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(10) }
            layoutParams = lp
        }

        container.addView(spinner)
        container.addView(etCustomNote)

        AlertDialog.Builder(this)
            .setTitle("Tunda / Eskalasi / Tolak Tugas")
            .setView(container)
            .setPositiveButton("Simpan Status") { _, _ ->
                val picked = standardReasons[spinner.selectedItemPosition]
                val extra = etCustomNote.text.toString().trim()
                val fullReason = if (extra.isNotEmpty()) "$picked — Catatan: $extra" else picked
                val targetStatus = if (picked.startsWith("Tolak")) "open" else "pending"
                updateStatusTo(targetStatus, fullReason)
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    /**
     * FR-11: Technician can record/update customer or ODP coordinates using current live GPS.
     */
    private fun confirmRecordCurrentCoordinate(coordType: String) {
        val lat = session.lastLatitude
        val lng = session.lastLongitude
        if (!LocationPolicy.hasCoordinates(lat, lng) || !LocationPolicy.isFresh(session.lastUpdateTime) || session.lastAccuracy > LocationPolicy.MAX_ACCURACY_METERS) {
            Toast.makeText(
                this,
                "Lokasi terbaru yang akurat belum tersedia. Periksa izin dan GPS di Ringkasan, lalu coba lagi.",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        val label = if (coordType == "odp") "Titik ODP / Tiang" else "Lokasi Rumah Pelanggan"
        AlertDialog.Builder(this)
            .setTitle("Simpan Koordinat $label")
            .setMessage(
                "Apakah Anda ingin menyimpan posisi GPS Anda saat ini sebagai $label untuk Tiket #$ticketNumber?\n\n" +
                    "Koordinat: ${String.format(Locale.US, "%.6f, %.6f", lat, lng)}"
            )
            .setPositiveButton("Simpan Koordinat") { _, _ ->
                val token = session.token ?: return@setPositiveButton
                if (!OfflineSyncManager.isOnline(this)) {
                    OfflineSyncManager.enqueueOfflineAction(
                        this,
                        OfflineActionItem(
                            id = UUID.randomUUID().toString(),
                            actionType = "coord_update",
                            ticketId = ticketId,
                            ticketNumber = ticketNumber,
                            status = null,
                            notes = "Update koordinat $label (Offline)",
                            latitude = lat,
                            longitude = lng,
                            distanceMeters = null,
                            odpCoordinateType = coordType
                        )
                    )
                    if (coordType == "customer") {
                        latitude = lat
                        longitude = lng
                        bindTicketData()
                    }
                    Toast.makeText(this, "Koordinat $label disimpan lokal & akan disinkronkan saat online!", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }

                lifecycleScope.launch {
                    val res = ApiClient.updateTicketStatus(
                        serverUrl = session.serverUrl,
                        token = token,
                        ticketId = ticketId,
                        status = null,
                        notes = "Teknisi memperbarui koordinat $label dari lapangan",
                        summary = null,
                        latitude = lat,
                        longitude = lng,
                        updateCustomerCoordinates = true,
                        odpCoordinateType = coordType
                    )
                    res.onSuccess {
                        if (coordType == "customer") {
                            latitude = lat
                            longitude = lng
                            reporterMapUrl = "https://www.google.com/maps?q=$lat,$lng"
                            bindTicketData()
                        } else {
                            etReportOdpPort.setText(
                                etReportOdpPort.text.toString().ifBlank { "ODP (${String.format(Locale.US, "%.5f, %.5f", lat, lng)})" }
                            )
                        }
                        Toast.makeText(this@TicketDetailActivity, "Koordinat $label berhasil diperbarui ke server!", Toast.LENGTH_SHORT).show()
                    }.onFailure { err ->
                        Toast.makeText(this@TicketDetailActivity, "Gagal update koordinat: ${err.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun updateStatusTo(newStatus: String, notes: String, distanceMeters: Double? = null) {
        if (statusUpdating) return
        val token = session.token ?: return
        val lat = session.lastLatitude.takeIf { LocationPolicy.hasCoordinates(it, session.lastLongitude) && LocationPolicy.isFresh(session.lastUpdateTime) }
        val lng = session.lastLongitude.takeIf { LocationPolicy.hasCoordinates(session.lastLatitude, it) && LocationPolicy.isFresh(session.lastUpdateTime) }

        NotificationHelper.recordSelfStatusChange(ticketId, newStatus)

        // FR-23 / FR-24: Offline support if no internet connection
        if (!OfflineSyncManager.isOnline(this)) {
            OfflineSyncManager.enqueueOfflineAction(
                this,
                OfflineActionItem(
                    id = UUID.randomUUID().toString(),
                    actionType = "status_update",
                    ticketId = ticketId,
                    ticketNumber = ticketNumber,
                    status = newStatus,
                    notes = notes,
                    latitude = lat,
                    longitude = lng,
                    distanceMeters = distanceMeters
                )
            )
            OfflineSyncManager.updateCachedTicketStatusLocally(this, ticketId, newStatus)
            updateStatusBadge(newStatus)
            updateWorkflowUi(newStatus)
            setResult(RESULT_OK)
            Toast.makeText(
                this,
                "Mode Offline: Status disimpan lokal & otomatis dikirim saat sinyal kembali.",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        btnWorkflowPrimary.isEnabled = false
        statusUpdating = true
        val oldText = btnWorkflowPrimary.text
        btnWorkflowPrimary.text = "Memperbarui Status..."

        lifecycleScope.launch {
            val result = ApiClient.updateTicketStatus(
                serverUrl = session.serverUrl,
                token = token,
                ticketId = ticketId,
                status = newStatus,
                notes = notes,
                summary = null,
                latitude = lat,
                longitude = lng,
                distanceMeters = distanceMeters
            )
            btnWorkflowPrimary.isEnabled = true
            statusUpdating = false
            btnWorkflowPrimary.text = oldText

            result.onSuccess {
                OfflineSyncManager.updateCachedTicketStatusLocally(this@TicketDetailActivity, ticketId, newStatus)
                updateStatusBadge(newStatus)
                updateWorkflowUi(newStatus)
                setResult(RESULT_OK)
                vibrateShortFeedback()
                val msg = when (newStatus) {
                    "accepted" -> "Tugas diterima! Selamat bertugas menuju lokasi."
                    "on_site" -> "Check-In berhasil: Teknisi Tiba di Lokasi!"
                    "in_progress" -> "Status diubah: Sedang Dikerjakan!"
                    "pending" -> "Status diubah: Tugas Ditunda (Pending)!"
                    else -> "Status berhasil diperbarui!"
                }
                Toast.makeText(this@TicketDetailActivity, msg, Toast.LENGTH_SHORT).show()
                refreshCurrentTicketMetadata()
            }.onFailure { failure ->
                if (failure !is java.io.IOException) {
                    Toast.makeText(this@TicketDetailActivity, failure.message ?: "Status belum dapat diperbarui.", Toast.LENGTH_LONG).show()
                    return@onFailure
                }
                // Queue offline automatically on network failure so technician is never blocked
                OfflineSyncManager.enqueueOfflineAction(
                    this@TicketDetailActivity,
                    OfflineActionItem(
                        id = UUID.randomUUID().toString(),
                        actionType = "status_update",
                        ticketId = ticketId,
                        ticketNumber = ticketNumber,
                        status = newStatus,
                        notes = notes,
                        latitude = lat,
                        longitude = lng,
                        distanceMeters = distanceMeters
                    )
                )
                OfflineSyncManager.updateCachedTicketStatusLocally(this@TicketDetailActivity, ticketId, newStatus)
                updateStatusBadge(newStatus)
                updateWorkflowUi(newStatus)
                setResult(RESULT_OK)
                Toast.makeText(
                    this@TicketDetailActivity,
                    "Sinyal lemah: Perubahan status masuk antrean sinkronisasi otomatis.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun openGoogleMapsRoute() {
        if (reporterMapUrl.isNotBlank()) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(reporterMapUrl)))
                return
            } catch (e: Exception) {}
        }

        if (latitude != 0.0 && longitude != 0.0) {
            val uri = Uri.parse("google.navigation:q=$latitude,$longitude&mode=d")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.google.android.apps.maps")
            }
            if (intent.resolveActivity(packageManager) != null) {
                startActivity(intent)
            } else {
                val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude")
                startActivity(Intent(Intent.ACTION_VIEW, webUri))
            }
        } else if (reporterAddress.isNotBlank()) {
            val mapUri = Uri.parse("geo:0,0?q=${Uri.encode(reporterAddress)}")
            startActivity(Intent(Intent.ACTION_VIEW, mapUri))
        } else {
            Toast.makeText(this, "Link Google Maps atau alamat belum tersedia", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openTeamChat() {
        startActivity(Intent(this, TeamChatActivity::class.java).putExtra("ticket_id",ticketId).putExtra("ticket_number",ticketNumber).putExtra("title",ticketTitle))
    }
    private fun switchTab(tabIndex: Int) {
        currentTab=if(tabIndex==2) 2 else 0
        if(tabIndex==1) { openTeamChat(); return }
        viewTabDetail.post {
            if(tabIndex==2) {
                val section=findViewById<View>(R.id.reportSection)
                viewTabDetail.smoothScrollTo(0,section.top)
            } else viewTabDetail.smoothScrollTo(0,0)
        }
    }
    private fun chooseImage(before: Boolean) {
        if (reportSubmitting || reportCompleted) return
        isCapturingBefore = before
        try {
            val file = File.createTempFile("report_capture_", ".jpg", cacheDir)
            currentCameraTempFile = file
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val camera = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
                clipData = ClipData.newRawUri("Foto laporan", uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val gallery = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE); putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true) }
            addImageLauncher.launch(Intent.createChooser(gallery, "Tambah gambar").apply { putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera)) })
        } catch (_: RuntimeException) { Toast.makeText(this, "Pemilih gambar belum tersedia.", Toast.LENGTH_SHORT).show() }
    }

    private fun refreshPhotoPreviews(isBefore: Boolean) {
        saveDraftNow()
        val list = if (isBefore) beforePhotoFiles else afterPhotoFiles
        val container = if (isBefore) layoutBeforePreviews else layoutAfterPreviews
        val countText = if (isBefore) tvBeforePhotosCount else tvAfterPhotosCount
        val prefix = if (isBefore) "Foto Before (Watermark GPS)" else "Foto After (Watermark GPS)"

        container.removeAllViews()

        if (list.isEmpty()) {
            countText.text = "Belum ada $prefix dipilih"
            countText.setTextColor(Color.parseColor("#93939F"))
        } else {
            countText.text = "[SIAP] ${list.size} $prefix siap dikirim (<1 MB)"
            countText.setTextColor(Color.parseColor("#6BDFA7"))
        }

        for ((index, file) in list.withIndex()) {
            val card = CardView(this).apply {
                radius = 12f
                cardElevation = 2f
                val lp = LinearLayout.LayoutParams(170, 170).apply {
                    setMargins(0, 0, 16, 0)
                }
                layoutParams = lp
            }

            val frame = FrameLayout(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            }

            val iv = ImageView(this).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                scaleType = ImageView.ScaleType.CENTER_CROP
                try {
                    val bmp = BitmapFactory.decodeFile(file.absolutePath)
                    setImageBitmap(bmp)
                } catch (e: Exception) {}
            }

            val btnDelete = TextView(this).apply {
                text = "X"
                setTextColor(Color.WHITE)
                textSize = 11f
                gravity = Gravity.CENTER
                setBackgroundColor(Color.parseColor("#B3000000"))
                val dLp = FrameLayout.LayoutParams(48, 48).apply {
                    gravity = Gravity.TOP or Gravity.END
                }
                layoutParams = dLp
                setOnClickListener {
                    list.removeAt(index)
                    refreshPhotoPreviews(isBefore)
                }
            }

            frame.addView(iv)
            frame.addView(btnDelete)
            card.addView(frame)
            container.addView(card)
        }
    }

    /**
     * FR-20 & Layar 7 (Pratinjau dan Kirim): Validates mandatory fields & minimum photos,
     * shows a comprehensive preview summary, and submits (or queues offline if no internet).
     */
    private fun showPreviewAndSubmitReport() {
        if (reportSubmitting || reportCompleted || ticketStatus in setOf("resolved", "closed", "cancelled")) return
        val summary = etReportSummary.text.toString().trim()
        val actionTaken = etReportActionTaken.text.toString().trim()
        val materialsUsed = etReportMaterials.text.toString().trim()
        val finalResult = etReportFinalResult.text.toString().trim()
        val ontSerial = etReportOntSerial.text.toString().trim()
        val routerType = etReportRouterType.text.toString().trim()
        val ssidName = etReportSsid.text.toString().trim()
        val opticalDbm = etReportOpticalDbm.text.toString().trim()
        val odpPort = etReportOdpPort.text.toString().trim()
        val cableLen = etReportCableLength.text.toString().trim()
        val pingSpeed = etReportPingSpeed.text.toString().trim()
        val rootCause = rootCauseOptions[spinnerRootCause.selectedItemPosition]
        val recipientName = etCustomerRecipientName.text.toString().trim().ifBlank { reporterName.ifBlank { "Pelanggan" } }

        // Validate mandatory fields (FR-20)
        val missingFields = ArrayList<String>()
        if (summary.length < 3) {
            etReportSummary.error = "Ringkasan hasil pekerjaan wajib diisi"
            missingFields.add("Ringkasan Hasil Pekerjaan")
        }
        if (actionTaken.length < 3) {
            etReportActionTaken.error = "Tindakan penanganan wajib diisi"
            missingFields.add("Tindakan yang Dilakukan")
        }
        if (beforePhotoFiles.isEmpty() && afterPhotoFiles.isEmpty()) {
            missingFields.add("Minimal 1 Foto Bukti (Before / After)")
        }

        if (missingFields.isNotEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Laporan belum lengkap")
                .setMessage(
                    "Mohon lengkapi bagian berikut sebelum mengirim laporan:\n\n" +
                        missingFields.joinToString("\n") { "• $it" }
                )
                .setPositiveButton("Lengkapi Sekarang", null)
                .show()
            return
        }

        val checkedItems = checklistCheckBoxes.filter { it.isChecked }.map { it.text.toString() }


        val previewMsg = "Tiket #" + ticketNumber + " — " + ticketTitle +
            "\n\nRingkasan: " + summary + "\nTindakan: " + actionTaken +
            "\nBukti foto: " + (beforePhotoFiles.size + afterPhotoFiles.size) +
            "\n\nKirim laporan dan tandai pekerjaan selesai?"

        AlertDialog.Builder(this)
            .setTitle("Selesaikan tiket?")
            .setMessage(previewMsg)
            .setPositiveButton("Kirim Laporan Sekarang") { _, _ ->
                executeSubmitWorkReport(
                    summary = summary,
                    rawActionTaken = actionTaken,
                    materialsUsed = materialsUsed,
                    rawFinalResult = finalResult,
                    ontSerial = ontSerial,
                    routerType = routerType,
                    ssidName = ssidName,
                    opticalDbm = opticalDbm,
                    odpPort = odpPort,
                    cableLen = cableLen,
                    pingSpeed = pingSpeed,
                    rootCause = rootCause,
                    recipientName = recipientName,
                    checkedItems = checkedItems
                )
            }
            .setNegativeButton("Periksa Kembali", null)
            .show()
    }

    private fun executeSubmitWorkReport(
        summary: String,
        rawActionTaken: String,
        materialsUsed: String,
        rawFinalResult: String,
        ontSerial: String,
        routerType: String,
        ssidName: String,
        opticalDbm: String,
        odpPort: String,
        cableLen: String,
        pingSpeed: String,
        rootCause: String,
        recipientName: String,
        checkedItems: List<String>
    ) {
        if (reportSubmitting || reportCompleted || ticketStatus in setOf("resolved", "closed", "cancelled")) return
        val token = session.token ?: return
        reportSubmitting = true
        btnSubmitReport.isEnabled = false
        val requestKey = reportRequestKey()

        // Export customer signature if signed on screen
        val allAfterPhotos = ArrayList<File>(afterPhotoFiles)
        val sigFile = runCatching { signaturePadView.exportSignatureFile(
            this,
            ticketNumber,
            recipientName,
            session.userName ?: "Teknisi"
        ) }.getOrNull()
        if (sigFile != null && sigFile.exists()) {
            allAfterPhotos.add(sigFile)
        }

        // Build enriched actionTaken & finalResult so Web Dashboard shows all technical metrics clearly
        val enrichedAction = buildString {
            append(rawActionTaken)
            append("\n\n[Kategori/Penyebab]: $rootCause")
            if (checkedItems.isNotEmpty()) {
                append("\n[Checklist Selesai (${checkedItems.size}/${checklistCheckBoxes.size})]: ")
                append(checkedItems.joinToString("; "))
            }
            if (ontSerial.isNotBlank() || routerType.isNotBlank() || ssidName.isNotBlank()) {
                append("\n[Perangkat]: ")
                val parts = listOfNotNull(
                    ontSerial.takeIf { it.isNotBlank() }?.let { "SN/MAC: $it" },
                    routerType.takeIf { it.isNotBlank() }?.let { "Tipe: $it" },
                    ssidName.takeIf { it.isNotBlank() }?.let { "SSID: $it" }
                )
                append(parts.joinToString(" | "))
            }
            if (odpPort.isNotBlank() || cableLen.isNotBlank()) {
                append("\n[Jaringan/ODP]: ")
                val parts = listOfNotNull(
                    odpPort.takeIf { it.isNotBlank() }?.let { "ODP/Port: $it" },
                    cableLen.takeIf { it.isNotBlank() }?.let { "Kabel: ${it}m" }
                )
                append(parts.joinToString(" | "))
            }
            append("\n[Penerima Pelanggan]: $recipientName")
        }

        val enrichedFinalResult = buildString {
            if (rawFinalResult.isNotBlank()) append(rawFinalResult) else append("Layanan Normal & Terverifikasi")
            if (opticalDbm.isNotBlank()) append(" • Redaman: $opticalDbm dBm")
            if (pingSpeed.isNotBlank()) append(" • Uji Koneksi: $pingSpeed")
        }

        val techJsonObj = JSONObject().apply {
            put("rootCause", rootCause)
            put("ontSerial", ontSerial)
            put("routerType", routerType)
            put("ssidName", ssidName)
            put("opticalPowerDbm", opticalDbm)
            put("odpPort", odpPort)
            put("cableLengthMeter", cableLen)
            put("pingSpeedResult", pingSpeed)
            put("recipientName", recipientName)
            put("hasDigitalSignature", sigFile != null)
            put("checklist", JSONArray(checkedItems))
            put("gpsLatitude", session.lastLatitude)
            put("gpsLongitude", session.lastLongitude)
        }

        NotificationHelper.recordSelfStatusChange(ticketId, "resolved")

        // Offline support (FR-23, FR-25)
        if (!OfflineSyncManager.isOnline(this)) {
            OfflineSyncManager.enqueueOfflineAction(
                this,
                OfflineActionItem(
                    id = requestKey,
                    actionType = "work_report",
                    ticketId = ticketId,
                    ticketNumber = ticketNumber,
                    status = "resolved",
                    notes = summary,
                    latitude = if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLatitude else 0.0,
                    longitude = if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLongitude else 0.0,
                    distanceMeters = null,
                    reportSummary = summary,
                    reportActionTaken = enrichedAction,
                    reportMaterials = materialsUsed,
                    reportFinalResult = enrichedFinalResult,
                    reportTechnicalJson = techJsonObj.toString(),
                    beforePhotoPaths = beforePhotoFiles.map { it.absolutePath },
                    afterPhotoPaths = allAfterPhotos.map { it.absolutePath }
                )
            )
            OfflineSyncManager.updateCachedTicketStatusLocally(this, ticketId, "resolved")
            OfflineSyncManager.clearReportDraft(this, ticketId)
            vibrateShortFeedback()
            Toast.makeText(
                this,
                "Mode Offline: Laporan & foto watermark tersimpan aman di antrean perangkat, otomatis terkirim saat online!",
                Toast.LENGTH_LONG
            ).show()
            updateStatusBadge("resolved")
            updateWorkflowUi("resolved")
            completeReportAndReturn()
            return
        }

        btnSubmitReport.isEnabled = false
        btnSubmitReport.text = "Mengunggah Laporan, Foto Watermark & TTD..."

        lifecycleScope.launch {
            val result = ApiClient.submitWorkReport(
                serverUrl = session.serverUrl,
                token = token,
                ticketId = ticketId,
                summary = summary,
                actionTaken = enrichedAction,
                materialsUsed = materialsUsed,
                finalResult = enrichedFinalResult,
                beforePhotos = beforePhotoFiles,
                afterPhotos = allAfterPhotos,
                technicalDataJson = techJsonObj.toString(),
                idempotencyKey = requestKey
            )


            result.onSuccess {
                OfflineSyncManager.updateCachedTicketStatusLocally(this@TicketDetailActivity, ticketId, "resolved")
                OfflineSyncManager.clearReportDraft(this@TicketDetailActivity, ticketId)
                vibrateShortFeedback()
                Toast.makeText(
                    this@TicketDetailActivity,
                    "Laporan kerja lengkap berhasil diserahkan! Status menjadi Menunggu Verifikasi.",
                    Toast.LENGTH_LONG
                ).show()
                updateStatusBadge("resolved")
                updateWorkflowUi("resolved")
                completeReportAndReturn()
            }.onFailure { err ->
                if (err !is java.io.IOException) {
                    reportSubmitting = false
                    btnSubmitReport.isEnabled = true
                    btnSubmitReport.text = "Kirim laporan"
                    Toast.makeText(this@TicketDetailActivity, err.message ?: "Laporan belum dapat dikirim. Draf tetap tersimpan.", Toast.LENGTH_LONG).show()
                    return@onFailure
                }
                // Only transport failures are queued; validation/auth errors stay visible.
                OfflineSyncManager.enqueueOfflineAction(
                    this@TicketDetailActivity,
                    OfflineActionItem(
                        id = requestKey,
                        actionType = "work_report",
                        ticketId = ticketId,
                        ticketNumber = ticketNumber,
                        status = "resolved",
                        notes = summary,
                        latitude = if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLatitude else 0.0,
                        longitude = if (LocationPolicy.isFresh(session.lastUpdateTime)) session.lastLongitude else 0.0,
                        distanceMeters = null,
                        reportSummary = summary,
                        reportActionTaken = enrichedAction,
                        reportMaterials = materialsUsed,
                        reportFinalResult = enrichedFinalResult,
                        reportTechnicalJson = techJsonObj.toString(),
                        beforePhotoPaths = beforePhotoFiles.map { it.absolutePath },
                        afterPhotoPaths = allAfterPhotos.map { it.absolutePath }
                    )
                )
                OfflineSyncManager.updateCachedTicketStatusLocally(this@TicketDetailActivity, ticketId, "resolved")
                Toast.makeText(
                    this@TicketDetailActivity,
                    "Koneksi terputus (${err.message}). Laporan disimpan di Antrean Sinkronisasi Otomatis!",
                    Toast.LENGTH_LONG
                ).show()
                updateStatusBadge("resolved")
                updateWorkflowUi("resolved")
                completeReportAndReturn()
            }
        }
    }

    private fun completeReportAndReturn() {
        reportCompleted = true
        reportSubmitting = false
        ticketStatus = "resolved"
        OfflineSyncManager.clearReportDraft(this, ticketId)
        submissionPreferences.edit().remove("request_" + ticketId).apply()
        btnSubmitReport.isEnabled = false
        setResult(RESULT_OK, Intent().putExtra("report_completed", true))
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("report_completed", true))
        finish()
    }

    private fun vibrateShortFeedback() {
        try {
            val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(60)
            }
        } catch (_: Exception) {}
    }

    private fun handleBackNavigation() {
        saveDraftNow()
        finish()
    }

    private fun refreshCurrentTicketMetadata() {
        if(metadataLoading || statusUpdating || reportSubmitting || reportCompleted || OfflineSyncManager.getQueuedActions(this).any { it.ticketId == ticketId && it.actionType in setOf("status_update", "work_report") }) return
        val token=session.token ?: return
        metadataLoading=true
        lifecycleScope.launch {
            try {
                ApiClient.getTicketDetail(session.serverUrl,token,ticketId).onSuccess { fresh ->
                    detailSnapshot = fresh
                    val cached=OfflineSyncManager.getCachedTickets(this@TicketDetailActivity)
                    OfflineSyncManager.saveCachedTickets(this@TicketDetailActivity,cached.filter { it.id!=fresh.id }+fresh)
                    ticketNumber=fresh.ticketNumber; ticketTitle=fresh.title; ticketStatus=fresh.status; ticketPriority=fresh.priority
                    ticketType=fresh.ticketType.orEmpty(); reporterName=fresh.reporterName.orEmpty(); reporterPhone=fresh.reporterPhone.orEmpty()
                    reporterAddress=fresh.reporterAddress.orEmpty(); reporterMapUrl=fresh.reporterMapUrl.orEmpty()
                    latitude=fresh.latitude ?: 0.0; longitude=fresh.longitude ?: 0.0; ticketDescription=fresh.description.orEmpty()
                    slaResolutionDue=fresh.slaResolutionDue; statusHistory=fresh.statusHistory; latestReport=fresh.latestReport
                    bindTicketData(); updateWorkflowUi(ticketStatus)
                }.onFailure { error ->
                    if(error is ApiException && error.statusCode in setOf(403,404)) {
                        Toast.makeText(this@TicketDetailActivity,"Tiket sudah tidak tersedia untuk akun ini.",Toast.LENGTH_LONG).show(); finish()
                    }
                }
            } finally {
                metadataLoading=false
                if (realtimeRefreshPending && !isFinishing) { realtimeRefreshPending=false; refreshCurrentTicketMetadata() }
            }
        }
    }
    override fun onSaveInstanceState(outState: Bundle) {
        saveDraftNow()
        outState.putStringArrayList("before_photo_paths", ArrayList(beforePhotoFiles.map { it.absolutePath }))
        outState.putStringArrayList("after_photo_paths", ArrayList(afterPhotoFiles.map { it.absolutePath }))
        outState.putString("camera_temp_path", currentCameraTempFile?.absolutePath)
        outState.putBoolean("camera_before", isCapturingBefore)
        outState.putInt("selected_detail_tab", currentTab)
        super.onSaveInstanceState(outState)
    }
    override fun onResume() {
        super.onResume()
        updateDistanceAndRadiusUi()
        refreshCurrentTicketMetadata()
        realtimeJob?.cancel()
        realtimeJob = net.infinityteknik.helpdesk.util.RealtimeUpdates.start(this, session) {
            if (metadataLoading) realtimeRefreshPending = true else refreshCurrentTicketMetadata()
        }
        metadataPoll?.cancel()
        metadataPoll = lifecycleScope.launch {
            while(isActive) { delay(20_000L); updateDistanceAndRadiusUi(); refreshCurrentTicketMetadata() }
        }
    }
    override fun onPause() {
        realtimeRefreshPending = false
        realtimeJob?.cancel(); realtimeJob = null
        super.onPause()
        metadataPoll?.cancel()
        metadataPoll = null
    }
}
