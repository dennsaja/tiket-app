package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
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
        const val EXTRA_LATITUDE = "latitude"
        const val EXTRA_LONGITUDE = "longitude"
        const val EXTRA_DESCRIPTION = "description"
    }

    private lateinit var session: SessionManager

    private var ticketId: String = ""
    private var ticketNumber: Int = 0
    private var ticketTitle: String = ""
    private var ticketStatus: String = "in_progress"
    private var ticketPriority: String = "high"
    private var ticketType: String = ""
    private var reporterName: String = ""
    private var reporterPhone: String = ""
    private var reporterAddress: String = ""
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

    // Views: Tab Detail
    private lateinit var tvInfoTitle: TextView
    private lateinit var tvInfoType: TextView
    private lateinit var tvInfoCustomerName: TextView
    private lateinit var tvInfoCustomerPhone: TextView
    private lateinit var tvInfoCustomerAddress: TextView
    private lateinit var tvInfoDescription: TextView
    private lateinit var btnDetailCall: MaterialButton
    private lateinit var btnDetailMap: MaterialButton
    private lateinit var btnQuickUpdateStatus: MaterialButton

    // Views: Tab Chat
    private lateinit var swipeRefreshChat: SwipeRefreshLayout
    private lateinit var rvMessages: RecyclerView
    private lateinit var rgMessageType: RadioGroup
    private lateinit var etMessageContent: EditText
    private lateinit var btnSendMessage: MaterialButton
    private lateinit var messageAdapter: MessageAdapter

    // Views: Tab Report
    private lateinit var etReportSummary: EditText
    private lateinit var etReportActionTaken: EditText
    private lateinit var etReportMaterials: EditText
    private lateinit var etReportFinalResult: EditText
    private lateinit var btnPickBeforePhotos: MaterialButton
    private lateinit var tvBeforePhotosCount: TextView
    private lateinit var btnPickAfterPhotos: MaterialButton
    private lateinit var tvAfterPhotosCount: TextView
    private lateinit var btnSubmitReport: MaterialButton

    private val beforePhotoFiles = ArrayList<File>()
    private val afterPhotoFiles = ArrayList<File>()

    // Activity Result Launchers for picking images
    private val pickBeforeLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris != null && uris.isNotEmpty()) {
            beforePhotoFiles.clear()
            for (uri in uris) {
                val file = uriToFile(uri, "before_${System.currentTimeMillis()}_${beforePhotoFiles.size}.jpg")
                if (file != null) beforePhotoFiles.add(file)
            }
            tvBeforePhotosCount.text = "${beforePhotoFiles.size} foto dipilih"
        }
    }

    private val pickAfterLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris != null && uris.isNotEmpty()) {
            afterPhotoFiles.clear()
            for (uri in uris) {
                val file = uriToFile(uri, "after_${System.currentTimeMillis()}_${afterPhotoFiles.size}.jpg")
                if (file != null) afterPhotoFiles.add(file)
            }
            tvAfterPhotosCount.text = "${afterPhotoFiles.size} foto dipilih"
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
        switchTab(0) // Default to detail
    }

    private fun readIntentExtras() {
        ticketId = intent.getStringExtra(EXTRA_TICKET_ID) ?: ""
        ticketNumber = intent.getIntExtra(EXTRA_TICKET_NUMBER, 0)
        ticketTitle = intent.getStringExtra(EXTRA_TITLE) ?: ""
        ticketStatus = intent.getStringExtra(EXTRA_STATUS) ?: "in_progress"
        ticketPriority = intent.getStringExtra(EXTRA_PRIORITY) ?: "high"
        ticketType = intent.getStringExtra(EXTRA_TYPE) ?: ""
        reporterName = intent.getStringExtra(EXTRA_REPORTER_NAME) ?: ""
        reporterPhone = intent.getStringExtra(EXTRA_REPORTER_PHONE) ?: ""
        reporterAddress = intent.getStringExtra(EXTRA_REPORTER_ADDRESS) ?: ""
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

        // Detail
        tvInfoTitle = findViewById(R.id.tvInfoTitle)
        tvInfoType = findViewById(R.id.tvInfoType)
        tvInfoCustomerName = findViewById(R.id.tvInfoCustomerName)
        tvInfoCustomerPhone = findViewById(R.id.tvInfoCustomerPhone)
        tvInfoCustomerAddress = findViewById(R.id.tvInfoCustomerAddress)
        tvInfoDescription = findViewById(R.id.tvInfoDescription)
        btnDetailCall = findViewById(R.id.btnDetailCall)
        btnDetailMap = findViewById(R.id.btnDetailMap)
        btnQuickUpdateStatus = findViewById(R.id.btnQuickUpdateStatus)

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
        btnPickBeforePhotos = findViewById(R.id.btnPickBeforePhotos)
        tvBeforePhotosCount = findViewById(R.id.tvBeforePhotosCount)
        btnPickAfterPhotos = findViewById(R.id.btnPickAfterPhotos)
        tvAfterPhotosCount = findViewById(R.id.tvAfterPhotosCount)
        btnSubmitReport = findViewById(R.id.btnSubmitReport)

        btnBack.setOnClickListener { finish() }

        tabDetail.setOnClickListener { switchTab(0) }
        tabChat.setOnClickListener {
            switchTab(1)
            loadMessages()
        }
        tabReport.setOnClickListener { switchTab(2) }

        btnDetailCall.setOnClickListener {
            if (reporterPhone.isNotBlank()) {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$reporterPhone")))
            } else {
                Toast.makeText(this, "Nomor telepon tidak tersedia", Toast.LENGTH_SHORT).show()
            }
        }

        btnDetailMap.setOnClickListener {
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
                Toast.makeText(this, "Lokasi atau alamat tiket tidak tersedia", Toast.LENGTH_SHORT).show()
            }
        }

        btnQuickUpdateStatus.setOnClickListener {
            showUpdateStatusDialog()
        }

        btnSendMessage.setOnClickListener {
            sendMessage()
        }

        swipeRefreshChat.setOnRefreshListener {
            loadMessages()
        }

        btnPickBeforePhotos.setOnClickListener {
            pickBeforeLauncher.launch("image/*")
        }

        btnPickAfterPhotos.setOnClickListener {
            pickAfterLauncher.launch("image/*")
        }

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

        // Prefill report summary
        etReportSummary.setText("Penyelesaian $ticketTitle")
    }

    private fun updateStatusBadge(status: String) {
        ticketStatus = status
        val statusDisplay = status.replace("_", " ").uppercase()
        tvDetailStatusBadge.text = statusDisplay
        when (status.lowercase()) {
            "resolved", "closed" -> {
                tvDetailStatusBadge.setTextColor(Color.parseColor("#16A34A"))
            }
            "in_progress", "on_site" -> {
                tvDetailStatusBadge.setTextColor(Color.parseColor("#9333EA"))
            }
            "assigned", "accepted" -> {
                tvDetailStatusBadge.setTextColor(Color.parseColor("#0284C7"))
            }
            else -> {
                tvDetailStatusBadge.setTextColor(Color.parseColor("#64748B"))
            }
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

        val token = session.token ?: return
        val type = if (rgMessageType.checkedRadioButtonId == R.id.rbInternalNote) "internal_note" else "public"

        btnSendMessage.isEnabled = false
        lifecycleScope.launch {
            val result = ApiClient.sendTicketMessage(session.serverUrl, token, ticketId, content, type)
            btnSendMessage.isEnabled = true

            result.onSuccess {
                etMessageContent.text.clear()
                loadMessages()
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal mengirim: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun submitWorkReport() {
        val summary = etReportSummary.text.toString().trim()
        val actionTaken = etReportActionTaken.text.toString().trim()
        val materialsUsed = etReportMaterials.text.toString().trim()
        val finalResult = etReportFinalResult.text.toString().trim()

        if (summary.length < 3) {
            etReportSummary.error = "Ringkasan pekerjaan minimal 3 karakter"
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
                Toast.makeText(this@TicketDetailActivity, "Laporan kerja berhasil dikirim! Tiket selesai.", Toast.LENGTH_LONG).show()
                updateStatusBadge("resolved")
                setResult(RESULT_OK)
                finish()
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showUpdateStatusDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_update_status, null)
        val tvSubtitle = dialogView.findViewById<TextView>(R.id.tvDialogSubtitle)
        val rgStatus = dialogView.findViewById<RadioGroup>(R.id.rgStatus)
        val rbInProgress = dialogView.findViewById<RadioButton>(R.id.rbInProgress)
        val rbOnSite = dialogView.findViewById<RadioButton>(R.id.rbOnSite)
        val rbResolved = dialogView.findViewById<RadioButton>(R.id.rbResolved)
        val etNotes = dialogView.findViewById<EditText>(R.id.etStatusNotes)
        val btnCancel = dialogView.findViewById<Button>(R.id.btnCancelDialog)
        val btnSave = dialogView.findViewById<Button>(R.id.btnSaveDialog)

        tvSubtitle.text = "#$ticketNumber - $ticketTitle"

        when (ticketStatus.lowercase()) {
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
            updateStatusApi(selectedStatus, notes)
        }

        dialog.show()
    }

    private fun updateStatusApi(status: String, notes: String) {
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
                Toast.makeText(this@TicketDetailActivity, "Status tiket diperbarui!", Toast.LENGTH_SHORT).show()
                updateStatusBadge(status)
                setResult(RESULT_OK)
            }.onFailure { err ->
                Toast.makeText(this@TicketDetailActivity, "Gagal: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun uriToFile(uri: Uri, filename: String): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val file = File(cacheDir, filename)
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
