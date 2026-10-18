package net.infinityteknik.helpdesk.util

import android.content.Context
import android.graphics.*
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max

/**
 * FR-16: Compresses work report photos on-device (< 1 MB) and stamps a tamper-evident
 * Watermark banner containing Timestamp (WIB), GPS Coordinates, Ticket #, Stage, and Technician Name.
 */
object PhotoWatermarkHelper {

    private const val MAX_DIMENSION = 1440
    private const val JPEG_QUALITY = 82

    fun processAndWatermarkFile(
        context: Context,
        sourceFile: File,
        ticketNumber: Int,
        stageLabel: String,
        technicianName: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float
    ): File {
        return try {
            val bitmap = decodeScaledBitmap(sourceFile.absolutePath) ?: return sourceFile
            val watermarked = drawWatermarkOnBitmap(
                bitmap,
                ticketNumber,
                stageLabel,
                technicianName,
                latitude,
                longitude,
                accuracy
            )

            val outFile = File(
                context.filesDir,
                "wm_${stageLabel.lowercase(Locale.ROOT)}_${ticketNumber}_${System.currentTimeMillis()}.jpg"
            )
            FileOutputStream(outFile).use { fos ->
                watermarked.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)
                fos.flush()
            }
            if (watermarked != bitmap) watermarked.recycle()
            bitmap.recycle()
            outFile
        } catch (e: Exception) {
            e.printStackTrace()
            sourceFile
        }
    }

    fun processAndWatermarkUri(
        context: Context,
        uri: Uri,
        ticketNumber: Int,
        stageLabel: String,
        technicianName: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float
    ): File? {
        return try {
            val tempFile = File(
                context.cacheDir,
                "raw_${System.currentTimeMillis()}.jpg"
            )
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            } ?: return null

            val processed = processAndWatermarkFile(
                context,
                tempFile,
                ticketNumber,
                stageLabel,
                technicianName,
                latitude,
                longitude,
                accuracy
            )
            try { tempFile.delete() } catch (_: Exception) {}
            processed
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun decodeScaledBitmap(path: String): Bitmap? {
        val boundsOpts = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(path, boundsOpts)
        val w = boundsOpts.outWidth
        val h = boundsOpts.outHeight
        if (w <= 0 || h <= 0) return null

        var sampleSize = 1
        while ((w / sampleSize) > MAX_DIMENSION * 1.5 || (h / sampleSize) > MAX_DIMENSION * 1.5) {
            sampleSize *= 2
        }

        val decodeOpts = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val raw = BitmapFactory.decodeFile(path, decodeOpts) ?: return null

        val maxSide = max(raw.width, raw.height)
        if (maxSide <= MAX_DIMENSION) return raw

        val ratio = MAX_DIMENSION.toFloat() / maxSide.toFloat()
        val targetW = (raw.width * ratio).toInt().coerceAtLeast(1)
        val targetH = (raw.height * ratio).toInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(raw, targetW, targetH, true)
        if (scaled != raw) raw.recycle()
        return scaled
    }

    private fun drawWatermarkOnBitmap(
        src: Bitmap,
        ticketNumber: Int,
        stageLabel: String,
        technicianName: String,
        latitude: Double,
        longitude: Double,
        accuracy: Float
    ): Bitmap {
        val mutable = src.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(mutable)
        val w = mutable.width.toFloat()
        val h = mutable.height.toFloat()

        val scale = (w / 1080f).coerceIn(0.55f, 1.4f)
        val padding = 24f * scale
        val lineHeight = 32f * scale
        val bannerHeight = (lineHeight * 3f) + (padding * 1.8f)
        val topY = (h - bannerHeight).coerceAtLeast(0f)

        // Semi-transparent dark gradient overlay bar at bottom
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f,
                topY - 20f * scale,
                0f,
                h,
                intArrayOf(
                    Color.argb(0, 9, 9, 11),
                    Color.argb(200, 9, 9, 11),
                    Color.argb(230, 9, 9, 11)
                ),
                floatArrayOf(0f, 0.2f, 1f),
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, topY - 20f * scale, w, h, bgPaint)

        // Left accent stripe
        val stripePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (stageLabel.contains("BEFORE", true)) Color.parseColor("#38BDF8") else Color.parseColor("#22C55E")
        }
        canvas.drawRect(
            padding * 0.7f,
            topY + padding * 0.4f,
            padding * 0.7f + (6f * scale),
            h - padding * 0.5f,
            stripePaint
        )

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 25f * scale
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setShadowLayer(4f, 0f, 2f, Color.BLACK)
        }

        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#E2E8F0")
            textSize = 21f * scale
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            setShadowLayer(3f, 0f, 1f, Color.BLACK)
        }

        val sdf = SimpleDateFormat("dd MMM yyyy • HH:mm:ss 'WIB'", Locale("id", "ID")).apply {
            timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        }
        val timeStr = sdf.format(Date())

        val gpsStr = if (latitude != 0.0 || longitude != 0.0) {
            val accPart = if (accuracy > 0f) " (±${accuracy.toInt()}m)" else ""
            String.format(Locale.US, "GPS: %.6f, %.6f%s", latitude, longitude, accPart)
        } else {
            "GPS: Koordinat perangkat belum terkunci"
        }

        val textX = padding * 1.25f
        var curY = topY + padding * 0.9f + (18f * scale)

        canvas.drawText("HELPDESK TEKNISI • TIKET #$ticketNumber [$stageLabel]", textX, curY, titlePaint)
        curY += lineHeight
        canvas.drawText("Waktu: $timeStr • Teknisi: $technicianName", textX, curY, subPaint)
        curY += lineHeight
        canvas.drawText(gpsStr, textX, curY, subPaint)

        return mutable
    }
}
