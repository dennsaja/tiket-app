package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.button.MaterialButton

object HelpdeskTheme {
    val canvas = Color.rgb(12, 12, 15)
    val surface = Color.rgb(23, 23, 28)
    val border = Color.rgb(41, 41, 47)
    val text = Color.rgb(246, 246, 248)
    val muted = Color.rgb(147, 147, 159)
    val blue = Color.rgb(69, 99, 255)
    val green = Color.rgb(107, 223, 167)
    val amber = Color.rgb(255, 178, 118)
    val red = Color.rgb(255, 154, 165)
    fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density + .5f).toInt()
    fun shape(context: Context, fill: Int = surface, radius: Int = 24, stroke: Int = border) = GradientDrawable().apply {
        setColor(fill)
        cornerRadius = dp(context, radius).toFloat()
        if (stroke != Color.TRANSPARENT) setStroke(dp(context, 1), stroke)
    }
    fun column(context: Context, padding: Int = 0) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(context, padding), dp(context, padding), dp(context, padding), dp(context, padding))
    }
    fun text(context: Context, value: String, size: Float = 14f, color: Int = text, bold: Boolean = false) = TextView(context).apply {
        text = value
        textSize = size
        setTextColor(color)
        typeface = Typeface.create(if (bold) "sans-serif-medium" else "sans-serif", Typeface.NORMAL)
        if (size >= 24f) letterSpacing = -.04f
        setLineSpacing(dp(context, 3).toFloat(), 1f)
    }
    fun button(context: Context, label: String, primary: Boolean = false, onClick: () -> Unit) = MaterialButton(context).apply {
        text = label
        textSize = 13f
        letterSpacing = 0f
        isAllCaps = false
        minHeight = dp(context, 48)
        insetTop = 0
        insetBottom = 0
        cornerRadius = dp(context, 14)
        setTextColor(HelpdeskTheme.text)
        backgroundTintList = ColorStateList.valueOf(if (primary) blue else surface)
        strokeWidth = if (primary) 0 else dp(context, 1)
        strokeColor = ColorStateList.valueOf(border)
        setOnClickListener { onClick() }
        interactive(this)
    }
    @android.annotation.SuppressLint("ClickableViewAccessibility")
    fun interactive(view: android.view.View) {
        view.setOnTouchListener { target, event ->
            val enabled = android.os.Build.VERSION.SDK_INT < 26 || android.animation.ValueAnimator.areAnimatorsEnabled()
            if (enabled) when(event.actionMasked) {
                android.view.MotionEvent.ACTION_DOWN -> target.animate().scaleX(.98f).scaleY(.98f).setDuration(100).start()
                android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> target.animate().scaleX(1f).scaleY(1f).setDuration(160).start()
            }
            false
        }
    }
}
