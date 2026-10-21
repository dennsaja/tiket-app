package net.infinityteknik.helpdesk

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.EditText
import android.widget.TextView
import kotlinx.coroutines.runBlocking
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.ui.LoginActivity
import net.infinityteknik.helpdesk.ui.AuthCallbackActivity
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class LoginAndSessionTest {
    private val context get() = RuntimeEnvironment.getApplication() as Context
    private fun user(id: String) = UserProfile(id, "Teknisi " + id, id + "@example.test", "agent", null, null)
    @Before fun clean() {
        SessionManager(context).logout()
        listOf("a", "b").forEach { context.getSharedPreferences("helpdesk_offline_sync_v2_" + it, Context.MODE_PRIVATE).edit().clear().commit() }
    }
    @Test fun browserLoginUsesTheExternalHelpdeskAndPreservesState() {
        val activity = Robolectric.buildActivity(LoginActivity::class.java).setup().get()
        activity.findViewById<View>(R.id.btnWebLogin).performClick()
        val browser = shadowOf(activity).nextStartedActivity
        assertEquals(Intent.ACTION_VIEW, browser.action)
        assertEquals("https", browser.data?.scheme)
        assertEquals("helpdesk.infinityteknik.net", browser.data?.host)
        assertEquals("/mobile-auth", browser.data?.path)
        assertTrue(SessionManager(context).acceptsWebCallback(browser.data?.getQueryParameter("state")))
        assertEquals(0, activity.resources.getIdentifier("etServerUrl", "id", activity.packageName))
    }
    @Test fun loginInflatesOnAndroid11() {
        val activity = Robolectric.buildActivity(LoginActivity::class.java).setup().get()
        assertEquals("Lanjutkan lewat web", activity.findViewById<TextView>(R.id.btnWebLogin).text.toString())
        assertNotNull(activity.findViewById<EditText>(R.id.etEmail))
    }
    @Test fun callbacksWithoutAnAppInitiatedStateCannotCreateASession() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("helpdesk://auth?token=untrusted&id=attacker&role=noc"))
        val activity = Robolectric.buildActivity(AuthCallbackActivity::class.java, intent).setup().get()
        assertFalse(SessionManager(context).isLoggedIn)
        assertNull(shadowOf(activity).nextStartedActivity)
    }
    @Test fun serverAddressIsFixedEvenWhenAnOldInstallationHadACustomUrl() {
        context.getSharedPreferences("helpdesk_technician_prefs", Context.MODE_PRIVATE).edit().putString("server_url", "https://other.example.test").commit()
        assertEquals(SessionManager.DEFAULT_SERVER_URL, SessionManager(context).serverUrl)
    }
    @Test fun draftsAreIsolatedAcrossLogoutAndAccountSwitching() {
        val session = SessionManager(context)
        session.saveUser(user("a"), "token-a")
        OfflineSyncManager.saveReportDraft(context, ReportDraftData("ticket-a", summary = "Draft A", beforePhotoPaths = listOf("/private/before.jpg"), afterPhotoPaths = listOf("/private/after.jpg")))
        session.lastLatitude = -6.7
        session.lastLongitude = 110.8
        session.activeTicketsCount = 3
        session.logout()
        assertEquals(0, session.activeTicketsCount)
        assertEquals(0.0, session.lastLatitude, 0.0)
        session.saveUser(user("b"), "token-b")
        assertNull(OfflineSyncManager.getReportDraft(context, "ticket-a"))
        session.logout()
        session.saveUser(user("a"), "token-a")
        assertEquals("Draft A", OfflineSyncManager.getReportDraft(context, "ticket-a")?.summary)
        assertEquals(listOf("/private/before.jpg"), OfflineSyncManager.getReportDraft(context, "ticket-a")?.beforePhotoPaths)
        assertEquals(listOf("/private/after.jpg"), OfflineSyncManager.getReportDraft(context, "ticket-a")?.afterPhotoPaths)
    }
    @Test fun credentialsPreservePasswordWhitespaceAndHttpErrorsAreTyped() = runBlocking {
        val server = MockWebServer()
        server.start()
        try {
            server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Email atau password salah"}"""))
            val result = ApiClient.login(server.url("/").toString().trimEnd('/'), "  tech@example.test  ", "  secret  ")
            val body = JSONObject(server.takeRequest().body.readUtf8())
            assertEquals("tech@example.test", body.getString("email"))
            assertEquals("  secret  ", body.getString("password"))
            assertTrue(result.exceptionOrNull() is ApiException)
            assertEquals(401, (result.exceptionOrNull() as ApiException).statusCode)
        } finally { server.shutdown() }
    }
}
