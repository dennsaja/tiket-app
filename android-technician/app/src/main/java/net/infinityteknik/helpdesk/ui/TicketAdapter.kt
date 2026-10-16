package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.TicketItem

class TicketAdapter(
    private val context: Context,
    private val onPrimaryActionClick: (TicketItem) -> Unit,
    private val onDetailClick: (TicketItem) -> Unit,
    private val onChatClick: (TicketItem) -> Unit
) : RecyclerView.Adapter<TicketAdapter.TicketViewHolder>() {

    private val tickets = ArrayList<TicketItem>()

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

    inner class TicketViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvNumber: TextView = itemView.findViewById(R.id.tvTicketNumber)
        private val tvTypeBadge: TextView = itemView.findViewById(R.id.tvTypeBadge)
        private val tvLeadBadge: TextView = itemView.findViewById(R.id.tvLeadBadge)
        private val tvPriority: TextView = itemView.findViewById(R.id.tvPriorityBadge)
        private val tvStatus: TextView = itemView.findViewById(R.id.tvStatusBadge)
        private val tvTitle: TextView = itemView.findViewById(R.id.tvTicketTitle)
        private val tvCustomerName: TextView = itemView.findViewById(R.id.tvCustomerName)
        private val tvCustomerPhone: TextView = itemView.findViewById(R.id.tvCustomerPhone)
        private val tvCustomerAddress: TextView = itemView.findViewById(R.id.tvCustomerAddress)
        private val btnQuickChat: MaterialButton = itemView.findViewById(R.id.btnQuickChat)
        private val btnMap: MaterialButton = itemView.findViewById(R.id.btnNavigateMap)
        private val btnCall: MaterialButton = itemView.findViewById(R.id.btnCallCustomer)
        private val btnPrimaryAction: MaterialButton = itemView.findViewById(R.id.btnPrimaryAction)

        fun bind(ticket: TicketItem) {
            tvNumber.text = "#${ticket.ticketNumber}"
            tvTitle.text = ticket.title

            // Ticket Type Badge (100% Web TicketTypeBadge alignment)
            val typeLabel = when (ticket.ticketType?.lowercase()) {
                "psb" -> "PSB"
                "perbaikan_infrastruktur" -> "INFRASTRUKTUR"
                "pemasangan_cctv" -> "PASANG CCTV"
                "perbaikan_cctv" -> "PERBAIKAN CCTV"
                "maintenance" -> "MAINTENANCE"
                else -> (ticket.ticketType ?: "UMUM").replace("_", " ").uppercase()
            }
            tvTypeBadge.text = typeLabel

            // Lead Badge
            tvLeadBadge.visibility = if (ticket.isLead) View.VISIBLE else View.GONE

            // Priority styling
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

            // Status styling (Matches Web StatusBadge labels)
            val statusDisplay = when (ticket.status.lowercase()) {
                "open" -> "OPEN"
                "assigned" -> "DITUGASKAN"
                "accepted" -> "DITERIMA"
                "on_site" -> "DI LOKASI"
                "in_progress" -> "DIKERJAKAN"
                "resolved" -> "SELESAI"
                "closed" -> "DITUTUP"
                else -> ticket.status.replace("_", " ").uppercase()
            }
            tvStatus.text = statusDisplay
            when (ticket.status.lowercase()) {
                "resolved", "closed" -> tvStatus.setTextColor(Color.parseColor("#16A34A"))
                "in_progress", "on_site" -> tvStatus.setTextColor(Color.parseColor("#7C3AED"))
                "assigned", "accepted" -> tvStatus.setTextColor(Color.parseColor("#0284C7"))
                else -> tvStatus.setTextColor(Color.parseColor("#52525B"))
            }

            // Customer info
            val custName = ticket.reporterName?.ifBlank { "Pelanggan" } ?: "Pelanggan"
            tvCustomerName.text = "Pelapor: $custName"

            val phone = ticket.reporterPhone?.ifBlank { "-" } ?: "-"
            tvCustomerPhone.text = phone
            btnCall.visibility = if (ticket.reporterPhone.isNullOrBlank()) View.GONE else View.VISIBLE

            val addr = ticket.reporterAddress?.ifBlank { "Alamat belum dicantumkan" } ?: "Alamat belum dicantumkan"
            tvCustomerAddress.text = "Lokasi: $addr"

            // Card click -> open detail
            itemView.setOnClickListener {
                onDetailClick(ticket)
            }

            // 1-Tap Direct Team Chat Button
            btnQuickChat.setOnClickListener {
                onChatClick(ticket)
            }

            // Progressive Primary Button based on Web Workflow
            when (ticket.status.lowercase()) {
                "open", "assigned" -> {
                    btnPrimaryAction.text = "Terima Tiket"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#09090B"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "accepted" -> {
                    btnPrimaryAction.text = "Konfirmasi Tiba di Lokasi (On-Site)"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#4F46E5"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "on_site" -> {
                    btnPrimaryAction.text = "Mulai Kerjakan (In-Progress)"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#7C3AED"))
                    btnPrimaryAction.setOnClickListener { onPrimaryActionClick(ticket) }
                }
                "in_progress" -> {
                    btnPrimaryAction.text = "Selesaikan Tiket & Kirim Laporan"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#059669"))
                    btnPrimaryAction.setOnClickListener { onDetailClick(ticket) }
                }
                else -> {
                    btnPrimaryAction.text = "Lihat Detail & Riwayat Tiket"
                    btnPrimaryAction.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#52525B"))
                    btnPrimaryAction.setOnClickListener { onDetailClick(ticket) }
                }
            }

            // Map button action (Google Maps link or GPS coordinates)
            btnMap.setOnClickListener {
                if (!ticket.reporterMapUrl.isNullOrBlank()) {
                    val mapIntent = Intent(Intent.ACTION_VIEW, Uri.parse(ticket.reporterMapUrl))
                    try {
                        context.startActivity(mapIntent)
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

            // Call button action
            btnCall.setOnClickListener {
                if (!ticket.reporterPhone.isNullOrBlank()) {
                    val dialUri = Uri.parse("tel:${ticket.reporterPhone}")
                    context.startActivity(Intent(Intent.ACTION_DIAL, dialUri))
                }
            }
        }
    }
}
