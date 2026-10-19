package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.location.Location
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import java.text.SimpleDateFormat
import java.util.*

class TicketAdapter(
    private val context: Context,
    private val onPrimaryActionClick: (TicketItem) -> Unit,
    private val onDetailClick: (TicketItem) -> Unit,
    private val onChatClick: (TicketItem) -> Unit
) : RecyclerView.Adapter<TicketAdapter.TicketViewHolder>() {

    private val tickets = ArrayList<TicketItem>()
    private val session = SessionManager(context)

    fun submitList(list: List<TicketItem>) {
        tickets.clear()
        tickets.addAll(list)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TicketViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_ticket, parent, false)
        return TicketViewHolder(view)
    }

    override fun onBindViewHolder(holder: TicketViewHolder, position: Int) {
        val ticket = tickets[position]
        holder.bind(ticket)
    }

    override fun getItemCount(): Int = tickets.size

    companion object {
        fun calculateDistanceMeters(techLat: Double, techLng: Double, ticket: TicketItem): Float? {
            val tLat = ticket.latitude ?: return null
            val tLng = ticket.longitude ?: return null
            if (techLat == 0.0 || techLng == 0.0 || tLat == 0.0 || tLng == 0.0) return null
            val res = FloatArray(1)
            Location.distanceBetween(techLat, techLng, tLat, tLng, res)
            return res[0]
        }

        fun formatDistanceText(meters: Float?): String {
            if (meters == null) return "Lokasi belum dipetakan"
            return if (meters >= 1000f) {
                String.format(Locale.US, "Jarak: %.1f km", meters / 1000f)
            } else {
                "Jarak: ${meters.toInt()} m"
            }
        }

        fun parseIsoDate(raw: String?): Date? {
            if (raw.isNullOrBlank()) return null
            val patterns = arrayOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSSX",
                "yyyy-MM-dd'T'HH:mm:ssX",
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd HH:mm:ss"
            )
            for (p in patterns) {
                try {
                    val sdf = SimpleDateFormat(p, Locale.US)
                    if (p.endsWith("'Z'")) sdf.timeZone = TimeZone.getTimeZone("UTC")
                    val d = sdf.parse(raw.trim())
                    if (d != null) return d
                } catch (_: Exception) {}
            }
            return null
        }

        fun openWhatsAppChat(context: Context, phone: String?, customerName: String?, ticketNumber: Int, title: String) {
            if (phone.isNullOrBlank()) {
                Toast.makeText(context, "Nomor WhatsApp pelanggan belum tersedia", Toast.LENGTH_SHORT).show()
                return
            }
            var digits = phone.replace(Regex("[^0-9]"), "")
            if (digits.startsWith("0")) {
                digits = "62" + digits.substring(1)
            } else if (!digits.startsWith("62")) {
                digits = "62$digits"
            }
            val msg = "Halo Bpk/Ibu ${customerName ?: "Pelanggan"}, saya teknisi lapangan HelpDesk terkait penanganan Tiket #$ticketNumber ($title)."
            val uri = Uri.parse("https://wa.me/$digits?text=${Uri.encode(msg)}")
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (e: Exception) {
                Toast.makeText(context, "Tidak dapat membuka WhatsApp", Toast.LENGTH_SHORT).show()
            }
        }
    }

    inner class TicketViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvNumber: TextView = itemView.findViewById(R.id.tvTicketNumber)
        private val tvTypeBadge: TextView = itemView.findViewById(R.id.tvTypeBadge)
        private val tvLeadBadge: TextView = itemView.findViewById(R.id.tvLeadBadge)
        private val tvPriority: TextView = itemView.findViewById(R.id.tvPriorityBadge)
        private val tvStatus: TextView = itemView.findViewById(R.id.tvStatusBadge)
        private val tvDistanceBadge: TextView = itemView.findViewById(R.id.tvDistanceBadge)
        private val ivSlaIcon: ImageView? = itemView.findViewById(R.id.ivSlaIcon)
        private val tvSlaBadge: TextView = itemView.findViewById(R.id.tvSlaBadge)
        private val tvTitle: TextView = itemView.findViewById(R.id.tvTicketTitle)
        private val tvCustomerName: TextView = itemView.findViewById(R.id.tvCustomerName)
        private val tvCustomerPhone: TextView = itemView.findViewById(R.id.tvCustomerPhone)
        private val tvCustomerAddress: TextView = itemView.findViewById(R.id.tvCustomerAddress)
        private val btnQuickChat: MaterialButton = itemView.findViewById(R.id.btnQuickChat)
        private val btnMap: MaterialButton = itemView.findViewById(R.id.btnNavigateMap)
        private val btnWhatsApp: MaterialButton = itemView.findViewById(R.id.btnWhatsAppCustomer)
        private val btnCall: MaterialButton = itemView.findViewById(R.id.btnCallCustomer)
        private val btnPrimaryAction: MaterialButton = itemView.findViewById(R.id.btnPrimaryAction)

        fun bind(ticket: TicketItem) {
            tvNumber.text = "#${ticket.ticketNumber}"
            tvTitle.text = ticket.title

            val typeLabel = when (ticket.ticketType?.lowercase()) {
                "psb" -> "PSB (INSTALASI)"
                "perbaikan_infrastruktur" -> "GANGGUAN / INFRA"
                "pemasangan_cctv" -> "PASANG CCTV"
                "perbaikan_cctv" -> "PERBAIKAN CCTV"
                "maintenance" -> "MAINTENANCE"
                else -> (ticket.ticketType ?: "UMUM").replace("_", " ").uppercase()
            }
            tvTypeBadge.text = typeLabel

            tvLeadBadge.visibility = if (ticket.isLead) View.VISIBLE else View.GONE

            val prioLabel = when (ticket.priority.lowercase()) {
                "critical" -> "KRITIS"
                "high" -> "TINGGI"
                "medium" -> "SEDANG"
                else -> "RENDAH"
            }
            tvPriority.text = prioLabel
            when (ticket.priority.lowercase()) {
                "critical" -> tvPriority.setTextColor(Color.parseColor("#DC2626"))
                "high" -> tvPriority.setTextColor(Color.parseColor("#EA580C"))
                "medium" -> tvPriority.setTextColor(Color.parseColor("#D97706"))
                else -> tvPriority.setTextColor(Color.parseColor("#16A34A"))
            }

            val statusDisplay = when (ticket.status.lowercase()) {
                "open" -> "BARU"
                "assigned" -> "DITUGASKAN"
                "accepted" -> "DALAM PERJALANAN"
                "on_site" -> "TIBA DI LOKASI"
                "in_progress" -> "SEDANG DIKERJAKAN"
                "pending", "waiting_for_user", "waiting_for_third_party" -> "TERTUNDA"
                "resolved" -> "SELESAI (VERIFIKASI)"
                "closed" -> "TERVERIFIKASI"
                else -> ticket.status.replace("_", " ").uppercase()
            }
            tvStatus.text = statusDisplay
            when (ticket.status.lowercase()) {
                "resolved", "closed" -> tvStatus.setTextColor(Color.parseColor("#16A34A"))
                "in_progress", "on_site", "accepted" -> tvStatus.setTextColor(Color.parseColor("#EA580C"))
                "pending", "waiting_for_user", "waiting_for_third_party" -> tvStatus.setTextColor(Color.parseColor("#D97706"))
                "assigned", "open" -> tvStatus.setTextColor(Color.parseColor("#0284C7"))
                else -> tvStatus.setTextColor(Color.parseColor("#DC2626"))
            }

            // FR-03: Distance from technician's current position
            val distMeters = calculateDistanceMeters(session.lastLatitude, session.lastLongitude, ticket)
            tvDistanceBadge.text = formatDistanceText(distMeters)

            // FR-04: SLA Countdown Indicator
            bindSlaBadge(ticket)

            // Customer info
            val custName = ticket.reporterName?.ifBlank { "Pelanggan" } ?: "Pelanggan"
            tvCustomerName.text = "Pelapor: $custName"

            val phone = ticket.reporterPhone?.ifBlank { "-" } ?: "-"
            tvCustomerPhone.text = phone
            val hasPhone = !ticket.reporterPhone.isNullOrBlank()
            btnCall.visibility = if (hasPhone) View.VISIBLE else View.GONE
            btnWhatsApp.visibility = if (hasPhone) View.VISIBLE else View.GONE

            val addr = ticket.reporterAddress?.ifBlank { "Alamat belum dicantumkan" } ?: "Alamat belum dicantumkan"
            tvCustomerAddress.text = addr

            itemView.setOnClickListener {
                onDetailClick(ticket)
            }

            btnQuickChat.setOnClickListener {
                onChatClick(ticket)
            }

            btnWhatsApp.setOnClickListener {
                openWhatsAppChat(context, ticket.reporterPhone, ticket.reporterName, ticket.ticketNumber, ticket.title)
            }

            // FR-07: Single clear primary action per status aligned with progressive workflow
            when (ticket.status.lowercase()) {
                "open", "assigned" -> {
                    btnPrimaryAction.text = "1. Terima Tugas & Mulai Perjalanan"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#004C9E"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "accepted" -> {
                    btnPrimaryAction.text = "2. Konfirmasi Tiba di Lokasi (Check-In)"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#0284C7"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "on_site", "pending" -> {
                    btnPrimaryAction.text = "3. Mulai Pengerjaan Teknis"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#0369A1"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "in_progress" -> {
                    btnPrimaryAction.text = "4. Isi Laporan & Selesaikan Tugas"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#059669"))
                    btnPrimaryAction.setOnClickListener { onDetailClick(ticket) }
                }
                else -> {
                    btnPrimaryAction.text = "Lihat Detail & Bukti Laporan"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#334155"))
                    btnPrimaryAction.setOnClickListener { onDetailClick(ticket) }
                }
            }

            btnMap.setOnClickListener {
                if (!ticket.reporterMapUrl.isNullOrBlank()) {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ticket.reporterMapUrl)))
                    } catch (e: Exception) {
                        Toast.makeText(context, "Tidak dapat membuka link Google Maps", Toast.LENGTH_SHORT).show()
                    }
                } else if (ticket.latitude != null && ticket.longitude != null) {
                    val uri = Uri.parse("google.navigation:q=${ticket.latitude},${ticket.longitude}&mode=d")
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                        setPackage("com.google.android.apps.maps")
                    }
                    if (intent.resolveActivity(context.packageManager) != null) {
                        context.startActivity(intent)
                    } else {
                        val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${ticket.latitude},${ticket.longitude}")
                        context.startActivity(Intent(Intent.ACTION_VIEW, webUri))
                    }
                } else if (!ticket.reporterAddress.isNullOrBlank()) {
                    val mapUri = Uri.parse("geo:0,0?q=${Uri.encode(ticket.reporterAddress)}")
                    context.startActivity(Intent(Intent.ACTION_VIEW, mapUri))
                } else {
                    Toast.makeText(context, "Lokasi atau link Google Maps tidak tersedia", Toast.LENGTH_SHORT).show()
                }
            }

            btnCall.setOnClickListener {
                if (!ticket.reporterPhone.isNullOrBlank()) {
                    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${ticket.reporterPhone}")))
                }
            }
        }

        private fun bindSlaBadge(ticket: TicketItem) {
            val statusLower = ticket.status.lowercase(Locale.ROOT)
            if (statusLower == "resolved" || statusLower == "closed") {
                tvSlaBadge.text = "Tugas Selesai"
                val green = Color.parseColor("#16A34A")
                tvSlaBadge.setTextColor(green)
                ivSlaIcon?.setImageResource(R.drawable.ic_ln_check)
                ivSlaIcon?.setColorFilter(green)
                return
            }

            val dueDate = parseIsoDate(ticket.slaResolutionDue) ?: run {
                val created = parseIsoDate(ticket.createdAt)
                if (created != null) {
                    val slaHours = when (ticket.priority.lowercase(Locale.ROOT)) {
                        "critical" -> 4L
                        "high" -> 8L
                        "medium" -> 24L
                        else -> 48L
                    }
                    Date(created.time + slaHours * 3600_000L)
                } else null
            }

            if (dueDate == null) {
                tvSlaBadge.text = "SLA Sesuai Jadwal"
                val slate = Color.parseColor("#475569")
                tvSlaBadge.setTextColor(slate)
                ivSlaIcon?.setImageResource(R.drawable.ic_ln_clock)
                ivSlaIcon?.setColorFilter(slate)
                return
            }

            val diffMs = dueDate.time - System.currentTimeMillis()
            val diffMins = diffMs / 60_000L
            when {
                diffMins < 0 -> {
                    val overHours = (-diffMins) / 60
                    val overMins = (-diffMins) % 60
                    tvSlaBadge.text = if (overHours > 0) "Lewat SLA ${overHours}j ${overMins}m" else "Lewat SLA ${overMins}m"
                    val red = Color.parseColor("#DC2626")
                    tvSlaBadge.setTextColor(red)
                    ivSlaIcon?.setImageResource(R.drawable.ic_ln_alert)
                    ivSlaIcon?.setColorFilter(red)
                }
                diffMins <= 120 -> {
                    val h = diffMins / 60
                    val m = diffMins % 60
                    tvSlaBadge.text = if (h > 0) "Batas SLA: ${h}j ${m}m" else "Batas SLA: ${m}m"
                    val amber = Color.parseColor("#D97706")
                    tvSlaBadge.setTextColor(amber)
                    ivSlaIcon?.setImageResource(R.drawable.ic_ln_clock)
                    ivSlaIcon?.setColorFilter(amber)
                }
                else -> {
                    val h = diffMins / 60
                    val m = diffMins % 60
                    tvSlaBadge.text = "Sisa SLA: ${h}j ${m}m"
                    val green = Color.parseColor("#15803D")
                    tvSlaBadge.setTextColor(green)
                    ivSlaIcon?.setImageResource(R.drawable.ic_ln_clock)
                    ivSlaIcon?.setColorFilter(green)
                }
            }
        }
    }
}
