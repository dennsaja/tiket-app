package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.Intent
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
    private val onUpdateClick: (TicketItem) -> Unit,
    private val onDetailClick: (TicketItem) -> Unit
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
        private val tvPriority: TextView = itemView.findViewById(R.id.tvPriorityBadge)
        private val tvStatus: TextView = itemView.findViewById(R.id.tvStatusBadge)
        private val tvTitle: TextView = itemView.findViewById(R.id.tvTicketTitle)
        private val tvCustomerName: TextView = itemView.findViewById(R.id.tvCustomerName)
        private val tvCustomerPhone: TextView = itemView.findViewById(R.id.tvCustomerPhone)
        private val tvCustomerAddress: TextView = itemView.findViewById(R.id.tvCustomerAddress)
        private val btnMap: MaterialButton = itemView.findViewById(R.id.btnNavigateMap)
        private val btnCall: MaterialButton = itemView.findViewById(R.id.btnCallCustomer)
        private val btnDetail: MaterialButton = itemView.findViewById(R.id.btnDetail)
        private val btnUpdate: MaterialButton = itemView.findViewById(R.id.btnUpdateStatus)

        fun bind(ticket: TicketItem) {
            tvNumber.text = "#${ticket.ticketNumber}"
            tvTitle.text = ticket.title

            // Priority styling
            tvPriority.text = ticket.priority.uppercase()
            when (ticket.priority.lowercase()) {
                "critical" -> {
                    tvPriority.setTextColor(Color.parseColor("#DC2626"))
                }
                "high" -> {
                    tvPriority.setTextColor(Color.parseColor("#EA580C"))
                }
                "medium" -> {
                    tvPriority.setTextColor(Color.parseColor("#D97706"))
                }
                else -> {
                    tvPriority.setTextColor(Color.parseColor("#16A34A"))
                }
            }

            // Status styling
            val statusDisplay = ticket.status.replace("_", " ").uppercase()
            tvStatus.text = statusDisplay
            when (ticket.status.lowercase()) {
                "resolved", "closed" -> {
                    tvStatus.setTextColor(Color.parseColor("#16A34A"))
                }
                "in_progress", "on_site" -> {
                    tvStatus.setTextColor(Color.parseColor("#9333EA"))
                }
                "assigned", "accepted" -> {
                    tvStatus.setTextColor(Color.parseColor("#0284C7"))
                }
                else -> {
                    tvStatus.setTextColor(Color.parseColor("#64748B"))
                }
            }

            // Customer info (No emojis)
            val custName = ticket.reporterName?.ifBlank { "Pelanggan / Pelapor" } ?: "Pelanggan"
            tvCustomerName.text = "Pelapor: $custName"

            val phone = ticket.reporterPhone ?: "-"
            tvCustomerPhone.text = "Telepon: $phone"
            btnCall.visibility = if (ticket.reporterPhone.isNullOrBlank()) View.GONE else View.VISIBLE

            val addr = ticket.reporterAddress ?: "-"
            tvCustomerAddress.text = "Alamat: $addr"

            // Card click & Detail button
            itemView.setOnClickListener {
                onDetailClick(ticket)
            }

            btnDetail.setOnClickListener {
                onDetailClick(ticket)
            }

            // Map button action
            btnMap.setOnClickListener {
                if (ticket.latitude != null && ticket.longitude != null) {
                    val uri = Uri.parse("google.navigation:q=${ticket.latitude},${ticket.longitude}&mode=d")
                    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                        setPackage("com.google.android.apps.maps")
                    }
                    if (intent.resolveActivity(context.packageManager) != null) {
                        context.startActivity(intent)
                    } else {
                        // Fallback to browser Google Maps
                        val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${ticket.latitude},${ticket.longitude}")
                        context.startActivity(Intent(Intent.ACTION_VIEW, webUri))
                    }
                } else if (!ticket.reporterMapUrl.isNullOrBlank()) {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ticket.reporterMapUrl)))
                } else if (!ticket.reporterAddress.isNullOrBlank()) {
                    val mapUri = Uri.parse("geo:0,0?q=${Uri.encode(ticket.reporterAddress)}")
                    context.startActivity(Intent(Intent.ACTION_VIEW, mapUri))
                } else {
                    Toast.makeText(context, "Alamat atau koordinat tiket tidak tersedia", Toast.LENGTH_SHORT).show()
                }
            }

            // Call button action
            btnCall.setOnClickListener {
                if (!ticket.reporterPhone.isNullOrBlank()) {
                    val dialUri = Uri.parse("tel:${ticket.reporterPhone}")
                    context.startActivity(Intent(Intent.ACTION_DIAL, dialUri))
                }
            }

            // Update status button action
            btnUpdate.setOnClickListener {
                onUpdateClick(ticket)
            }
        }
    }
}
