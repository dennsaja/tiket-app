package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.UserProfile
import net.infinityteknik.helpdesk.service.LocationTrackingService

class AuthCallbackActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uri: Uri? = intent?.data
        if (uri != null && uri.scheme == "helpdesk" && uri.host == "auth") {
            val token = uri.getQueryParameter("token")
            val userId = uri.getQueryParameter("id") ?: ""
            val name = uri.getQueryParameter("name") ?: "Teknisi"
            val email = uri.getQueryParameter("email") ?: ""
            val role = uri.getQueryParameter("role") ?: "agent"

            if (!token.isNullOrBlank()) {
                val session = SessionManager(this)
                val profile = UserProfile(
                    id = userId,
                    name = name,
                    email = email,
                    role = role,
                    phone = null,
                    avatarUrl = null
                )

                session.saveUser(profile, token)
                session.isDutyActive = true

                // Start location service
                val serviceIntent = Intent(this, LocationTrackingService::class.java).apply {
                    action = LocationTrackingService.ACTION_START
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                } else {
                    startService(serviceIntent)
                }

                Toast.makeText(this, "Login Berhasil! Halo, $name", Toast.LENGTH_SHORT).show()

                val mainIntent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(mainIntent)
                finish()
                return
            }
        }

        // If invalid data, open LoginActivity
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
