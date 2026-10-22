package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.*
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.util.NotificationHelper
import net.infinityteknik.helpdesk.util.OfflineSyncManager

class TeamChatActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var messages: RecyclerView
    private lateinit var adapter: MessageAdapter
    private lateinit var input: EditText
    private lateinit var send: MaterialButton
    private lateinit var banner: TextView
    private lateinit var empty: TextView
    private lateinit var subtitle: TextView
    private var ticketId = ""
    private var loading = false
    private var sending = false
    private var poll: Job? = null
    private var hasAccess = true
    override fun onCreate(state: Bundle?) {
        super.onCreate(state); session = SessionManager(this)
        ticketId = intent.getStringExtra("ticket_id").orEmpty()
        if (!session.isLoggedIn || ticketId.isBlank()) { finish(); return }
        val root = HelpdeskTheme.column(this).apply { setBackgroundColor(HelpdeskTheme.canvas); isFocusableInTouchMode = true }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(14), dp(12), dp(18), dp(12)) }
        header.addView(HelpdeskTheme.button(this, "‹") { finish() }.apply { contentDescription = "Kembali" }, LinearLayout.LayoutParams(dp(48), dp(48)))
        val icon = AvatarView(this).apply { bind("Tim", null) }; header.addView(icon, LinearLayout.LayoutParams(dp(42), dp(42)).apply { marginStart = dp(10) })
        val heading = HelpdeskTheme.column(this).apply { setPadding(dp(12), 0, 0, 0) }
        heading.addView(HelpdeskTheme.text(this, "#" + intent.getIntExtra("ticket_number", 0) + " · Chat tim", 16f, bold = true))
        subtitle = HelpdeskTheme.text(this, intent.getStringExtra("title").orEmpty(), 11f, HelpdeskTheme.muted).apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END }
        heading.addView(subtitle); header.addView(heading, LinearLayout.LayoutParams(0, -2, 1f)); root.addView(header)
        val ticket = HelpdeskTheme.text(this, "Lihat detail tiket  ↗", 12f, android.graphics.Color.rgb(156,174,255)).apply {
            setPadding(dp(22), dp(10), dp(22), dp(14)); isFocusable = true; setOnClickListener {
                startActivity(Intent(this@TeamChatActivity, TicketDetailActivity::class.java).putExtra("ticket_id", ticketId)
                    .putExtra("ticket_number", intent.getIntExtra("ticket_number", 0)).putExtra("title", subtitle.text.toString()))
            }
        }; root.addView(ticket)
        banner = HelpdeskTheme.text(this, "", 12f, HelpdeskTheme.amber).apply { setPadding(dp(20), dp(10), dp(20), dp(10)); visibility = View.GONE; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
        root.addView(banner)
        val body = FrameLayout(this)
        adapter = MessageAdapter()
        messages = RecyclerView(this).apply { layoutManager = LinearLayoutManager(this@TeamChatActivity).apply { stackFromEnd = true }; adapter = this@TeamChatActivity.adapter; clipToPadding = false }
        body.addView(messages, FrameLayout.LayoutParams(-1,-1))
        empty = HelpdeskTheme.text(this, "Percakapan dimulai di sini.\nKoordinasikan pekerjaan bersama tim tiket ini.", 14f, HelpdeskTheme.muted).apply { gravity = Gravity.CENTER; setPadding(dp(32),dp(32),dp(32),dp(32)) }
        body.addView(empty, FrameLayout.LayoutParams(-1,-1)); root.addView(body, LinearLayout.LayoutParams(-1,0,1f))
        val compose = LinearLayout(this).apply { gravity = Gravity.BOTTOM; setPadding(dp(16),dp(12),dp(16),dp(18)); background = HelpdeskTheme.shape(this@TeamChatActivity, HelpdeskTheme.surface, 26) }
        input = EditText(this).apply {
            hint = "Pesan untuk tim..."; textSize = 14f; minLines = 1; maxLines = 4; background = null; setPadding(dp(10),dp(10),dp(10),dp(10))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setTextColor(HelpdeskTheme.text); setHintTextColor(HelpdeskTheme.muted); filters = arrayOf(android.text.InputFilter.LengthFilter(5000))
            setText(session.chatDraft(ticketId)); addTextChangedListener(object: TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { session.saveChatDraft(ticketId, s.toString()) }
                override fun afterTextChanged(s: Editable?) {}
            })
        }; compose.addView(input, LinearLayout.LayoutParams(0,-2,1f))
        send = HelpdeskTheme.button(this, "↑", true) { sendMessage() }.apply { contentDescription = "Kirim pesan ke tim"; textSize = 23f }
        compose.addView(send, LinearLayout.LayoutParams(dp(48),dp(48))); root.addView(compose, LinearLayout.LayoutParams(-1,-2).apply { marginStart=dp(12); marginEnd=dp(12); bottomMargin=dp(10) })
        setContentView(root)
        session.threadMessages(ticketId)?.let { raw -> runCatching {
            val array=org.json.JSONArray(raw)
            val cached=(0 until array.length()).map { ApiClient.parseTeamMessage(array.getJSONObject(it),ticketId) }
            adapter.submitList(cached) { messages.scrollToPosition((adapter.itemCount-1).coerceAtLeast(0)) }
            empty.visibility=if(cached.isEmpty()) View.VISIBLE else View.GONE
            session.markRoomSeen(ticketId,cached.lastOrNull()?.id)
        } }
    }
    private fun load() {
        if (loading || !hasAccess) return
        if(!OfflineSyncManager.isOnline(this)) { banner.text="Offline · Menampilkan percakapan tersimpan."; banner.visibility=View.VISIBLE; return }
        val token = session.token ?: return
        loading = true
        lifecycleScope.launch {
            try {
                ApiClient.getTeamThread(session.serverUrl, token, ticketId).onSuccess { thread ->
                    val wasNearEnd = !messages.canScrollVertically(1)
                    val firstLoad = adapter.itemCount == 0
                    subtitle.text = thread.room.title
                    adapter.submitList(thread.messages) { if(firstLoad || wasNearEnd) messages.scrollToPosition((adapter.itemCount - 1).coerceAtLeast(0)) }
                    empty.visibility = if(thread.messages.isEmpty()) View.VISIBLE else View.GONE
                    thread.messages.forEach { session.markMessageSeen(it.id) }
                    session.markTicketMessageBaselineInitialized(ticketId)
                    session.markRoomSeen(ticketId, thread.messages.lastOrNull()?.id)
                    session.saveThreadMessages(ticketId,org.json.JSONArray(thread.messages.takeLast(200).map { message -> org.json.JSONObject().apply {
                        put("id",message.id); put("authorId",message.authorId); put("content",message.content); put("createdAt",message.createdAt)
                        put("author",org.json.JSONObject().put("name",message.authorName).put("role",message.authorRole).put("avatarUrl",message.authorAvatarUrl))
                    } }).toString())
                    banner.visibility = View.GONE
                }.onFailure { error ->
                    banner.text = if(error is ApiException && error.statusCode in setOf(403,404)) "Kamu sudah tidak memiliki akses ke grup tiket ini." else "Koneksi terputus. Pesan kamu tetap tersimpan; coba kirim saat terhubung."
                    banner.visibility = View.VISIBLE
                    if(error is ApiException && error.statusCode in setOf(401,403,404)) {
                        hasAccess = false; send.isEnabled = false; input.isEnabled = false
                        adapter.submitList(emptyList()); session.saveThreadMessages(ticketId,null)
                    }
                }
            } finally { loading = false }
        }
    }
    private fun sendMessage() {
        val text = input.text.toString().trim()
        if(text.isBlank() || sending || !hasAccess) return
        val token = session.token ?: return
        sending = true; send.isEnabled = false
        lifecycleScope.launch {
            try {
                ApiClient.sendTeamMessage(session.serverUrl, token, ticketId, text).onSuccess {
                    NotificationHelper.recordSelfSentChat(ticketId, text); input.text.clear(); load()
                }.onFailure { error -> banner.text = error.message ?: "Pesan belum terkirim. Coba lagi."; banner.visibility = View.VISIBLE }
            } finally { sending = false; send.isEnabled = hasAccess }
        }
    }
    override fun onResume() { super.onResume(); if(!::adapter.isInitialized) return; load(); poll = lifecycleScope.launch { while(isActive) { delay(8000); load() } } }
    override fun onPause() { poll?.cancel(); poll=null; super.onPause() }
    private fun dp(v: Int) = HelpdeskTheme.dp(this,v)
}
