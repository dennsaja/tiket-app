package net.infinityteknik.helpdesk.ui

import android.graphics.Color
import android.text.util.Linkify
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.TicketMessage
import java.text.SimpleDateFormat
import java.util.*

class MessageAdapter : ListAdapter<TicketMessage, MessageAdapter.Holder>(object : DiffUtil.ItemCallback<TicketMessage>() {
    override fun areItemsTheSame(a: TicketMessage, b: TicketMessage) = a.id == b.id
    override fun areContentsTheSame(a: TicketMessage, b: TicketMessage) = a == b
}) {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder = Holder(HelpdeskTheme.column(parent.context))
    override fun onBindViewHolder(holder: Holder, position: Int) = holder.bind(getItem(position), if(position > 0) getItem(position - 1) else null)
    class Holder(private val root: LinearLayout) : RecyclerView.ViewHolder(root) {
        private val context = root.context
        private fun dp(v: Int) = HelpdeskTheme.dp(context, v)
        private val date = HelpdeskTheme.text(context, "", 10f, HelpdeskTheme.muted).apply { gravity = Gravity.CENTER; setPadding(0, dp(18), 0, dp(16)) }
        private val row = LinearLayout(context).apply { gravity = Gravity.BOTTOM; orientation = LinearLayout.HORIZONTAL }
        private val avatar = AvatarView(context)
        private val bubble = HelpdeskTheme.column(context, 14)
        private val author = HelpdeskTheme.text(context, "", 11f, Color.rgb(170,185,255), true)
        private val text = HelpdeskTheme.text(context, "", 14f).apply { setTextIsSelectable(true); autoLinkMask = Linkify.WEB_URLS; setLinkTextColor(Color.rgb(211,222,255)) }
        private val time = HelpdeskTheme.text(context, "", 9f, HelpdeskTheme.muted).apply { gravity = Gravity.END; setPadding(0, dp(8), 0, 0) }
        init {
            root.layoutParams = RecyclerView.LayoutParams(-1, -2)
            root.setPadding(dp(16), 0, dp(16), dp(12))
            root.addView(date); row.addView(avatar, LinearLayout.LayoutParams(dp(30), dp(30)).apply { marginEnd = dp(9) })
            bubble.addView(author); bubble.addView(text, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(5) }); bubble.addView(time)
            row.addView(bubble, LinearLayout.LayoutParams(-2, -2)); root.addView(row, LinearLayout.LayoutParams(-1, -2))
        }
        fun bind(message: TicketMessage, previous: TicketMessage?) {
            val own = message.authorId == SessionManager(context).userId
            row.gravity = (if(own) Gravity.END else Gravity.START) or Gravity.BOTTOM
            avatar.visibility = if(own) View.GONE else View.VISIBLE
            avatar.bind(message.authorName ?: "Tim", message.authorAvatarUrl)
            bubble.background = HelpdeskTheme.shape(context, if(own) HelpdeskTheme.blue else HelpdeskTheme.surface, 20, if(own) Color.TRANSPARENT else HelpdeskTheme.border)
            author.visibility = if(own) View.GONE else View.VISIBLE
            author.text = (message.authorName ?: "Tim") + " · " + ProfileActivity.roleLabel(message.authorRole)
            text.text = message.content
            text.maxWidth = (context.resources.displayMetrics.widthPixels * .7f).toInt()
            time.setTextColor(if(own) Color.rgb(226,231,255) else HelpdeskTheme.muted)
            val parsed = TicketAdapter.parseIsoDate(message.createdAt)
            val zone = TimeZone.getTimeZone("Asia/Jakarta")
            time.text = parsed?.let { SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = zone }.format(it) }.orEmpty()
            val day = SimpleDateFormat("dd MMM yyyy", Locale("id", "ID")).apply { timeZone = zone }
            val currentDay = parsed?.let { day.format(it) }
            val previousDay = previous?.let { TicketAdapter.parseIsoDate(it.createdAt) }?.let { day.format(it) }
            date.visibility = if(currentDay != null && currentDay != previousDay) View.VISIBLE else View.GONE
            date.text = if(currentDay == day.format(Date())) "Hari ini" else currentDay.orEmpty()
        }
    }
}
