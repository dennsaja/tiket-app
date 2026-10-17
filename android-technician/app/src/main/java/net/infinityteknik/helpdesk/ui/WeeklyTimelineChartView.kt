package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View

/**
 * Custom Canvas view that renders the weekly "Timeline" chart on the Technician Dashboard.
 * Displays ticket counts worked on from Monday (Senin) to Saturday (Sabtu):
 * - White line graph above
 * - When a day has 0 tickets, the graph line drops down to the bottom baseline and displays "0"
 * - Count number + vertical tick "|" + day name ("Senin" .. "Sabtu") below each point
 */
class WeeklyTimelineChartView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val dayLabels = arrayOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu")
    private var dailyCounts = IntArray(6) { 0 }

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = dpF(3.2f)
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private val countTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = spF(11.5f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }

    private val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E0F2FE")
        style = Paint.Style.STROKE
        strokeWidth = dpF(1.3f)
        strokeCap = Paint.Cap.ROUND
    }

    private val dayTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#F0F9FF")
        textSize = spF(9.2f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
    }

    private val linePath = Path()

    fun setWeeklyCounts(counts: IntArray) {
        for (i in 0 until 6) {
            dailyCounts[i] = if (i < counts.size) counts[i].coerceAtLeast(0) else 0
        }
        invalidate()
    }

    fun getWeeklyCounts(): IntArray = dailyCounts.copyOf()

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val colCount = dayLabels.size
        val sidePad = w * 0.08f
        val usableWidth = (w - sidePad * 2f).coerceAtLeast(1f)
        val stepX = usableWidth / (colCount - 1).toFloat()

        // Vertical layout positions from bottom to top
        val dayLabelBaselineY = h - dpF(3f)
        val tickBottomY = dayLabelBaselineY - dpF(11.5f)
        val tickTopY = tickBottomY - dpF(8.5f)
        val countBaselineY = tickTopY - dpF(4.5f)

        val chartBottomY = countBaselineY - dpF(15f)
        val chartTopY = dpF(6f)
        val chartHeight = (chartBottomY - chartTopY).coerceAtLeast(dpF(14f))

        val maxVal = (dailyCounts.maxOrNull() ?: 0)

        linePath.reset()

        for (i in 0 until colCount) {
            val cx = sidePad + i * stepX
            val count = dailyCounts[i]

            // When count == 0, line drops to chartBottomY (baseline).
            // When count > 0, line rises proportionally up to chartTopY.
            val cy = if (maxVal <= 0 || count <= 0) {
                chartBottomY
            } else {
                val ratio = count.toFloat() / maxVal.toFloat()
                chartBottomY - (ratio * chartHeight)
            }

            if (i == 0) {
                linePath.moveTo(cx, cy)
            } else {
                linePath.lineTo(cx, cy)
            }

            // Draw ticket count number (0, 1, 2, ...)
            canvas.drawText(count.toString(), cx, countBaselineY, countTextPaint)

            // Draw vertical tick "|"
            canvas.drawLine(cx, tickTopY, cx, tickBottomY, tickPaint)

            // Draw day name ("Senin" .. "Sabtu")
            canvas.drawText(dayLabels[i], cx, dayLabelBaselineY, dayTextPaint)
        }

        // Draw the white timeline polyline
        canvas.drawPath(linePath, linePaint)
    }

    private fun dpF(value: Float): Float {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics
        )
    }

    private fun spF(value: Float): Float {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP,
            value,
            resources.displayMetrics
        )
    }
}
