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
    private var chatPollJob: Job? = null
    private var isRestoringDraft = false

    // Views: Top Bar
    private lateinit var btnBack: ImageButton
    private lateinit var tvDetailTicketNumber: TextView
    private lateinit var tvDetailTicketTitle: TextView
    private lateinit var tvDetailStatusBadge: TextView

    // Views: Tabs
    private lateinit var tabDetail: TextView
    private lateinit var tabChat: TextView
    private lateinit var tabReport: TextView
    private lateinit var viewTabDetail: View
    private lateinit var viewTabChat: View
    private lateinit var viewTabReport: View

    // Views: Stepper & Progressive Workflow
    private lateinit var tvDetailDistanceRadius: TextView
    private lateinit var step1Text: TextView
    private lateinit var step2Text: TextView
    private lateinit var step3Text: TextView
    private lateinit var step4Text: TextView
    private lateinit var stepLine1: View
    private lateinit var stepLine2: View
    private lateinit var stepLine3: View
    private lateinit var btnWorkflowPrimary: MaterialButton
    private lateinit var tvWorkflowSubtitle: TextView
    private lateinit var btnDirectStart: MaterialButton
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
    private lateinit var swipeRefreshChat: SwipeRefreshLayout
    private lateinit var rvMessages: RecyclerView
    private lateinit var rgMessageType: RadioGroup
    private lateinit var etMessageContent: EditText
    private lateinit var btnSendMessage: MaterialButton
    private lateinit var messageAdapter: MessageAdapter

    // Views: Report Tab (Full PRD Sections)
    private lateinit var tvDraftSavedStatus: TextView
    private lateinit var tvChecklistHeader: TextView
    private lateinit var layoutChecklistContainer: LinearLayout
    private lateinit var etReportOntSerial: EditText
    private lateinit var btnScanBarcode: MaterialButton
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
    private lateinit var btnGalleryBefore: MaterialButton
    private lateinit var tvBeforePhotosCount: TextView
    private lateinit var layoutBeforePreviews: LinearLayout
    private lateinit var btnCameraAfter: MaterialButton
    private lateinit var btnGalleryAfter: MaterialButton
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

    // Camera Result Launcher (Automatically compresses < 1MB & stamps Watermark Time + GPS)
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val rawFile = currentCameraTempFile
        if (success && rawFile != null && rawFile.exists() && rawFile.length() > 0) {
            val isBefore = isCapturingBefore
            val stageLabel = if (isBefore) "BEFORE" else "AFTER"
            Toast.makeText(this, "Memproses watermark waktu & koordinat GPS...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                val processed = withContext(Dispatchers.IO) {
                    PhotoWatermarkHelper.processAndWatermarkFile(
                        context = this@TicketDetailActivity,
                        sourceFile = rawFile,
                        ticketNumber = ticketNumber,
                        stageLabel = stageLabel,
                        technicianName = session.userName ?: "Teknisi",
                        latitude = session.lastLatitude,
                        longitude = session.lastLongitude,
                        accuracy = session.lastAccuracy
                    )
                }
                if (isBefore) {
                    beforePhotoFiles.add(processed)
                    refreshPhotoPreviews(true)
                } else {
                    afterPhotoFiles.add(processed)
                    refreshPhotoPreviews(false)
                }
            }
        }
    }

    // Gallery Result Launchers (Also automatically compresses < 1MB & stamps Watermark Time + GPS)
    private val pickGalleryBeforeLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (!uris.isNullOrEmpty()) {
            Toast.makeText(this, "Memproses ${uris.size} foto dengan watermark GPS...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    for (uri in uris) {
                        val f = PhotoWatermarkHelper.processAndWatermarkUri(
                            context = this@TicketDetailActivity,
                            uri = uri,
                            ticketNumber = ticketNumber,
                            stageLabel = "BEFORE",
                            technicianName = session.userName ?: "Teknisi",
                            latitude = session.lastLatitude,
                            longitude = session.lastLongitude,
                            accuracy = session.lastAccuracy
                        )
                        if (f != null) beforePhotoFiles.add(f)
                    }
                }
                refreshPhotoPreviews(true)
            }
        }
    }

    private val pickGalleryAfterLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (!uris.isNullOrEmpty()) {
            Toast.makeText(this, "Memproses ${uris.size} foto dengan watermark GPS...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    for (uri in uris) {
                        val f = PhotoWatermarkHelper.processAndWatermarkUri(
                            context = this@TicketDetailActivity,
                            uri = uri,
                            ticketNumber = ticketNumber,
                            stageLabel = "AFTER",
                            technicianName = session.userName ?: "Teknisi",
                            latitude = session.lastLatitude,
                            longitude = session.lastLongitude,
                            accuracy = session.lastAccuracy
                        )
                        if (f != null) afterPhotoFiles.add(f)
                    }
                }
                refreshPhotoPreviews(false)
            }
        }
    }

    // Barcode Scanner Launcher (FR-14)
    private val barcodeScanLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val contents = result.data?.getStringExtra("SCAN_RESULT")
            if (!contents.isNullOrBlank()) {
                etReportOntSerial.setText(contents.trim())
                saveDraftNow()
                Toast.makeText(this, "SN/Barcode berhasil dipindai: $contents", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ticket_detail)

        session = SessionManager(this)
        readIntentExtras()
        initViews()
        setupChatRecycler()
        setupReportChecklistAndMaterials()
        bindTicketData()
        restoreDraftIfAvailable()
        setupAutoDraftWatchers()
        updateWorkflowUi(ticketStatus)
        switchTab(initialTab)
        loadMessages(silent = initialTab != 1)
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

        // Load cached history & SLA if available
        val cached = OfflineSyncManager.getCachedTickets(this).find { it.id == ticketId }
        if (cached != null) {
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
        tabReport = findViewById(R.id.tabReport)
        viewTabDetail = findViewById(R.id.viewTabDetail)
        viewTabChat = findViewById(R.id.viewTabChat)
        viewTabReport = findViewById(R.id.viewTabReport)

        tvDetailDistanceRadius = findViewById(R.id.tvDetailDistanceRadius)
        step1Text = findViewById(R.id.step1Text)
        step2Text = findViewById(R.id.step2Text)
        step3Text = findViewById(R.id.step3Text)
        step4Text = findViewById(R.id.step4Text)
        stepLine1 = findViewById(R.id.stepLine1)
        stepLine2 = findViewById(R.id.stepLine2)
        stepLine3 = findViewById(R.id.stepLine3)
        btnWorkflowPrimary = findViewById(R.id.btnWorkflowPrimary)
        tvWorkflowSubtitle = findViewById(R.id.tvWorkflowSubtitle)
        btnDirectStart = findViewById(R.id.btnDirectStart)
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

        swipeRefreshChat = findViewById(R.id.swipeRefreshChat)
        rvMessages = findViewById(R.id.rvMessages)
        rgMessageType = findViewById(R.id.rgMessageType)
        etMessageContent = findViewById(R.id.etMessageContent)
        btnSendMessage = findViewById(R.id.btnSendMessage)

        tvDraftSavedStatus = findViewById(R.id.tvDraftSavedStatus)
        tvChecklistHeader = findViewById(R.id.tvChecklistHeader)
        layoutChecklistContainer = findViewById(R.id.layoutChecklistContainer)
        etReportOntSerial = findViewById(R.id.etReportOntSerial)
        btnScanBarcode = findViewById(R.id.btnScanBarcode)
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
        btnGalleryBefore = findViewById(R.id.btnGalleryBefore)
        tvBeforePhotosCount = findViewById(R.id.tvBeforePhotosCount)
        layoutBeforePreviews = findViewById(R.id.layoutBeforePreviews)
        btnCameraAfter = findViewById(R.id.btnCameraAfter)
        btnGalleryAfter = findViewById(R.id.btnGalleryAfter)
        tvAfterPhotosCount = findViewById(R.id.tvAfterPhotosCount)
        layoutAfterPreviews = findViewById(R.id.layoutAfterPreviews)
        btnClearSignature = findViewById(R.id.btnClearSignature)
        etCustomerRecipientName = findViewById(R.id.etCustomerRecipientName)
        signaturePadView = findViewById(R.id.signaturePadView)
        btnSubmitReport = findViewById(R.id.btnSubmitReport)

        btnBack.setOnClickListener { handleBackNavigation() }

        tabDetail.setOnClickListener { switchTab(0) }
        tabChat.setOnClickListener {
            switchTab(1)
            loadMessages(silent = false)
        }
        tabReport.setOnClickListener { switchTab(2) }

        btnDetailChatShortcut.setOnClickListener {
            switchTab(1)
            loadMessages(silent = false)
        }

        btnWorkflowPrimary.setOnClickListener {
            handlePrimaryWorkflowStep()
        }

        btnDirectStart.setOnClickListener {
            updateStatusTo("in_progress", "Langsung memulai pengerjaan di lokasi")
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

        btnScanBarcode.setOnClickListener {
            launchBarcodeScannerOrDialog()
        }

        btnSendMessage.setOnClickListener {
            sendMessage()
        }

        swipeRefreshChat.setOnRefreshListener {
            loadMessages(silent = false)
        }

        btnCameraBefore.setOnClickListener { launchCameraCapture(true) }
        btnGalleryBefore.setOnClickListener { pickGalleryBeforeLauncher.launch("image/*") }
        btnCameraAfter.setOnClickListener { launchCameraCapture(false) }
        btnGalleryAfter.setOnClickListener { pickGalleryAfterLauncher.launch("image/*") }

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
                setTextColor(Color.parseColor("#0284C7"))
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
            tvDbmValidationHint.setTextColor(Color.parseColor("#64748B"))
            return
        }
        val dbm = raw.replace(",", ".").toDoubleOrNull()
        if (dbm == null) {
            tvDbmValidationHint.text = "Masukkan angka desimal (contoh: -19.5)"
            tvDbmValidationHint.setTextColor(Color.parseColor("#D97706"))
            return
        }
        when {
            dbm in -25.0..-8.0 -> {
                tvDbmValidationHint.text = "✓ Redaman Optik Normal ($dbm dBm — Kualitas sinyal baik)"
                tvDbmValidationHint.setTextColor(Color.parseColor("#16A34A"))
            }
            dbm in -27.9..-25.01 -> {
                tvDbmValidationHint.text = "⚠ Peringatan: Redaman agak tinggi ($dbm dBm — Cek konektor/bending)"
                tvDbmValidationHint.setTextColor(Color.parseColor("#D97706"))
            }
            else -> {
                tvDbmValidationHint.text = "❗ PERINGATAN: Redaman ($dbm dBm) di luar batas wajar (-8 s/d -27 dBm)!"
                tvDbmValidationHint.setTextColor(Color.parseColor("#DC2626"))
            }
        }
    }

    private fun saveDraftNow() {
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
            checkedIndices = checked
        )
        OfflineSyncManager.saveReportDraft(this, draft)
        val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        tvDraftSavedStatus.text = "💾 Draf tersimpan otomatis ($timeFmt)"
    }

    private fun restoreDraftIfAvailable() {
        val draft = OfflineSyncManager.getReportDraft(this, ticketId) ?: return
        isRestoringDraft = true
        try {
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
            tvDraftSavedStatus.text = "💾 Draf sebelumnya berhasil dipulihkan otomatis"
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
        tvInfoCustomerName.text = "Pelanggan: ${reporterName.ifBlank { "Pelanggan" }}"
        tvInfoCustomerPhone.text = "Telepon / WA: ${reporterPhone.ifBlank { "-" }}"
        tvInfoCustomerAddress.text = "Alamat: ${reporterAddress.ifBlank { "-" }}"
        tvInfoDescription.text = ticketDescription.ifBlank { "Tidak ada catatan deskripsi keluhan tambahan." }

        if (latitude != 0.0 && longitude != 0.0) {
            tvInfoCoordinates.text = String.format(Locale.US, "Koordinat Pelanggan: %.6f, %.6f", latitude, longitude)
        } else {
            tvInfoCoordinates.text = "Koordinat Pelanggan: Belum ditandai (Gunakan tombol Set Titik Pelanggan)"
        }

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

    private fun getCurrentDistanceToCustomerMeters(): Float? {
        if (session.lastLatitude == 0.0 || session.lastLongitude == 0.0 || latitude == 0.0 || longitude == 0.0) {
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
            tvDetailDistanceRadius.text = "📍 Radius Check-In Siap"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#0284C7"))
        } else if (dist <= 100f) {
            tvDetailDistanceRadius.text = "📍 Jarak ${dist.toInt()}m (Dalam Radius 100m)"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#16A34A"))
        } else {
            val fmt = if (dist >= 1000f) String.format(Locale.US, "%.1f km", dist / 1000f) else "${dist.toInt()}m"
            tvDetailDistanceRadius.text = "📍 Jarak $fmt (>100m)"
            tvDetailDistanceRadius.setTextColor(Color.parseColor("#D97706"))
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
                text = "● $title"
                setTextColor(Color.parseColor("#0F172A"))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val tvTm = TextView(this).apply {
                text = time
                setTextColor(Color.parseColor("#64748B"))
                textSize = 10.5f
            }
            top.addView(tvSt)
            top.addView(tvTm)

            val tvRsn = TextView(this).apply {
                text = desc
                setTextColor(Color.parseColor("#475569"))
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
            "resolved", "closed" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#16A34A"))
            "in_progress", "on_site", "accepted" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#EA580C"))
            "pending", "waiting_for_user", "waiting_for_third_party" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#D97706"))
            else -> tvDetailStatusBadge.setTextColor(Color.parseColor("#2563EB"))
        }
    }

    private fun updateWorkflowUi(status: String) {
        val inactiveColor = Color.parseColor("#94A3B8")
        val activeBlue = Color.parseColor("#2563EB")
        val activeIndigo = Color.parseColor("#4F46E5")
        val activePurple = Color.parseColor("#7C3AED")
        val activeGreen = Color.parseColor("#16A34A")
        val linePassed = Color.parseColor("#2563EB")
        val lineInactive = Color.parseColor("#E2E8F0")

        btnWorkflowPrimary.visibility = View.VISIBLE
        tvWorkflowSubtitle.visibility = View.VISIBLE
        btnDirectStart.visibility = View.GONE
        btnPendingTask.visibility = View.VISIBLE
        layoutResolvedBanner.visibility = View.GONE

        when (status.lowercase()) {
            "open", "assigned" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(inactiveColor)
                step3Text.setTextColor(inactiveColor)
                step4Text.setTextColor(inactiveColor)
                stepLine1.setBackgroundColor(lineInactive)
                stepLine2.setBackgroundColor(lineInactive)
                stepLine3.setBackgroundColor(lineInactive)

                btnWorkflowPrimary.text = "1. Terima Tugas & Mulai Perjalanan"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeBlue)
                tvWorkflowSubtitle.text = "Ketuk untuk menerima tugas dan memulai perjalanan ke lokasi pelanggan."
            }
            "accepted" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(inactiveColor)
                step4Text.setTextColor(inactiveColor)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(lineInactive)
                stepLine3.setBackgroundColor(lineInactive)

                btnWorkflowPrimary.text = "2. Saya Tiba di Lokasi (Check-In)"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeIndigo)
                tvWorkflowSubtitle.text = "Dicek radius jarak GPS (100m) ke titik lokasi pelanggan."
                btnDirectStart.visibility = View.VISIBLE
            }
            "on_site", "pending", "waiting_for_user", "waiting_for_third_party" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(activePurple)
                step4Text.setTextColor(inactiveColor)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(linePassed)
                stepLine3.setBackgroundColor(lineInactive)

                btnWorkflowPrimary.text = "3. Mulai Kerjakan (Sedang Dikerjakan)"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activePurple)
                tvWorkflowSubtitle.text = "Mulai instalasi / perbaikan teknis di lokasi pelanggan."
            }
            "in_progress" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(activePurple)
                step4Text.setTextColor(activeGreen)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(linePassed)
                stepLine3.setBackgroundColor(linePassed)

                btnWorkflowPrimary.text = "4. Isi Laporan & Selesaikan Tugas"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeGreen)
                tvWorkflowSubtitle.text = "Buka form checklist, data teknis, watermark foto, & tanda tangan."
            }
            "resolved", "closed" -> {
                step1Text.setTextColor(activeGreen)
                step2Text.setTextColor(activeGreen)
                step3Text.setTextColor(activeGreen)
                step4Text.setTextColor(activeGreen)
                stepLine1.setBackgroundColor(activeGreen)
                stepLine2.setBackgroundColor(activeGreen)
                stepLine3.setBackgroundColor(activeGreen)

                btnWorkflowPrimary.visibility = View.GONE
                tvWorkflowSubtitle.visibility = View.GONE
                btnPendingTask.visibility = View.GONE
                layoutResolvedBanner.visibility = View.VISIBLE
            }
            else -> {
                btnWorkflowPrimary.text = "Perbarui Status Tugas"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeBlue)
            }
        }
    }

    private fun handlePrimaryWorkflowStep() {
        when (ticketStatus.lowercase()) {
            "open", "assigned" -> {
                updateStatusTo("accepted", "Tugas diterima oleh teknisi • Dalam perjalanan menuju lokasi")
            }
            "accepted" -> {
                // FR-12: Check-in berbasis jarak (Radius 100m)
                val dist = getCurrentDistanceToCustomerMeters()
                if (dist != null && dist > 100f) {
                    showOutOfRadiusCheckInDialog(dist)
                } else {
                    updateStatusTo(
                        "on_site",
                        "Teknisi tiba di lokasi pelanggan (Check-In dalam radius lokasi)",
                        dist?.toDouble()
                    )
                }
            }
            "on_site", "pending", "waiting_for_user", "waiting_for_third_party" -> {
                updateStatusTo("in_progress", "Teknisi mulai melakukan pengerjaan teknis di lapangan")
            }
            "in_progress" -> {
                switchTab(2)
            }
            else -> {
                switchTab(2)
            }
        }
    }

    /**
     * FR-12: When technician is outside 100m radius of customer coordinates, allow manual check-in
     * with a mandatory audited reason for supervisor review.
     */
    private fun showOutOfRadiusCheckInDialog(distanceMeters: Float) {
        val distFormatted = if (distanceMeters >= 1000f) {
            String.format(Locale.US, "%.2f km", distanceMeters / 1000f)
        } else {
            "${distanceMeters.toInt()} meter"
        }

        val reasons = arrayOf(
            "Titik koordinat peta pelanggan kurang akurat (Sudah di rumah pelanggan)",
            "Pengerjaan dimulai dari titik ODP / Tiang distribusi terlebih dahulu",
            "Tertahan akses gerbang perumahan / pos satpam",
            "Sinyal GPS terhalang bangunan tinggi / indoor"
        )
        var selectedIdx = 0

        AlertDialog.Builder(this)
            .setTitle("Check-In di Luar Radius ($distFormatted)")
            .setSingleChoiceItems(reasons, 0) { _, which ->
                selectedIdx = which
            }
            .setPositiveButton("Konfirmasi Saya Tiba") { _, _ ->
                val chosenReason = reasons[selectedIdx]
                updateStatusTo(
                    "on_site",
                    "Check-In Manual di luar radius 100m ($distFormatted) • Alasan: $chosenReason",
                    distanceMeters.toDouble()
                )
            }
            .setNeutralButton("Update Titik Pelanggan Dulu") { _, _ ->
                confirmRecordCurrentCoordinate("customer")
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    /**
     * FR-09 & 4.2: Tolak / Tunda (Pending) / Eskalasi tugas dengan pilihan alasan baku plus catatan bebas.
     */
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
        if (lat == 0.0 && lng == 0.0) {
            Toast.makeText(
                this,
                "Koordinat GPS perangkat belum tersedia. Pastikan izin lokasi aktif.",
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
        val token = session.token ?: return
        val lat = session.lastLatitude.takeIf { it != 0.0 }
        val lng = session.lastLongitude.takeIf { it != 0.0 }

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
            }.onFailure {
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

    private fun launchBarcodeScannerOrDialog() {
        try {
            val scanIntent = Intent("com.google.zxing.client.android.SCAN").apply {
                putExtra("SCAN_MODE", "ONE_D_MODE,QR_CODE_MODE")
            }
            if (scanIntent.resolveActivity(packageManager) != null) {
                barcodeScanLauncher.launch(scanIntent)
                return
            }
        } catch (_: Exception) {}

        // Built-in quick SN prefix helper + camera photo option if external scanner app is not installed
        val prefixes = arrayOf(
            "ZTEGC (ONT ZTE Standar)",
            "HWTC (ONT Huawei)",
            "FHTT (ONT Fiberhome)",
            "TPLK (Router TP-Link)",
            "HIKV (Kamera/DVR Hikvision)",
            "Ambil Foto Label Barcode SN ke Bukti After"
        )
        AlertDialog.Builder(this)
            .setTitle("Scan / Input Cepat Serial Number (SN)")
            .setItems(prefixes) { _, which ->
                when (which) {
                    0 -> appendSnPrefix("ZTEGC")
                    1 -> appendSnPrefix("HWTC")
                    2 -> appendSnPrefix("FHTT")
                    3 -> appendSnPrefix("TPLK-")
                    4 -> appendSnPrefix("HIK-")
                    5 -> launchCameraCapture(false)
                }
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun appendSnPrefix(prefix: String) {
        etReportOntSerial.setText(prefix)
        etReportOntSerial.requestFocus()
        etReportOntSerial.setSelection(prefix.length)
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

    private fun switchTab(tabIndex: Int) {
        currentTab = tabIndex
        val selectedColor = Color.parseColor("#09090B")
        val unselectedColor = Color.parseColor("#71717A")

        tabDetail.setTextColor(if (tabIndex == 0) selectedColor else unselectedColor)
        tabChat.setTextColor(if (tabIndex == 1) selectedColor else unselectedColor)
        tabReport.setTextColor(if (tabIndex == 2) selectedColor else unselectedColor)

        viewTabDetail.visibility = if (tabIndex == 0) View.VISIBLE else View.GONE
        viewTabChat.visibility = if (tabIndex == 1) View.VISIBLE else View.GONE
        viewTabReport.visibility = if (tabIndex == 2) View.VISIBLE else View.GONE
    }

    private fun launchCameraCapture(isBefore: Boolean) {
        isCapturingBefore = isBefore
        try {
            val prefix = if (isBefore) "before" else "after"
            val photoFile = File.createTempFile(
                "${prefix}_${System.currentTimeMillis()}_",
                ".jpg",
                cacheDir
            )
            currentCameraTempFile = photoFile
            val photoUri = FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                photoFile
            )
            takePictureLauncher.launch(photoUri)
        } catch (e: Exception) {
            Toast.makeText(this, "Gagal membuka kamera: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun refreshPhotoPreviews(isBefore: Boolean) {
        val list = if (isBefore) beforePhotoFiles else afterPhotoFiles
        val container = if (isBefore) layoutBeforePreviews else layoutAfterPreviews
        val countText = if (isBefore) tvBeforePhotosCount else tvAfterPhotosCount
        val prefix = if (isBefore) "Foto Before (Watermark GPS)" else "Foto After (Watermark GPS)"

        container.removeAllViews()

        if (list.isEmpty()) {
            countText.text = "Belum ada $prefix dipilih"
            countText.setTextColor(Color.parseColor("#64748B"))
        } else {
            countText.text = "✓ ${list.size} $prefix siap dikirim (<1 MB)"
            countText.setTextColor(Color.parseColor("#16A34A"))
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
                text = "✕"
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
                .setTitle("Data Wajib Belum Lengkap")
                .setMessage(
                    "Mohon lengkapi bagian berikut sebelum mengirim laporan:\n\n" +
                        missingFields.joinToString("\n") { "• $it" }
                )
                .setPositiveButton("Lengkapi Sekarang", null)
                .show()
            return
        }

        val checkedItems = checklistCheckBoxes.filter { it.isChecked }.map { it.text.toString() }
        val hasSignature = signaturePadView.hasSignature()

        val previewMsg = buildString {
            append("Tiket: #$ticketNumber — $ticketTitle\n")
            append("Kategori Penyebab: $rootCause\n")
            append("Checklist Selesai: ${checkedItems.size}/${checklistCheckBoxes.size} tahap\n")
            if (ontSerial.isNotBlank()) append("SN / MAC Perangkat: $ontSerial\n")
            if (routerType.isNotBlank()) append("Tipe Perangkat: $routerType\n")
            if (ssidName.isNotBlank()) append("SSID WiFi: $ssidName\n")
            if (opticalDbm.isNotBlank()) append("Redaman Optik: $opticalDbm dBm\n")
            if (odpPort.isNotBlank()) append("ODP & Port: $odpPort\n")
            if (cableLen.isNotBlank()) append("Panjang Kabel: $cableLen meter\n")
            if (pingSpeed.isNotBlank()) append("Ping / Speedtest: $pingSpeed\n")
            if (materialsUsed.isNotBlank()) append("Material: $materialsUsed\n")
            append("Bukti Foto: ${beforePhotoFiles.size} Before, ${afterPhotoFiles.size} After (Watermark GPS)\n")
            append("Penerima: $recipientName (${if (hasSignature) "Sudah TTD Digital" else "Tanpa TTD Layar"})\n\n")
            append("Kirim laporan ini dan selesaikan tugas sekarang?")
        }

        AlertDialog.Builder(this)
            .setTitle("Pratinjau Laporan Pekerjaan")
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
        val token = session.token ?: return

        // Export customer signature if signed on screen
        val allAfterPhotos = ArrayList<File>(afterPhotoFiles)
        val sigFile = signaturePadView.exportSignatureFile(
            this,
            ticketNumber,
            recipientName,
            session.userName ?: "Teknisi"
        )
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
                    id = UUID.randomUUID().toString(),
                    actionType = "work_report",
                    ticketId = ticketId,
                    ticketNumber = ticketNumber,
                    status = "resolved",
                    notes = summary,
                    latitude = session.lastLatitude,
                    longitude = session.lastLongitude,
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
            setResult(RESULT_OK)
            switchTab(0)
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
                technicalDataJson = techJsonObj.toString()
            )

            btnSubmitReport.isEnabled = true
            btnSubmitReport.text = "Pratinjau & Kirim Laporan Selesai"

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
                setResult(RESULT_OK)
                switchTab(0)
            }.onFailure { err ->
                // Save to offline queue so data is never lost (FR-25)
                OfflineSyncManager.enqueueOfflineAction(
                    this@TicketDetailActivity,
                    OfflineActionItem(
                        id = UUID.randomUUID().toString(),
                        actionType = "work_report",
                        ticketId = ticketId,
                        ticketNumber = ticketNumber,
                        status = "resolved",
                        notes = summary,
                        latitude = session.lastLatitude,
                        longitude = session.lastLongitude,
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
                setResult(RESULT_OK)
                switchTab(0)
            }
        }
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
        if (currentTab == 2 && (beforePhotoFiles.isNotEmpty() || afterPhotoFiles.isNotEmpty())) {
            AlertDialog.Builder(this)
                .setTitle("Keluar dari Form Laporan?")
                .setMessage("Isian teks laporan sudah tersimpan otomatis sebagai draf, namun jika Anda keluar sekarang Anda perlu memilih ulang lampiran foto saat kembali. Tetap keluar?")
                .setPositiveButton("Ya, Keluar") { _, _ -> finish() }
                .setNegativeButton("Lanjut Isi Laporan", null)
                .show()
        } else {
            finish()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        handleBackNavigation()
    }

    private fun setupChatRecycler() {
        messageAdapter = MessageAdapter()
        rvMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        rvMessages.adapter = messageAdapter
    }

    private fun loadMessages(silent: Boolean = false) {
        val token = session.token ?: return
        if (!silent) swipeRefreshChat.isRefreshing = true

        lifecycleScope.launch {
            val result = ApiClient.getTicketMessages(session.serverUrl, token, ticketId)
            if (!silent) swipeRefreshChat.isRefreshing = false

            result.onSuccess { msgs ->
                msgs.forEach { m -> session.markMessageSeen(m.id) }
                session.markTicketMessageBaselineInitialized(ticketId)

                val prevCount = messageAdapter.itemCount
                messageAdapter.submitList(msgs)
                if (msgs.isNotEmpty()) {
                    tabChat.text = "Chat Tim (${msgs.size})"
                    if (!silent || msgs.size > prevCount) {
                        rvMessages.scrollToPosition(msgs.size - 1)
                    }
                } else {
                    tabChat.text = "Chat Tim"
                }
            }.onFailure { err ->
                if (!silent) {
                    Toast.makeText(this@TicketDetailActivity, "Gagal memuat pesan: ${err.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun sendMessage() {
        val content = etMessageContent.text.toString().trim()
        if (content.isBlank()) return

        val isInternal = rgMessageType.checkedRadioButtonId == R.id.rbInternalNote
        val messageType = if (isInternal) "internal_note" else "public"
        val token = session.token ?: return

        btnSendMessage.isEnabled = false
        NotificationHelper.recordSelfSentChat(ticketId, content)

        lifecycleScope.launch {
            val result = ApiClient.sendTicketMessage(
                session.serverUrl,
                token,
                ticketId,
                content,
                messageType
            )
            btnSendMessage.isEnabled = true

            result.onSuccess {
                etMessageContent.text.clear()
                loadMessages(silent = true)
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal kirim pesan: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun refreshCurrentTicketMetadata() {
        val token = session.token ?: return
        lifecycleScope.launch {
            ApiClient.getTickets(session.serverUrl, token).onSuccess { list ->
                OfflineSyncManager.saveCachedTickets(this@TicketDetailActivity, list)
                NotificationHelper.syncAndDispatchNotifications(this@TicketDetailActivity, session, list)
                val fresh = list.find { it.id == ticketId } ?: return@onSuccess
                val changed = fresh.status != ticketStatus ||
                    fresh.title != ticketTitle ||
                    (fresh.description ?: "") != ticketDescription ||
                    (fresh.reporterName ?: "") != reporterName ||
                    (fresh.reporterPhone ?: "") != reporterPhone ||
                    (fresh.reporterAddress ?: "") != reporterAddress ||
                    fresh.statusHistory.size != statusHistory.size

                if (changed) {
                    ticketNumber = fresh.ticketNumber
                    ticketTitle = fresh.title
                    ticketStatus = fresh.status
                    ticketPriority = fresh.priority
                    ticketType = fresh.ticketType ?: ""
                    reporterName = fresh.reporterName ?: ""
                    reporterPhone = fresh.reporterPhone ?: ""
                    reporterAddress = fresh.reporterAddress ?: ""
                    reporterMapUrl = fresh.reporterMapUrl ?: ""
                    if (fresh.latitude != null) latitude = fresh.latitude
                    if (fresh.longitude != null) longitude = fresh.longitude
                    ticketDescription = fresh.description ?: ""
                    slaResolutionDue = fresh.slaResolutionDue
                    statusHistory = fresh.statusHistory
                    bindTicketData()
                    updateWorkflowUi(ticketStatus)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateDistanceAndRadiusUi()
        refreshCurrentTicketMetadata()
        chatPollJob?.cancel()
        chatPollJob = lifecycleScope.launch {
            var tick = 0
            while (isActive) {
                delay(4_000L)
                loadMessages(silent = true)
                NotificationHelper.syncAndDispatchNotifications(this@TicketDetailActivity, session)
                tick++
                if (tick % 2 == 0) {
                    refreshCurrentTicketMetadata()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        chatPollJob?.cancel()
        chatPollJob = null
    }
}
