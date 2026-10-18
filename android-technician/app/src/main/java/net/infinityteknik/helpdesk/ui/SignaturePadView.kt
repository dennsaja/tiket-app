package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

/**
 * FR-19: Interactive Digital Signature Pad View for customer sign-off on Android.
 */
class SignaturePadView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0F172A")
        style = Paint.Style.STROKE
        strokeWidth = 6f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#CBD5E1")
        style = Paint.Style.STROKE
        strokeWidth = 2.5f
    }

    private val guideLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E2E8F0")
        style = Paint.Style.STROKE
        strokeWidth = 2f
        pathEffect = DashPathEffect(floatArrayOf(10f, 8f), 0f)
    }

    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#94A3B8")
        textSize = 28f
        textAlign = Paint.Align.CENTER
    }

    private val path = Path()
    private var lastX = 0f
    private var lastY = 0f
    private var isSigned = false

    fun hasSignature(): Boolean = isSigned

    fun clearSignature() {
        path.reset()
        isSigned = false
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                path.moveTo(x, y)
                lastX = x
                lastY = y
                isSigned = true
                invalidate()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                val midX = (x + lastX) / 2f
                val midY = (y + lastY) / 2f
                path.quadTo(lastX, lastY, midX, midY)
                lastX = x
                lastY = y
                isSigned = true
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                path.lineTo(x, y)
                parent?.requestDisallowInterceptTouchEvent(false)
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        canvas.drawColor(Color.parseColor("#F8FAFC"))

        val baseY = h * 0.76f
        canvas.drawLine(32f, baseY, w - 32f, baseY, guideLinePaint)

        if (!isSigned) {
            hintPaint.textSize = (h * 0.11f).coerceIn(24f, 34f)
            canvas.drawText(
                "Goreskan tanda tangan pelanggan di sini",
                w / 2f,
                h * 0.48f,
                hintPaint
            )
        }

        canvas.drawPath(path, strokePaint)
        canvas.drawRoundRect(RectF(2f, 2f, w - 2f, h - 2f), 16f, 16f, borderPaint)
    }

    fun exportSignatureFile(
        context: Context,
        ticketNumber: Int,
        customerName: String,
        technicianName: String
    ): File? {
        if (!isSigned || width <= 0 || height <= 0) return null
        return try {
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            canvas.drawColor(Color.WHITE)

            // Header & Footer metadata on signature card
            val metaPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.parseColor("#475569")
                textSize = 22f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            val sdf = SimpleDateFormat("dd MMM yyyy HH:mm WIB", Locale("id", "ID")).apply {
                timeZone = TimeZone.getTimeZone("Asia/Jakarta")
            }
            canvas.drawText(
                "TANDA TANGAN PELANGGAN • TIKET #$ticketNumber",
                24f,
                32f,
                metaPaint
            )
            canvas.drawLine(24f, height * 0.78f, width - 24f, height * 0.78f, guideLinePaint)
            canvas.drawPath(path, strokePaint)
            canvas.drawText(
                "Penerima: ${customerName.ifBlank { "Pelanggan" }} • Teknisi: $technicianName • ${sdf.format(Date())}",
                24f,
                height - 16f,
                metaPaint.apply { textSize = 19f }
            )

            val file = File(context.filesDir, "ttd_pelanggan_${ticketNumber}_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { fos ->
                bmp.compress(Bitmap.CompressFormat.JPEG, 88, fos)
                fos.flush()
            }
            bmp.recycle()
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
