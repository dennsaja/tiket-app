package net.infinityteknik.helpdesk.ui

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import net.infinityteknik.helpdesk.data.ChatRoom
import net.infinityteknik.helpdesk.data.SessionManager
import java.text.SimpleDateFormat
import java.util.*

class ChatRoomAdapter(private val open: (ChatRoom) -> Unit) : ListAdapter<ChatRoom, ChatRoomAdapter.Holder>(object: DiffUtil.ItemCallback<ChatRoom>() {
    override fun areItemsTheSame(a: ChatRoom,b: ChatRoom)=a.ticketId==b.ticketId
    override fun areContentsTheSame(a: ChatRoom,b: ChatRoom)=a==b
}) {
    override fun onCreateViewHolder(parent: ViewGroup,type: Int)=Holder(HelpdeskTheme.column(parent.context,16))
    override fun onBindViewHolder(holder: Holder,position: Int)=holder.bind(getItem(position))
    inner class Holder(private val root: LinearLayout): RecyclerView.ViewHolder(root) {
        private val context=root.context
        private fun dp(v:Int)=HelpdeskTheme.dp(context,v)
        private val row=LinearLayout(context).apply { gravity=Gravity.CENTER_VERTICAL }
        private val avatar=HelpdeskTheme.text(context,"#",24f,HelpdeskTheme.text,true).apply { gravity=Gravity.CENTER; background=HelpdeskTheme.shape(context,HelpdeskTheme.blue,18,android.graphics.Color.TRANSPARENT) }
        private val title=HelpdeskTheme.text(context,"",14f,bold=true).apply { maxLines=1; ellipsize=android.text.TextUtils.TruncateAt.END }
        private val number=HelpdeskTheme.text(context,"",10f,HelpdeskTheme.muted)
        private val preview=HelpdeskTheme.text(context,"",12f,HelpdeskTheme.muted).apply { maxLines=2; ellipsize=android.text.TextUtils.TruncateAt.END }
        private val time=HelpdeskTheme.text(context,"",10f,HelpdeskTheme.muted)
        private val dot=HelpdeskTheme.text(context,"●",11f,HelpdeskTheme.blue)
        init {
            root.background=HelpdeskTheme.shape(context,radius=24)
            root.layoutParams=RecyclerView.LayoutParams(-1,-2).apply { bottomMargin=dp(12) }
            row.addView(avatar,LinearLayout.LayoutParams(dp(48),dp(48)))
            val info=HelpdeskTheme.column(context).apply { setPadding(dp(14),0,dp(8),0) }; info.addView(title); info.addView(number)
            row.addView(info,LinearLayout.LayoutParams(0,-2,1f))
            val right=HelpdeskTheme.column(context).apply { gravity=Gravity.END }; right.addView(time); right.addView(dot); row.addView(right)
            root.addView(row); root.addView(preview,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(14) })
            root.isFocusable=true; HelpdeskTheme.interactive(root)
        }
        fun bind(room:ChatRoom) {
            title.text=room.title; number.text="#"+room.ticketNumber+" · "+room.department
            preview.text=room.lastMessage?.let { (room.lastAuthor ?: "Tim")+": "+it } ?: "Belum ada pesan. Mulai diskusi bersama tim."
            val session=SessionManager(context)
            val unread=room.lastMessageId!=null && room.lastAuthorId!=session.userId && session.seenRoomMessage(room.ticketId)!=room.lastMessageId
            dot.visibility=if(unread) View.VISIBLE else View.INVISIBLE
            title.setTextColor(if(unread) HelpdeskTheme.text else android.graphics.Color.rgb(208,208,216))
            time.text=TicketAdapter.parseIsoDate(room.updatedAt)?.let { SimpleDateFormat("dd MMM",Locale("id","ID")).apply { timeZone=TimeZone.getTimeZone("Asia/Jakarta") }.format(it) }.orEmpty()
            root.setOnClickListener { open(room) }
        }
    }
}
