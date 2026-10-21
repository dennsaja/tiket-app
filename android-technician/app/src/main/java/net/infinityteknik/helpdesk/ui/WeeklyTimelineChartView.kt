package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View

class WeeklyTimelineChartView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null, style: Int = 0) : View(context, attrs, style) {
    private var counts = IntArray(7)
    private var labels = listOf("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    fun setData(values: IntArray, dayLabels: List<String>) {
        counts = IntArray(7) { values.getOrElse(it) { 0 }.coerceAtLeast(0) }
        labels = List(7) { dayLabels.getOrElse(it) { "" } }
        contentDescription = "Aktivitas tiket: " + labels.mapIndexed { index, label -> label + " " + counts[index] }.joinToString(", ")
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        invalidate()
    }
    fun setWeeklyCounts(values: IntArray) = setData(values, labels)
    fun getWeeklyCounts(): IntArray = counts.copyOf()
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (width == 0 || height == 0) return
        val density = resources.displayMetrics.density
        val fontScale = resources.displayMetrics.scaledDensity
        val left = 24 * density
        val bottom = height - 26 * density
        val top = 23 * density
        val max = (counts.maxOrNull() ?: 0).coerceAtLeast(1)
        paint.shader = null
        paint.strokeWidth = density
        paint.color = HelpdeskTheme.border
        for (i in 0..3) {
            val y = top + (bottom - top) * i / 3
            canvas.drawLine(left, y, width.toFloat(), y, paint)
        }
        val step = (width - left) / 7f
        val barWidth = (step * .53f).coerceAtMost(30 * density)
        for (i in 0..6) {
            val x = left + step * (i + .5f)
            val h = if (counts[i] == 0) 2 * density else (bottom - top) * counts[i] / max
            paint.shader = LinearGradient(0f, bottom - h, 0f, bottom, Color.rgb(131,154,255), HelpdeskTheme.blue, Shader.TileMode.CLAMP)
            canvas.drawRoundRect(x - barWidth / 2, bottom - h, x + barWidth / 2, bottom, 8 * density, 8 * density, paint)
            paint.shader = null
            paint.textAlign = Paint.Align.CENTER
            paint.textSize = 10 * fontScale
            paint.color = HelpdeskTheme.muted
            canvas.drawText(labels[i], x, height - 5 * density, paint)
            paint.color = HelpdeskTheme.text
            canvas.drawText(counts[i].toString(), x, bottom - h - 7 * density, paint)
        }
    }
}
