package net.infinityteknik.helpdesk.ui

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.TicketMessage
import java.text.SimpleDateFormat
import java.util.*

class MessageAdapter : RecyclerView.Adapter<MessageAdapter.MessageViewHolder>() {

    private val messages = ArrayList<TicketMessage>()

    fun submitList(list: List<TicketMessage>) {
        messages.clear()
        messages.addAll(list)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return MessageViewHolder(view)
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        holder.bind(messages[position])
    }

    override fun getItemCount(): Int = messages.size

    inner class MessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val cardMessage: androidx.cardview.widget.CardView = itemView.findViewById(R.id.cardMessage)
        private val tvAuthor: TextView = itemView.findViewById(R.id.tvAuthorName)
        private val tvRole: TextView = itemView.findViewById(R.id.tvRoleBadge)
        private val tvType: TextView = itemView.findViewById(R.id.tvTypeBadge)
        private val tvCreated: TextView = itemView.findViewById(R.id.tvCreatedAt)
        private val tvContent: TextView = itemView.findViewById(R.id.tvMessageContent)

        fun bind(msg: TicketMessage) {
            tvAuthor.text = msg.authorName ?: "Pengguna"
            tvContent.text = msg.content

            val isInternal = msg.type == "internal_note"
            if (isInternal) {
                cardMessage.setCardBackgroundColor(Color.parseColor("#FEF3C7")) // light amber
                tvType.visibility = View.VISIBLE
                tvType.text = "CATATAN TIM"
                tvType.setTextColor(Color.parseColor("#D97706"))
            } else {
                cardMessage.setCardBackgroundColor(Color.parseColor("#FFFFFF"))
                tvType.visibility = View.GONE
            }

            val roleStr = when (msg.authorRole?.lowercase()) {
                "admin" -> "ADMIN"
                "noc" -> "NOC"
                "agent" -> "TEKNISI"
                "owner" -> "OWNER"
                else -> "USER"
            }
            tvRole.text = roleStr

            // Format date
            if (msg.createdAt.isNotBlank()) {
                try {
                    val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                    val outputFormat = SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault())
                    val date = inputFormat.parse(msg.createdAt.substringBefore("."))
                    if (date != null) {
                        tvCreated.text = outputFormat.format(date)
                    } else {
                        tvCreated.text = msg.createdAt.take(16).replace("T", " ")
                    }
                } catch (e: Exception) {
                    tvCreated.text = msg.createdAt.take(16).replace("T", " ")
                }
            } else {
                tvCreated.text = ""
            }
        }
    }
}
