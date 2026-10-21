package net.infinityteknik.helpdesk.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.SessionManager

class LoginActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var error: TextView
    private lateinit var login: MaterialButton
    private lateinit var webLogin: MaterialButton
    private lateinit var progress: ProgressBar
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        session = SessionManager(this)
        email = findViewById(R.id.etEmail)
        password = findViewById(R.id.etPassword)
        error = findViewById(R.id.tvError)
        login = findViewById(R.id.btnLogin)
        webLogin = findViewById(R.id.btnWebLogin)
        progress = findViewById(R.id.pbLoading)
        var visible = false
        findViewById<ImageButton>(R.id.ivTogglePassword).apply {
            setImageResource(R.drawable.ic_eye)
            setOnClickListener {
                visible = !visible
                password.inputType = InputType.TYPE_CLASS_TEXT or if (visible) InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD else InputType.TYPE_TEXT_VARIATION_PASSWORD
                password.typeface = android.graphics.Typeface.DEFAULT
                password.setSelection(password.text.length)
                contentDescription = if (visible) "Sembunyikan kata sandi" else "Tampilkan kata sandi"
            }
        }
        password.setOnEditorActionListener { _, action, _ ->
            if (action == EditorInfo.IME_ACTION_DONE) { performLogin(); true } else false
        }
        login.setOnClickListener { performLogin() }
        webLogin.setOnClickListener {
            if (busy) return@setOnClickListener
            val state = session.beginWebLogin()
            val uri = Uri.parse(session.serverUrl + "/mobile-auth").buildUpon().appendQueryParameter("state", state).build()
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
            } catch (_: ActivityNotFoundException) {
                session.clearWebLogin()
                showError("Browser belum tersedia. Gunakan login akun di bawah.")
            }
        }
    }

    private fun performLogin() {
        if (busy) return
        val identifier = email.text.toString().trim()
        // Passwords are sent exactly as entered, including intentional spaces.
        val secret = password.text.toString()
        if (identifier.isBlank()) { email.error = "Email akun wajib diisi"; email.requestFocus(); return }
        if (secret.isEmpty()) { password.error = "Kata sandi wajib diisi"; password.requestFocus(); return }
        setBusy(true)
        error.visibility = View.GONE
        lifecycleScope.launch {
            val result = ApiClient.login(session.serverUrl, identifier, secret)
            val response = result.getOrNull()
            val token = response?.token
            if (token.isNullOrBlank()) {
                setBusy(false)
                showError(result.exceptionOrNull()?.message ?: "Login gagal. Periksa akun dan koneksi kamu.")
                return@launch
            }
            val profileResult = ApiClient.getMe(session.serverUrl, token)
            val profile = profileResult.getOrNull()
            if (profile == null || profile.role !in setOf("agent", "admin", "owner", "noc")) {
                setBusy(false)
                showError(if (profile == null) "Profil belum dapat diverifikasi. Coba masuk kembali." else "Akun ini belum memiliki akses aplikasi teknisi.")
                return@launch
            }
            session.saveUser(profile, token)
            session.activeTicketsCount = profile.activeTicketsCount
            session.isDutyActive = false
            session.clearWebLogin()
            startActivity(Intent(this@LoginActivity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
            finish()
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        login.isEnabled = !value
        webLogin.isEnabled = !value
        email.isEnabled = !value
        password.isEnabled = !value
        progress.visibility = if (value) View.VISIBLE else View.GONE
        login.text = if (value) "Memverifikasi akun..." else "Masuk"
    }
    private fun showError(message: String) {
        error.text = message
        error.visibility = View.VISIBLE
    }
}
