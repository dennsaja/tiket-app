package net.infinityteknik.helpdesk

import android.content.Context
import android.view.View
import androidx.appcompat.view.ContextThemeWrapper
import android.widget.TextView
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.ui.ActiveTaskCard
import net.infinityteknik.helpdesk.ui.ActiveTaskSelection
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class ActiveTaskCardTest {
    private fun ticket(id: String, status: String, updated: String = "2026-10-25T01:00:00Z") =
        ApiClient.parseTicketObject(JSONObject().put("id", id).put("ticketNumber", 801)
            .put("title", "Perbaikan koneksi pelanggan").put("reporterName", "Budi")
            .put("status", status).put("priority", "high").put("updatedAt", updated))

    @Test fun cardOnlySelectsHandsOnWorkForTechnicians() {
        val tickets = listOf("open", "assigned", "accepted", "pending", "waiting_for_user",
            "waiting_for_third_party", "resolved", "closed", "cancelled", "reopened")
            .map { ticket(it, it) }
        assertTrue(ActiveTaskSelection.workingTickets(tickets, "agent").isEmpty())
        val working = tickets + ticket("work", "in_progress") + ticket("site", "on_site")
        assertEquals(listOf("work", "site"), ActiveTaskSelection.workingTickets(working, "agent").map { it.id })
        for (role in listOf("owner", "admin", "noc", "user", "")) {
            assertTrue(ActiveTaskSelection.workingTickets(working, role).isEmpty())
        }
    }

    @Test fun mostRecentlyWorkedTicketWinsWithoutDependingOnApiOrder() {
        val tickets = listOf(ticket("older", "in_progress"), ticket("latest", "in_progress", "2026-10-25T02:00:00Z"), ticket("site", "on_site", "2026-10-25T03:00:00Z"))
        assertEquals("latest", ActiveTaskSelection.workingTickets(tickets.reversed(), "agent").first().id)
    }

    @Test fun cardOpensTheCurrentTicketAndDisappearsWhenItIsFinished() {
        val context = ContextThemeWrapper(RuntimeEnvironment.getApplication() as Context, R.style.Theme_HelpDesk)
        val card = ActiveTaskCard(context)
        var opened: String? = null
        card.onOpenTicket = { opened = it.id }
        card.bind(listOf(ticket("first", "on_site")), "agent")
        assertEquals(View.VISIBLE, card.visibility)
        assertTrue(card.findViewById<TextView>(R.id.activeTaskStatus).text.contains("DI LOKASI"))
        card.bind(listOf(ticket("next", "in_progress")), "agent")
        card.findViewById<View>(R.id.activeTaskContinue).performClick()
        assertEquals("next", opened)
        assertEquals("Perbaikan koneksi pelanggan", card.findViewById<TextView>(R.id.activeTaskTitle).text.toString())
        card.bind(listOf(ticket("next", "resolved")), "agent")
        assertEquals(View.GONE, card.visibility)
        opened = null
        card.findViewById<View>(R.id.activeTaskContinue).performClick()
        assertNull(opened)
    }
}
