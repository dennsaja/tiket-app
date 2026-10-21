package net.infinityteknik.helpdesk

import kotlinx.coroutines.runBlocking
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.TextView
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.ui.TicketDetailActivity
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Robolectric
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[30])
class WorkspaceApiTest {
    @Test fun chatLinkRestoresFinishedTicketAndReportWhileOffline() {
        val context=RuntimeEnvironment.getApplication() as Context
        val session=SessionManager(context)
        session.logout()
        session.saveUser(UserProfile("offline-link", "Teknisi", "tech@example.test", "agent", null, null), "local-token")
        val cached=ApiClient.parseTicketObject(JSONObject("""{"id":"finished","ticketNumber":802,"title":"Pemasangan selesai","status":"resolved","priority":"high","reporterName":"Pelanggan","description":"Pemeriksaan jaringan","latestReport":{"id":"report","summary":"Layanan normal","actionTaken":"Konektor diganti","createdAt":"2026-10-22T01:00:00.000Z"}}"""))
        OfflineSyncManager.saveCachedTickets(context,listOf(cached))
        val controller=Robolectric.buildActivity(TicketDetailActivity::class.java,Intent(context,TicketDetailActivity::class.java).putExtra("ticket_id","finished")).create()
        try {
            val activity=controller.get()
            assertEquals("#802",activity.findViewById<TextView>(R.id.tvDetailTicketNumber).text.toString())
            assertEquals("MENUNGGU VERIFIKASI",activity.findViewById<TextView>(R.id.tvDetailStatusBadge).text.toString())
            assertEquals(View.GONE,activity.findViewById<View>(R.id.reportSection).visibility)
            assertEquals(View.VISIBLE,activity.findViewById<View>(R.id.completedReport).visibility)
            assertTrue(activity.findViewById<TextView>(R.id.submittedReportSummary).text.contains("Konektor diganti"))
        } finally { controller.destroy(); session.logout() }
    }
    @Test fun roomInboxLoadsAllPagesInsteadOfOnlyTheFirstFiftyTickets() = runBlocking {
        val server=MockWebServer(); server.start()
        try {
            val page=JSONArray()
            for(i in 1..100) page.put(JSONObject().put("ticketId","t"+i).put("ticketNumber",i).put("title","Tiket "+i).put("status","assigned"))
            server.enqueue(MockResponse().setBody(page.toString()))
            server.enqueue(MockResponse().setBody("""[{"ticketId":"t101","ticketNumber":101,"title":"Tiket 101","status":"assigned","lastMessage":{"id":"m101","authorId":"other","content":"Siap","authorName":"Tim"}}]"""))
            val rooms=ApiClient.getChatRooms(server.url("/").toString().trimEnd('/'),"token").getOrThrow()
            assertEquals(101,rooms.size); assertEquals("m101",rooms.last().lastMessageId)
            assertEquals("Bearer token",server.takeRequest().getHeader("Authorization"))
            assertTrue(server.takeRequest().path.orEmpty().contains("page=2"))
        } finally { server.shutdown() }
    }
    @Test fun teamConversationUsesTheMembershipProtectedEndpoint() = runBlocking {
        val server=MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setBody("""{"ticket":{"id":"t","ticketNumber":8,"title":"Gangguan","status":"in_progress"},"messages":[{"id":"m","authorId":"noc","content":"Sudah dicek","createdAt":"2026-10-22T01:00:00.000Z","author":{"name":"NOC","role":"noc","avatarUrl":"/api/avatars/noc.jpg"}}]}"""))
            val thread=ApiClient.getTeamThread(server.url("/").toString().trimEnd('/'),"token","t").getOrThrow()
            assertEquals("internal_note",thread.messages.first().type)
            assertEquals("/api/avatars/noc.jpg",thread.messages.first().authorAvatarUrl)
            assertEquals("/api/chat/rooms/t",server.takeRequest().path)
            server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Forbidden"}"""))
            val failed=ApiClient.sendTeamMessage(server.url("/").toString().trimEnd('/'),"token","t"," hello ")
            assertEquals(403,(failed.exceptionOrNull() as ApiException).statusCode)
            assertEquals("hello",JSONObject(server.takeRequest().body.readUtf8()).getString("content"))
        } finally { server.shutdown() }
    }
    @Test fun profileUpdatesReturnTheRefreshedIdentityAndPreservePasswordWhitespace() = runBlocking {
        val server=MockWebServer(); server.start()
        try {
            server.enqueue(MockResponse().setBody("""{"success":true,"token":"new-token","user":{"id":"a","name":"Nama baru","email":"a@example.test","role":"agent","phone":"0812","avatarUrl":null}}"""))
            val result=ApiClient.updateProfile(server.url("/").toString().trimEnd('/'),"old-token",JSONObject().put("name","Nama baru").put("email","a@example.test").put("currentPassword","  secret  ")).getOrThrow()
            assertEquals("new-token",result.second); assertEquals("0812",result.first.phone)
            val request=server.takeRequest()
            assertEquals("PATCH",request.method); assertEquals("/api/mobile/profile",request.path)
            assertEquals("  secret  ",JSONObject(request.body.readUtf8()).getString("currentPassword"))
        } finally { server.shutdown() }
    }
}
