package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.Intent
import android.location.Location
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketItem
import net.infinityteknik.helpdesk.util.LocationPolicy
import net.infinityteknik.helpdesk.util.NotificationHelper
import java.text.SimpleDateFormat
import java.util.*

class TicketAdapter(
    private val context: Context,
    private val onPrimaryActionClick: (TicketItem) -> Unit,
    private val onDetailClick: (TicketItem) -> Unit,
    private val onChatClick: (TicketItem) -> Unit
) : ListAdapter<TicketItem, TicketAdapter.TicketViewHolder>(object : DiffUtil.ItemCallback<TicketItem>() {
    override fun areItemsTheSame(old: TicketItem, new: TicketItem) = old.id == new.id
    override fun areContentsTheSame(old: TicketItem, new: TicketItem) = old == new
}) {
    override fun onCreateViewHolder(parent: ViewGroup, type: Int) =
        TicketViewHolder(LayoutInflater.from(context).inflate(R.layout.item_ticket, parent, false))
    override fun onBindViewHolder(holder: TicketViewHolder, position: Int) = holder.bind(getItem(position))
    companion object {
        fun calculateDistanceMeters(techLat: Double, techLng: Double, ticket: TicketItem): Float? {
            val tLat = ticket.latitude ?: return null
            val tLng = ticket.longitude ?: return null
            if (!LocationPolicy.hasCoordinates(techLat, techLng) || !LocationPolicy.hasCoordinates(tLat, tLng)) return null
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


    inner class TicketViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val number = view.findViewById<TextView>(R.id.tvTicketNumber)
        private val status = view.findViewById<TextView>(R.id.tvStatusBadge)
        private val title = view.findViewById<TextView>(R.id.tvTicketTitle)
        private val customer = view.findViewById<TextView>(R.id.tvCustomerName)
        private val address = view.findViewById<TextView>(R.id.tvCustomerAddress)
        private val sla = view.findViewById<TextView>(R.id.tvSlaBadge)
        private val primary = view.findViewById<MaterialButton>(R.id.btnPrimaryAction)
        private val chat = view.findViewById<MaterialButton>(R.id.btnQuickChat)
        fun bind(ticket: TicketItem) {
            val session = SessionManager(context)
            number.text = "#" + ticket.ticketNumber + "  ·  " + ticket.priority.replaceFirstChar { it.uppercase() }
            number.setTextColor(if (ticket.priority in setOf("critical", "high")) HelpdeskTheme.red else HelpdeskTheme.muted)
            status.text = NotificationHelper.formatStatusName(ticket.status)
            status.setTextColor(when {
                ticket.status in setOf("resolved", "closed") -> HelpdeskTheme.green
                ticket.status in setOf("pending", "waiting_for_user", "waiting_for_third_party") -> HelpdeskTheme.amber
                ticket.status == "cancelled" -> HelpdeskTheme.red
                else -> android.graphics.Color.rgb(156, 174, 255)
            })
            title.text = ticket.title
            customer.text = ticket.reporterName ?: "Pelanggan"
            address.text = ticket.reporterAddress?.takeIf { it.isNotBlank() } ?: "Alamat belum tersedia"
            val distance = if (LocationPolicy.isFresh(session.lastUpdateTime)) calculateDistanceMeters(session.lastLatitude, session.lastLongitude, ticket) else null
            val due = parseIsoDate(ticket.slaResolutionDue)
            sla.text = when {
                LocationPolicy.isFinished(ticket.status) -> "Pekerjaan selesai"
                due == null -> if (distance != null) formatDistanceText(distance) else "SLA belum ditetapkan"
                due.time < System.currentTimeMillis() -> "SLA terlewat"
                else -> "SLA " + SimpleDateFormat("dd MMM, HH:mm", Locale("id", "ID")).apply { timeZone = TimeZone.getTimeZone("Asia/Jakarta") }.format(due) + " WIB"
            }
            sla.setTextColor(if (!LocationPolicy.isFinished(ticket.status) && due != null && due.time < System.currentTimeMillis()) HelpdeskTheme.red else HelpdeskTheme.muted)
            primary.text = when {
                LocationPolicy.isFinished(ticket.status) -> "Lihat laporan"
                ticket.status == "in_progress" -> "Isi laporan"
                else -> "Buka penanganan"
            }
            primary.setOnClickListener { onPrimaryActionClick(ticket) }
            chat.setOnClickListener { onChatClick(ticket) }
            itemView.setOnClickListener { onDetailClick(ticket) }
        }
    }
}
