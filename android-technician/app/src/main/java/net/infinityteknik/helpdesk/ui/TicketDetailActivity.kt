package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.SessionManager
import java.io.File
import java.io.FileOutputStream

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
    private lateinit var layoutResolvedBanner: LinearLayout

    // Views: Customer & Detail Card
    private lateinit var tvInfoTitle: TextView
    private lateinit var tvInfoType: TextView
    private lateinit var tvInfoCustomerName: TextView
    private lateinit var tvInfoCustomerPhone: TextView
    private lateinit var tvInfoCustomerAddress: TextView
    private lateinit var tvInfoDescription: TextView
    private lateinit var btnDetailCall: MaterialButton
    private lateinit var btnDetailMap: MaterialButton

    // Views: Chat Tab
    private lateinit var swipeRefreshChat: SwipeRefreshLayout
    private lateinit var rvMessages: RecyclerView
    private lateinit var rgMessageType: RadioGroup
    private lateinit var etMessageContent: EditText
    private lateinit var btnSendMessage: MaterialButton
    private lateinit var messageAdapter: MessageAdapter

    // Views: Report Tab
    private lateinit var etReportSummary: EditText
    private lateinit var etReportActionTaken: EditText
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
    private lateinit var btnSubmitReport: MaterialButton

    private val beforePhotoFiles = ArrayList<File>()
    private val afterPhotoFiles = ArrayList<File>()

    private var currentCameraTempFile: File? = null
    private var isCapturingBefore = true

    // Camera Result Launcher
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val file = currentCameraTempFile
        if (success && file != null && file.exists() && file.length() > 0) {
            if (isCapturingBefore) {
                beforePhotoFiles.add(file)
                refreshPhotoPreviews(true)
            } else {
                afterPhotoFiles.add(file)
                refreshPhotoPreviews(false)
            }
        }
    }

    // Gallery Result Launchers
    private val pickGalleryBeforeLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris != null && uris.isNotEmpty()) {
            for (uri in uris) {
                val f = uriToFile(uri, "before_${System.currentTimeMillis()}_${beforePhotoFiles.size}.jpg")
                if (f != null) beforePhotoFiles.add(f)
            }
            refreshPhotoPreviews(true)
        }
    }

    private val pickGalleryAfterLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris != null && uris.isNotEmpty()) {
            for (uri in uris) {
                val f = uriToFile(uri, "after_${System.currentTimeMillis()}_${afterPhotoFiles.size}.jpg")
                if (f != null) afterPhotoFiles.add(f)
            }
            refreshPhotoPreviews(false)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ticket_detail)

        session = SessionManager(this)
        readIntentExtras()
        initViews()
        setupChatRecycler()
        bindTicketData()
        updateWorkflowUi(ticketStatus)
        switchTab(0)
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

        // Stepper & Workflow Views
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
        layoutResolvedBanner = findViewById(R.id.layoutResolvedBanner)

        // Detail
        tvInfoTitle = findViewById(R.id.tvInfoTitle)
        tvInfoType = findViewById(R.id.tvInfoType)
        tvInfoCustomerName = findViewById(R.id.tvInfoCustomerName)
        tvInfoCustomerPhone = findViewById(R.id.tvInfoCustomerPhone)
        tvInfoCustomerAddress = findViewById(R.id.tvInfoCustomerAddress)
        tvInfoDescription = findViewById(R.id.tvInfoDescription)
        btnDetailCall = findViewById(R.id.btnDetailCall)
        btnDetailMap = findViewById(R.id.btnDetailMap)

        // Chat
        swipeRefreshChat = findViewById(R.id.swipeRefreshChat)
        rvMessages = findViewById(R.id.rvMessages)
        rgMessageType = findViewById(R.id.rgMessageType)
        etMessageContent = findViewById(R.id.etMessageContent)
        btnSendMessage = findViewById(R.id.btnSendMessage)

        // Report
        etReportSummary = findViewById(R.id.etReportSummary)
        etReportActionTaken = findViewById(R.id.etReportActionTaken)
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
        btnSubmitReport = findViewById(R.id.btnSubmitReport)

        btnBack.setOnClickListener { finish() }

        tabDetail.setOnClickListener { switchTab(0) }
        tabChat.setOnClickListener {
            switchTab(1)
            loadMessages()
        }
        tabReport.setOnClickListener { switchTab(2) }

        // Primary Progressive Workflow Button
        btnWorkflowPrimary.setOnClickListener {
            handlePrimaryWorkflowStep()
        }

        btnDirectStart.setOnClickListener {
            updateStatusTo("in_progress", "Langsung memulai pengerjaan di lokasi")
        }

        // Phone call
        btnDetailCall.setOnClickListener {
            if (reporterPhone.isNotBlank()) {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$reporterPhone")))
            } else {
                Toast.makeText(this, "Nomor telepon tidak tersedia", Toast.LENGTH_SHORT).show()
            }
        }

        // Google Maps Route Navigation
        btnDetailMap.setOnClickListener {
            openGoogleMapsRoute()
        }

        // Send chat message
        btnSendMessage.setOnClickListener {
            sendMessage()
        }

        swipeRefreshChat.setOnRefreshListener {
            loadMessages()
        }

        // Photo Buttons: Before
        btnCameraBefore.setOnClickListener {
            launchCameraCapture(true)
        }
        btnGalleryBefore.setOnClickListener {
            pickGalleryBeforeLauncher.launch("image/*")
        }

        // Photo Buttons: After
        btnCameraAfter.setOnClickListener {
            launchCameraCapture(false)
        }
        btnGalleryAfter.setOnClickListener {
            pickGalleryAfterLauncher.launch("image/*")
        }

        // Submit Work Report
        btnSubmitReport.setOnClickListener {
            submitWorkReport()
        }
    }

    private fun bindTicketData() {
        tvDetailTicketNumber.text = "#$ticketNumber"
        tvDetailTicketTitle.text = ticketTitle
        updateStatusBadge(ticketStatus)

        tvInfoTitle.text = ticketTitle
        tvInfoType.text = "Tipe Tiket: ${ticketType.ifBlank { "Umum" }.replace("_", " ").uppercase()}"
        tvInfoCustomerName.text = "Pelapor: ${reporterName.ifBlank { "Pelanggan" }}"
        tvInfoCustomerPhone.text = "Telepon: ${reporterPhone.ifBlank { "-" }}"
        tvInfoCustomerAddress.text = "Alamat: ${reporterAddress.ifBlank { "-" }}"
        tvInfoDescription.text = ticketDescription.ifBlank { "Tidak ada catatan deskripsi keluhan tambahan." }

        btnDetailCall.visibility = if (reporterPhone.isNotBlank()) View.VISIBLE else View.GONE

        // Prefill report summary
        etReportSummary.setText("Penyelesaian Tiket #$ticketNumber - $ticketTitle")
    }

    private fun updateStatusBadge(status: String) {
        ticketStatus = status
        val statusDisplay = status.replace("_", " ").uppercase()
        tvDetailStatusBadge.text = statusDisplay
        when (status.lowercase()) {
            "resolved", "closed" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#16A34A"))
            "in_progress", "on_site" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#9333EA"))
            "assigned", "accepted" -> tvDetailStatusBadge.setTextColor(Color.parseColor("#0284C7"))
            else -> tvDetailStatusBadge.setTextColor(Color.parseColor("#64748B"))
        }
    }

    private fun updateWorkflowUi(status: String) {
        val inactiveColor = Color.parseColor("#94A3B8")
        val activeBlue = Color.parseColor("#0284C7")
        val activeIndigo = Color.parseColor("#4F46E5")
        val activePurple = Color.parseColor("#7C3AED")
        val activeGreen = Color.parseColor("#16A34A")
        val linePassed = Color.parseColor("#0284C7")
        val lineInactive = Color.parseColor("#E2E8F0")

        btnWorkflowPrimary.visibility = View.VISIBLE
        tvWorkflowSubtitle.visibility = View.VISIBLE
        btnDirectStart.visibility = View.GONE
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

                btnWorkflowPrimary.text = "1. Terima Tiket"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeBlue)
                tvWorkflowSubtitle.text = "Klik untuk menerima penugasan dan mulai menangani tiket ini."
            }
            "accepted" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(inactiveColor)
                step4Text.setTextColor(inactiveColor)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(lineInactive)
                stepLine3.setBackgroundColor(lineInactive)

                btnWorkflowPrimary.text = "2. Tiba di Lokasi (On-Site)"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeIndigo)
                tvWorkflowSubtitle.text = "Konfirmasi Anda telah sampai di tempat pelanggan."
                btnDirectStart.visibility = View.VISIBLE
            }
            "on_site" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(activePurple)
                step4Text.setTextColor(inactiveColor)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(linePassed)
                stepLine3.setBackgroundColor(lineInactive)

                btnWorkflowPrimary.text = "3. Mulai Pengerjaan (In-Progress)"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activePurple)
                tvWorkflowSubtitle.text = "Mulai investigasi kendala dan pengerjaan lapangan."
            }
            "in_progress" -> {
                step1Text.setTextColor(activeBlue)
                step2Text.setTextColor(activeIndigo)
                step3Text.setTextColor(activePurple)
                step4Text.setTextColor(activeGreen)
                stepLine1.setBackgroundColor(linePassed)
                stepLine2.setBackgroundColor(linePassed)
                stepLine3.setBackgroundColor(linePassed)

                btnWorkflowPrimary.text = "4. Selesaikan Tiket & Kirim Laporan"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeGreen)
                tvWorkflowSubtitle.text = "Buka form laporan kerja untuk melampirkan foto before/after."
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
                layoutResolvedBanner.visibility = View.VISIBLE
            }
            else -> {
                btnWorkflowPrimary.text = "Perbarui Status Tiket"
                btnWorkflowPrimary.backgroundTintList = ColorStateList.valueOf(activeBlue)
            }
        }
    }

    private fun handlePrimaryWorkflowStep() {
        when (ticketStatus.lowercase()) {
            "open", "assigned" -> {
                updateStatusTo("accepted", "Tiket diterima oleh teknisi")
            }
            "accepted" -> {
                updateStatusTo("on_site", "Teknisi tiba di lokasi pelanggan")
            }
            "on_site" -> {
                updateStatusTo("in_progress", "Teknisi mulai melakukan penanganan teknis")
            }
            "in_progress" -> {
                // Switch smoothly to Tab 3: Laporan Kerja
                switchTab(2)
            }
            else -> {
                switchTab(2)
            }
        }
    }

    private fun updateStatusTo(newStatus: String, notes: String) {
        val token = session.token ?: return
        btnWorkflowPrimary.isEnabled = false
        val oldText = btnWorkflowPrimary.text.toString()
        btnWorkflowPrimary.text = "Memperbarui Status..."

        lifecycleScope.launch {
            val result = ApiClient.updateTicketStatus(
                session.serverUrl,
                token,
                ticketId,
                newStatus,
                notes,
                null
            )
            btnWorkflowPrimary.isEnabled = true
            btnWorkflowPrimary.text = oldText

            result.onSuccess {
                updateStatusBadge(newStatus)
                updateWorkflowUi(newStatus)
                setResult(RESULT_OK)
                val msg = when (newStatus) {
                    "accepted" -> "Tiket berhasil diterima!"
                    "on_site" -> "Status diubah: Tiba di lokasi (On-Site)"
                    "in_progress" -> "Status diubah: Pengerjaan dimulai (In-Progress)"
                    else -> "Status berhasil diperbarui!"
                }
                Toast.makeText(this@TicketDetailActivity, msg, Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal: ${err.message}", Toast.LENGTH_LONG).show()
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

    private fun switchTab(tabIndex: Int) {
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
        val prefix = if (isBefore) "Foto Before" else "Foto After"

        container.removeAllViews()

        if (list.isEmpty()) {
            countText.text = "Belum ada $prefix dipilih"
        } else {
            countText.text = "${list.size} $prefix dipilih"
        }

        for ((index, file) in list.withIndex()) {
            val card = CardView(this).apply {
                radius = 8f
                cardElevation = 2f
                val lp = LinearLayout.LayoutParams(160, 160).apply {
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
                textSize = 10f
                gravity = Gravity.CENTER
                setBackgroundColor(Color.parseColor("#99000000"))
                val dLp = FrameLayout.LayoutParams(44, 44).apply {
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

    private fun submitWorkReport() {
        val summary = etReportSummary.text.toString().trim()
        val actionTaken = etReportActionTaken.text.toString().trim()
        val materialsUsed = etReportMaterials.text.toString().trim()
        val finalResult = etReportFinalResult.text.toString().trim()

        if (summary.isBlank()) {
            etReportSummary.error = "Ringkasan pekerjaan wajib diisi"
            etReportSummary.requestFocus()
            return
        }

        if (actionTaken.length < 3) {
            etReportActionTaken.error = "Tindakan penanganan minimal 3 karakter"
            etReportActionTaken.requestFocus()
            return
        }

        val token = session.token ?: return
        btnSubmitReport.isEnabled = false
        btnSubmitReport.text = "Mengunggah Laporan & Foto..."

        lifecycleScope.launch {
            val result = ApiClient.submitWorkReport(
                session.serverUrl,
                token,
                ticketId,
                summary,
                actionTaken,
                materialsUsed,
                finalResult,
                beforePhotoFiles,
                afterPhotoFiles
            )

            btnSubmitReport.isEnabled = true
            btnSubmitReport.text = "Kirim Laporan & Selesaikan Tiket"

            result.onSuccess {
                Toast.makeText(
                    this@TicketDetailActivity,
                    "Laporan kerja berhasil diserahkan! Tiket telah diselesaikan.",
                    Toast.LENGTH_LONG
                ).show()
                updateStatusBadge("resolved")
                updateWorkflowUi("resolved")
                setResult(RESULT_OK)
                switchTab(0)
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal kirim laporan: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setupChatRecycler() {
        messageAdapter = MessageAdapter()
        rvMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        rvMessages.adapter = messageAdapter
    }

    private fun loadMessages() {
        val token = session.token ?: return
        swipeRefreshChat.isRefreshing = true

        lifecycleScope.launch {
            val result = ApiClient.getTicketMessages(session.serverUrl, token, ticketId)
            swipeRefreshChat.isRefreshing = false

            result.onSuccess { msgs ->
                messageAdapter.submitList(msgs)
                if (msgs.isNotEmpty()) {
                    rvMessages.scrollToPosition(msgs.size - 1)
                }
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal memuat pesan: ${err.message}", Toast.LENGTH_SHORT).show()
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
                loadMessages()
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal kirim pesan: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun uriToFile(uri: Uri, fileName: String): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val file = File(cacheDir, fileName)
            val outputStream = FileOutputStream(file)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
