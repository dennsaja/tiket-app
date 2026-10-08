package net.infinityteknik.helpdesk.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import net.infinityteknik.helpdesk.R
import net.infinityteknik.helpdesk.data.SessionManager
import net.infinityteknik.helpdesk.data.UserProfile
import net.infinityteknik.helpdesk.service.LocationTrackingService

class WebLoginActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnClose: ImageButton
    private lateinit var pbWebLoading: ProgressBar
    private lateinit var pbCenterLoading: ProgressBar

    private lateinit var session: SessionManager

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_web_login)

        session = SessionManager(this)

        webView = findViewById(R.id.webView)
        btnClose = findViewById(R.id.btnCloseWeb)
        pbWebLoading = findViewById(R.id.pbWebLoading)
        pbCenterLoading = findViewById(R.id.pbCenterLoading)

        btnClose.setOnClickListener { finish() }

        val serverUrl = session.serverUrl.removeSuffix("/")
        val targetUrl = "$serverUrl/mobile-auth"

        setupWebView()
        webView.loadUrl(targetUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.allowFileAccess = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                pbWebLoading.visibility = View.VISIBLE
                if (url != null && handleSchemeUrl(url)) {
                    view?.stopLoading()
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pbWebLoading.visibility = View.GONE
                pbCenterLoading.visibility = View.GONE
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleSchemeUrl(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                return handleSchemeUrl(url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress >= 90) {
                    pbCenterLoading.visibility = View.GONE
                }
            }
        }
    }

    private fun handleSchemeUrl(urlStr: String): Boolean {
        if (urlStr.startsWith("helpdesk://auth")) {
            val uri = Uri.parse(urlStr)
            val token = uri.getQueryParameter("token")
            val userId = uri.getQueryParameter("id") ?: ""
            val name = uri.getQueryParameter("name") ?: "Teknisi"
            val email = uri.getQueryParameter("email") ?: ""
            val role = uri.getQueryParameter("role") ?: "agent"

            if (!token.isNullOrBlank()) {
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

                // Start background tracking service
                val serviceIntent = Intent(this, LocationTrackingService::class.java).apply {
                    action = LocationTrackingService.ACTION_START
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                } else {
                    startService(serviceIntent)
                }

                Toast.makeText(this, "Login Berhasil! Halo, $name", Toast.LENGTH_SHORT).show()

                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                startActivity(intent)
                finish()
                return true
            }
        }
        return false
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
