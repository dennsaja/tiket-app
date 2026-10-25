package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.TicketItem

/** Only hands-on work appears here; assigned, waiting and completed tickets stay in the list. */
object ActiveTaskSelection {
    fun workingTickets(tickets: List<TicketItem>, role: String): List<TicketItem> =
        if (role != "agent") emptyList() else tickets
            .filter { it.status == "in_progress" || it.status == "on_site" }
            .sortedWith(compareBy<TicketItem> { if (it.status == "in_progress") 0 else 1 }
                .thenByDescending { it.updatedAt }.thenBy { it.id })
}

class ActiveTaskCard(context: Context) : LinearLayout(context) {
    private val ink = Color.rgb(9, 47, 53)
    private val teal = Color.rgb(0, 110, 105)
    private val muted = Color.rgb(87, 111, 111)
    private val status = HelpdeskTheme.text(context, "", 11f, teal, true)
    private val count = HelpdeskTheme.text(context, "", 11f, teal, true)
    private val title = HelpdeskTheme.text(context, "", 21f, ink, true)
    private val description = HelpdeskTheme.text(context, "", 12f, muted)
    private val bumper = TechnicianBumperView(context)
    private var selectedTicket: TicketItem? = null
    var onOpenTicket: ((TicketItem) -> Unit)? = null
    var onViewWorkingTickets: (() -> Unit)? = null

    init {
        id = R.id.activeTaskCard
        orientation = VERTICAL
        visibility = GONE
        val padding = HelpdeskTheme.dp(context, 18)
        setPadding(padding, padding, padding, padding)
        background = HelpdeskTheme.shape(context, Color.rgb(255, 249, 239), 26, Color.TRANSPARENT)
        clipToOutline = true

        val header = LinearLayout(context).apply { orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        status.id = R.id.activeTaskStatus
        header.addView(status, LayoutParams(0, -2, 1f))
        count.apply {
            setPadding(padding / 2, padding / 2, 0, padding / 2)
            setOnClickListener { onViewWorkingTickets?.invoke() }
            isFocusable = true
        }
        header.addView(count)
        addView(header)
        bumper.id = R.id.activeTaskBumper
        addView(bumper, LayoutParams(-1, -2).apply { topMargin = HelpdeskTheme.dp(context, 4); bottomMargin = HelpdeskTheme.dp(context, 12) })
        title.apply { id = R.id.activeTaskTitle; maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        addView(title)
        description.apply { maxLines = 2; ellipsize = TextUtils.TruncateAt.END }
        addView(description, LayoutParams(-1, -2).apply { topMargin = HelpdeskTheme.dp(context, 5) })
        val action = HelpdeskTheme.button(context, "Lanjutkan tugas  ↗", true) { selectedTicket?.let { onOpenTicket?.invoke(it) } }.apply {
            id = R.id.activeTaskContinue
            backgroundTintList = ColorStateList.valueOf(ink)
            setTextColor(Color.WHITE)
        }
        addView(action, LayoutParams(-1, HelpdeskTheme.dp(context, 48)).apply { topMargin = HelpdeskTheme.dp(context, 16) })
    }

    fun bind(tickets: List<TicketItem>, role: String) {
        val working = ActiveTaskSelection.workingTickets(tickets, role)
        selectedTicket = working.firstOrNull()
        val ticket = selectedTicket
        visibility = if (ticket == null) GONE else VISIBLE
        if (ticket == null) return
        status.text = if (ticket.status == "in_progress") "●  SEDANG DIKERJAKAN" else "●  DI LOKASI PELANGGAN"
        title.text = ticket.title
        description.text = "#${ticket.ticketNumber} · ${ticket.reporterName?.takeIf { it.isNotBlank() } ?: "Pelanggan"}"
        count.text = "${working.size} tugas  ↗"
        count.contentDescription = "Lihat ${working.size} tugas yang sedang berjalan"
    }

    fun setHostActive(active: Boolean) { bumper.setHostActive(active) }
}
