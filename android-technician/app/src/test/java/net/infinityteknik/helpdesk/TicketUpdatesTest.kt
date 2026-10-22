package net.infinityteknik.helpdesk

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.TextView
import kotlinx.coroutines.runBlocking
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.ui.TicketDetailActivity
import net.infinityteknik.helpdesk.ui.TicketPresentation
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[30])
class TicketUpdatesTest {
    private fun ticket()=ApiClient.parseTicketObject(JSONObject("""{"id":"detail","ticketNumber":803,"title":"Instalasi rumah","status":"assigned","priority":"medium","ticketType":"psb","category":{"name":"PSB"},"subcategory":{"name":"Instalasi FTTH rumah"},"specData":{"bandwidth":"100 Mbps","odpCode":"ODP-7","notes":"","optional":null},"attachments":[{"id":"photo-1","originalName":"Lokasi rumah.jpg","mimeType":"image/jpeg","size":2048}]}"""))
    @Test fun administratorDetailsAndAttachmentsSurviveTheOfflineCache() {
        val original=ticket(); val restored=ApiClient.parseTicketObject(ApiClient.ticketToJsonObject(original))
        assertEquals(original,restored)
        assertTrue(TicketPresentation.fields(restored).contains("Paket / bandwidth" to "100 Mbps"))
        assertTrue(TicketPresentation.fields(restored).contains("Subkategori" to "Instalasi FTTH rumah"))
        assertFalse(TicketPresentation.fields(restored).any { it.first == "Catatan admin" || it.first == "Optional" })
        assertEquals("Lokasi rumah.jpg",restored.attachments.single().name)
    }
    @Test fun detailScreenHidesUnfilledReporterFieldsAndShowsAdministratorAttachments() {
        val context=RuntimeEnvironment.getApplication() as Context
        val session=SessionManager(context); session.logout()
        session.saveUser(UserProfile("detail-qa","Teknisi","detail@example.test","agent",null,null),"inert-local-token")
        OfflineSyncManager.saveCachedTickets(context,listOf(ticket()))
        val controller=Robolectric.buildActivity(TicketDetailActivity::class.java,Intent(context,TicketDetailActivity::class.java).putExtra("ticket_id","detail")).create()
        try {
            val activity=controller.get()
            assertEquals("Detail tiket",activity.findViewById<TextView>(R.id.tabDetail).text.toString())
            assertEquals(View.GONE,activity.findViewById<View>(R.id.tvInfoCustomerPhone).visibility)
            assertEquals(View.GONE,activity.findViewById<View>(R.id.tvInfoCustomerName).visibility)
            assertEquals(View.VISIBLE,activity.findViewById<View>(R.id.adminTicketDetails).visibility)
            assertEquals("Terima tiket",activity.findViewById<TextView>(R.id.btnWorkflowPrimary).text.toString())
        } finally { controller.destroy(); session.logout() }
    }
    @Test fun bulkReadUsesTheServerEndpointAndDoesNotTreatHttpFailureAsSuccess() = runBlocking {
        val server=MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setBody("{\"success\":true}"))
            assertEquals(true,ApiClient.markAllNotificationsRead(server.url("/").toString().trimEnd('/'),"session-token").getOrThrow())
            val request=server.takeRequest(); assertEquals("/api/notifications",request.path); assertEquals("POST",request.method)
            assertEquals("mark_all_read",JSONObject(request.body.readUtf8()).getString("action")); assertEquals("Bearer session-token",request.getHeader("Authorization"))
            server.enqueue(MockResponse().setResponseCode(503))
            assertEquals(false,ApiClient.markAllNotificationsRead(server.url("/").toString().trimEnd('/'),"session-token").getOrThrow())
        } finally { server.shutdown() }
    }
}
