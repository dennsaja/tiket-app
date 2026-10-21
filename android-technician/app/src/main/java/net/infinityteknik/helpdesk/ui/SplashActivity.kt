package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.SessionManager

class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)
        lifecycleScope.launch {
            delay(250)
            val destination = if (SessionManager(this@SplashActivity).isLoggedIn) MainActivity::class.java else LoginActivity::class.java
            startActivity(Intent(this@SplashActivity, destination))
            finish()
        }
    }
}
