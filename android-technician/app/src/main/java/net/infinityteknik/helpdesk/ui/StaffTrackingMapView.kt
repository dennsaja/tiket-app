package net.infinityteknik.helpdesk.ui
import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/** Local map code only; account credentials never enter the WebView. */
@SuppressLint("SetJavaScriptEnabled")
class StaffTrackingMapView(context: Context) : WebView(context) {
    private var ready = false
    private var payload: JSONObject? = null
    init {
        settings.javaScriptEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = false
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = false
        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) { ready = true; payload?.let { setData(it) } }
            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean = true
        }
        loadUrl("file:///android_asset/staff-tracking.html")
    }
    fun setData(data: JSONObject) { payload = data; if (ready) evaluateJavascript("window.renderTracking(" + data.toString() + ")", null) }
}
