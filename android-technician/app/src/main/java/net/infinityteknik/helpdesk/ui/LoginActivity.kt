package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.ApiClient
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.service.LocationTrackingService

class LoginActivity : AppCompatActivity() {

    private lateinit var etServerUrl: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var ivTogglePassword: ImageButton
    private lateinit var btnLogin: MaterialButton
    private lateinit var btnWebLogin: MaterialButton
    private lateinit var pbLoading: ProgressBar
    private lateinit var tvError: TextView

    private lateinit var session: SessionManager
    private var isPasswordVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        session = SessionManager(this)

        etServerUrl = findViewById(R.id.etServerUrl)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        ivTogglePassword = findViewById(R.id.ivTogglePassword)
        btnLogin = findViewById(R.id.btnLogin)
        btnWebLogin = findViewById(R.id.btnWebLogin)
        pbLoading = findViewById(R.id.pbLoading)
        tvError = findViewById(R.id.tvError)

        etServerUrl.setText(session.serverUrl)

        // Web SSO Button Click
        btnWebLogin.setOnClickListener {
            val serverUrl = etServerUrl.text.toString().trim().removeSuffix("/")
            if (serverUrl.isNotBlank()) {
                session.serverUrl = serverUrl
            }
            startActivity(Intent(this, WebLoginActivity::class.java))
        }

        // Toggle password visibility
        ivTogglePassword.setOnClickListener {
            isPasswordVisible = !isPasswordVisible
            if (isPasswordVisible) {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            } else {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            }
            etPassword.setSelection(etPassword.text.length)
        }

        // Manual Login Button Click
        btnLogin.setOnClickListener {
            performLogin()
        }
    }

    private fun performLogin() {
        val serverUrl = etServerUrl.text.toString().trim().removeSuffix("/")
        val email = etEmail.text.toString().trim()
        val password = etPassword.text.toString().trim()

        if (serverUrl.isBlank()) {
            showError("URL Server tidak boleh kosong")
            return
        }
        if (email.isBlank()) {
            showError("Email teknisi tidak boleh kosong")
            return
        }
        if (password.isBlank()) {
            showError("Password tidak boleh kosong")
            return
        }

        setLoading(true)
        tvError.visibility = View.GONE

        session.serverUrl = serverUrl

        lifecycleScope.launch {
            val result = ApiClient.login(serverUrl, email, password)
            setLoading(false)

            result.onSuccess { response ->
                if (response.token != null && response.user != null) {
                    session.saveUser(response.user, response.token)
                    session.isDutyActive = true

                    // Start background GPS service
                    val serviceIntent = Intent(this@LoginActivity, LocationTrackingService::class.java).apply {
                        action = LocationTrackingService.ACTION_START
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent)
                    } else {
                        startService(serviceIntent)
                    }

                    Toast.makeText(
                        this@LoginActivity,
                        "Selamat datang, ${response.user.name}!",
                        Toast.LENGTH_SHORT
                    ).show()

                    startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                    finish()
                } else {
                    showError("Data respon server tidak lengkap")
                }
            }.onFailure { err ->
                showError(err.message ?: "Gagal terhubung ke server. Periksa URL dan koneksi Anda.")
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        btnLogin.isEnabled = !loading
        btnWebLogin.isEnabled = !loading
        pbLoading.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun showError(msg: String) {
        tvError.text = msg
        tvError.visibility = View.VISIBLE
    }
}
