package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.SessionManager

class AuthCallbackActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var content: LinearLayout
    private var verification: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        content = HelpdeskTheme.column(this, 28).apply {
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(HelpdeskTheme.canvas)
        }
        setContentView(content)
        verifyCallback()
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        verification?.cancel()
        verifyCallback()
    }
    private fun verifyCallback() {
        val callback = intent?.data
        if (callback?.scheme != "helpdesk" || callback.host != "auth" || !session.acceptsWebCallback(callback.getQueryParameter("state"))) {
            showError("Tautan login tidak berlaku atau sudah kedaluwarsa. Mulai login kembali dari aplikasi.", false)
            return
        }
        val token = callback.getQueryParameter("token")
        if (token.isNullOrBlank()) { showError("Sesi login belum lengkap. Coba masuk kembali.", false); return }
        content.removeAllViews()
        content.addView(HelpdeskTheme.text(this, "Memverifikasi akun...", 26f, bold = true))
        content.addView(HelpdeskTheme.text(this, "Sebentar lagi kamu kembali ke workspace.", 13f, HelpdeskTheme.muted))
        verification = lifecycleScope.launch {
            val profileResult = ApiClient.getMe(session.serverUrl, token)
            val profile = profileResult.getOrNull()
            if (profile == null) { showError("Akun belum dapat diverifikasi. Periksa koneksi kamu lalu coba lagi.", true); return@launch }
            if (profile.role !in setOf("agent", "admin", "owner", "noc")) {
                showError("Akun ini belum memiliki akses aplikasi teknisi.", false); return@launch
            }
            // Identity and permissions come from the server, never from the callback URL.
            session.saveUser(profile, token)
            session.activeTicketsCount = profile.activeTicketsCount
            session.isDutyActive = false
            session.clearWebLogin()
            startActivity(Intent(this@AuthCallbackActivity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            finish()
        }
    }
    private fun showError(message: String, retry: Boolean) {
        content.removeAllViews()
        content.addView(HelpdeskTheme.text(this, "Login belum selesai", 26f, bold = true))
        content.addView(HelpdeskTheme.text(this, message, 14f, HelpdeskTheme.muted))
        if (retry) content.addView(HelpdeskTheme.button(this, "Coba verifikasi lagi", true) { verifyCallback() })
        content.addView(HelpdeskTheme.button(this, "Kembali ke login") {
            session.clearWebLogin()
            startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            finish()
        })
    }
}
