package net.infinityteknik.helpdesk.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.Surface
import android.view.TextureView
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import android.widget.ImageView
import net.infinityteknik.helpdesk.R

/** Local, silent illustration. Decoding is limited to the visible, foreground dashboard. */
class TechnicianBumperView(context: Context) : FrameLayout(context), TextureView.SurfaceTextureListener {
    private lateinit var poster: ImageView
    private lateinit var texture: TextureView
    private var player: MediaPlayer? = null
    private var surface: Surface? = null
    private var hostActive = false
    private var playbackFailed = false
    private val visibleArea = Rect()
    private val scrollListener = ViewTreeObserver.OnScrollChangedListener { updatePlayback() }

    init {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        setBackgroundColor(Color.rgb(255, 249, 239))
        texture = TextureView(context).apply {
            isOpaque = true
            alpha = 0f
            surfaceTextureListener = this@TechnicianBumperView
        }
        addView(texture, LayoutParams(-1, -1))
        poster = ImageView(context).apply {
            setImageResource(R.drawable.technician_work_poster)
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        addView(poster, LayoutParams(-1, -1))
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = width * 2 / 3
        super.onMeasure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
    }

    fun setHostActive(active: Boolean) {
        if (active && !hostActive) playbackFailed = false
        hostActive = active
        updatePlayback()
    }

    private fun shouldPlay(): Boolean {
        val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val motionEnabled = if (Build.VERSION.SDK_INT >= 26) ValueAnimator.areAnimatorsEnabled()
            else Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        return hostActive && isAttachedToWindow && isShown && windowVisibility == View.VISIBLE &&
            motionEnabled && !power.isPowerSaveMode && getGlobalVisibleRect(visibleArea) &&
            visibleArea.height() >= height.coerceAtLeast(1) / 3
    }

    private fun updatePlayback() {
        if (!::texture.isInitialized || !::poster.isInitialized) return
        if (!shouldPlay()) { releasePlayer(); return }
        if (player != null || playbackFailed || !texture.isAvailable) return
        val textureSurface = texture.surfaceTexture ?: return
        try {
            val media = MediaPlayer()
            player = media
            surface = Surface(textureSurface)
            media.setSurface(surface)
            resources.openRawResourceFd(R.raw.technician_work_bumper).use { asset ->
                media.setDataSource(asset.fileDescriptor, asset.startOffset, asset.length)
            }
            media.isLooping = true
            media.setVolume(0f, 0f)
            media.setOnPreparedListener { prepared ->
                if (player === prepared) {
                    if (shouldPlay()) prepared.start() else releasePlayer()
                }
            }
            media.setOnInfoListener { current, what, _ ->
                if (player === current && what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) {
                    texture.alpha = 1f
                    poster.visibility = View.INVISIBLE
                }
                false
            }
            media.setOnErrorListener { current, _, _ ->
                if (player === current) { playbackFailed = true; releasePlayer() }
                true // Keep the poster and task actions available if a decoder is unavailable.
            }
            media.prepareAsync()
        } catch (_: Exception) {
            playbackFailed = true
            releasePlayer()
        }
    }

    private fun releasePlayer() {
        val previous = player
        player = null
        previous?.apply {
            setOnPreparedListener(null)
            setOnInfoListener(null)
            setOnErrorListener(null)
            release()
        }
        surface?.release()
        surface = null
        if (::poster.isInitialized) poster.visibility = View.VISIBLE
        if (::texture.isInitialized) texture.alpha = 0f
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        viewTreeObserver.addOnScrollChangedListener(scrollListener)
        post { updatePlayback() }
    }

    override fun onDetachedFromWindow() {
        if (viewTreeObserver.isAlive) viewTreeObserver.removeOnScrollChangedListener(scrollListener)
        releasePlayer()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        updatePlayback()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        updatePlayback()
    }

    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) { updatePlayback() }
    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) = Unit
    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean { releasePlayer(); return true }
}
