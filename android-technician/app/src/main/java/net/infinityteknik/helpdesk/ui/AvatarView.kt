package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.graphics.BitmapFactory
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.*
import net.infinityteknik.helpdesk.data.SessionManager
import java.net.URL

class AvatarView(context: Context) : FrameLayout(context) {
    private val initials = HelpdeskTheme.text(context, "", 19f, HelpdeskTheme.text, true).apply { gravity = Gravity.CENTER }
    private val photo = ImageView(context).apply { scaleType = ImageView.ScaleType.CENTER_CROP; visibility = GONE }
    private var request: Job? = null
    init {
        background = HelpdeskTheme.shape(context, HelpdeskTheme.blue, 100, android.graphics.Color.TRANSPARENT)
        clipToOutline = true
        addView(initials, LayoutParams(-1, -1)); addView(photo, LayoutParams(-1, -1))
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    fun bind(name: String, avatar: String?) {
        request?.cancel(); photo.visibility = GONE; photo.setImageDrawable(null)
        initials.text = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }
        if (avatar.isNullOrBlank()) return
        val owner = context as? AppCompatActivity ?: return
        request = owner.lifecycleScope.launch {
            val bitmap = withContext(Dispatchers.IO) {
                runCatching {
                    val base = URL(SessionManager(context).serverUrl)
                    val url = URL(base, avatar)
                    if (url.protocol != "https" || url.host != base.host) return@runCatching null
                    val connection = url.openConnection().apply { connectTimeout = 6000; readTimeout = 6000 }
                    connection.getInputStream().use { input ->
                        val bytes = input.readBytesLimited(2 * 1024 * 1024)
                        val bounds=BitmapFactory.Options().apply { inJustDecodeBounds=true }
                        BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
                        var sample=1; while(bounds.outWidth/sample>256 || bounds.outHeight/sample>256) sample*=2
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size,BitmapFactory.Options().apply { inSampleSize=sample })
                    }
                }.getOrNull()
            }
            if (isActive && bitmap != null) { photo.setImageBitmap(bitmap); photo.visibility = VISIBLE }
        }
    }
    override fun onDetachedFromWindow() { request?.cancel(); super.onDetachedFromWindow() }
}

private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) {
        val count = read(buffer)
        if (count < 0) break
        if (output.size() + count > limit) throw java.io.IOException("Image too large")
        output.write(buffer, 0, count)
    }
    return output.toByteArray()
}
