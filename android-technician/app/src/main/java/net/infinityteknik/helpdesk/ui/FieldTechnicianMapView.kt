package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.graphics.*
import android.location.Location
import android.util.AttributeSet
import android.util.TypedValue
import android.view.MotionEvent
import android.view.View
import net.infinityteknik.helpdesk.data.TicketItem
import java.util.Locale
import net.infinityteknik.helpdesk.util.LocationPolicy
import kotlin.math.*

/**
 * FR-10 & Layar 5 (Peta): Interactive In-App Field Map View (Works 100% Online & Offline).
 * Displays:
 * - Technician's live GPS position
 * - Ticket pins colored by status (Baru = Biru, Berjalan = Oranye, Selesai = Hijau, Tertunda = Kuning)
 * - Dashed route line & real distance (m / km) from technician to selected ticket
 * - Touch pan, zoom controls, and tap-to-select pin for instant ticket preview
 */
class FieldTechnicianMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private data class PlottedPin(
        val ticket: TicketItem,
        val lat: Double,
        val lng: Double,
        val isEstimatedCoord: Boolean,
        var screenX: Float = 0f,
        var screenY: Float = 0f
    )

    private var techLat: Double = 0.0
    private var techLng: Double = 0.0
    private var hasValidTechGps: Boolean = false
    private var pins = listOf<PlottedPin>()
    private var selectedTicketId: String? = null
    private var onPinClickListener: ((TicketItem) -> Unit)? = null

    // Pan & Zoom state
    private var zoomScale: Float = 1.0f
    private var panOffsetX: Float = 0f
    private var panOffsetY: Float = 0f
    private var lastTouchX: Float = 0f
    private var lastTouchY: Float = 0f
    private var downTouchX: Float = 0f
    private var downTouchY: Float = 0f
    private var isDragging = false

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#29292F")
        style = Paint.Style.STROKE
        strokeWidth = dp(1f)
    }
    private val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#29292F")
        style = Paint.Style.STROKE
        strokeWidth = dp(2.2f)
    }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#3B4261")
        style = Paint.Style.STROKE
        strokeWidth = dp(1.2f)
        pathEffect = DashPathEffect(floatArrayOf(dp(6f), dp(6f)), 0f)
    }
    private val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#7890FF")
        style = Paint.Style.STROKE
        strokeWidth = dp(3f)
        pathEffect = DashPathEffect(floatArrayOf(dp(10f), dp(6f)), 0f)
    }
    private val pinFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }
    private val pinStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = dp(2.5f)
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = sp(10.5f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
    }
    private val labelBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#E60F172A")
        style = Paint.Style.FILL
    }
    private val legendPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#C1C1CC")
        textSize = sp(9.5f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private fun dp(v: Float): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

    private fun sp(v: Float): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, v, resources.displayMetrics)

    fun setOnTicketPinClickListener(listener: (TicketItem) -> Unit) {
        onPinClickListener = listener
    }

    fun zoomIn() {
        zoomScale = (zoomScale * 1.35f).coerceAtMost(6.0f)
        invalidate()
    }

    fun zoomOut() {
        zoomScale = (zoomScale / 1.35f).coerceAtLeast(0.45f)
        invalidate()
    }

    fun recenterOnTechnician() {
        panOffsetX = 0f
        panOffsetY = 0f
        zoomScale = 1.0f
        invalidate()
    }

    fun setMapData(
        technicianLat: Double,
        technicianLng: Double,
        tickets: List<TicketItem>,
        currentSelectedId: String? = selectedTicketId
    ) {
        if (LocationPolicy.hasCoordinates(technicianLat, technicianLng)) {
            techLat = technicianLat
            techLng = technicianLng
            hasValidTechGps = true
        } else {
            val firstWithCoord = tickets.firstOrNull { LocationPolicy.hasCoordinates(it.latitude, it.longitude) }
            if (firstWithCoord != null) {
                techLat = firstWithCoord.latitude!!
                techLng = firstWithCoord.longitude!!
            }
            hasValidTechGps = false
        }

        val built = ArrayList<PlottedPin>()
        tickets.forEach { ticket ->
            val lat = ticket.latitude
            val lng = ticket.longitude
            if (LocationPolicy.hasCoordinates(lat, lng)) {
                built.add(PlottedPin(ticket, lat!!, lng!!, false))
            }
        }
        pins = built
        selectedTicketId = currentSelectedId?.takeIf { id -> built.any { it.ticket.id == id } }
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                downTouchX = x
                downTouchY = y
                lastTouchX = x
                lastTouchY = y
                isDragging = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = x - lastTouchX
                val dy = y - lastTouchY
                if (hypot((x - downTouchX).toDouble(), (y - downTouchY).toDouble()) > dp(8f)) {
                    isDragging = true
                }
                if (isDragging) {
                    panOffsetX += dx
                    panOffsetY += dy
                    lastTouchX = x
                    lastTouchY = y
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                if (!isDragging) {
                    // Check if user tapped a ticket pin
                    val hitRadius = dp(28f)
                    val tappedPin = pins.minByOrNull {
                        hypot((it.screenX - x).toDouble(), (it.screenY - y).toDouble())
                    }
                    if (tappedPin != null &&
                        hypot((tappedPin.screenX - x).toDouble(), (tappedPin.screenY - y).toDouble()) <= hitRadius
                    ) {
                        selectedTicketId = tappedPin.ticket.id
                        onPinClickListener?.invoke(tappedPin.ticket)
                        invalidate()
                    }
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun getPinColorForStatus(status: String): Int {
        return when (status.lowercase(Locale.ROOT)) {
            "open", "assigned" -> Color.parseColor("#7890FF") // Baru = Biru
            "accepted", "on_site", "in_progress" -> Color.parseColor("#FFB276") // Berjalan = Oranye
            "resolved", "closed" -> Color.parseColor("#6BDFA7") // Selesai = Hijau
            "pending", "waiting_for_user", "waiting_for_third_party" -> Color.parseColor("#F2D282") // Tertunda = Kuning
            else -> Color.parseColor("#FF9AA5") // Terlambat/Ditolak = Merah
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        // 1. Map Canvas Background
        bgPaint.shader = LinearGradient(
            0f, 0f, 0f, h,
            Color.parseColor("#17171C"),
            Color.parseColor("#29292F"),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, bgPaint)

        val centerX = (w / 2f) + panOffsetX
        val centerY = (h / 2f) + panOffsetY

        // 2. Cartographic Street Grid & Radar Rings
        val gridStep = dp(44f) * zoomScale.coerceIn(0.6f, 2.2f)
        var gx = centerX % gridStep
        while (gx < w) {
            canvas.drawLine(gx, 0f, gx, h, gridPaint)
            gx += gridStep
        }
        var gy = centerY % gridStep
        while (gy < h) {
            canvas.drawLine(0f, gy, w, gy, gridPaint)
            gy += gridStep
        }

        // Main arterial cross-roads around center
        canvas.drawLine(0f, centerY, w, centerY, roadPaint)
        canvas.drawLine(centerX, 0f, centerX, h, roadPaint)

        // Radar distance circles around technician
        val r1 = dp(65f) * zoomScale
        val r2 = dp(135f) * zoomScale
        canvas.drawCircle(centerX, centerY, r1, ringPaint)
        canvas.drawCircle(centerX, centerY, r2, ringPaint)

        // Compute scale (degrees to pixels)
        var maxDeltaDeg = 0.015
        for (p in pins) {
            val dLat = abs(p.lat - techLat)
            val dLng = abs(p.lng - techLng)
            maxDeltaDeg = max(maxDeltaDeg, max(dLat, dLng) * 1.35)
        }
        val pixelsPerDegree = ((min(w, h) * 0.42f) / maxDeltaDeg.toFloat()) * zoomScale

        // Calculate screen positions for all pins
        for (p in pins) {
            val dx = ((p.lng - techLng) * pixelsPerDegree).toFloat()
            val dy = (-(p.lat - techLat) * pixelsPerDegree).toFloat()
            p.screenX = centerX + dx
            p.screenY = centerY + dy
        }

        // 3. Draw Route Line to Selected Ticket Pin
        val selectedPin = pins.find { it.ticket.id == selectedTicketId } ?: pins.firstOrNull()
        if (selectedPin != null) {
            canvas.drawLine(centerX, centerY, selectedPin.screenX, selectedPin.screenY, routePaint)

            // Distance pill at midpoint of route
            val midX = (centerX + selectedPin.screenX) / 2f
            val midY = (centerY + selectedPin.screenY) / 2f
            val distText = if (!selectedPin.isEstimatedCoord) {
                val res = FloatArray(1)
                Location.distanceBetween(techLat, techLng, selectedPin.lat, selectedPin.lng, res)
                val m = res[0]
                if (m >= 1000f) String.format(Locale.US, "%.1f km", m / 1000f) else "${m.toInt()} m"
            } else {
                "Titik Area"
            }

            val pillW = dp(58f)
            val pillH = dp(20f)
            val pillRect = RectF(midX - pillW / 2f, midY - pillH / 2f, midX + pillW / 2f, midY + pillH / 2f)
            canvas.drawRoundRect(pillRect, dp(10f), dp(10f), labelBgPaint)
            canvas.drawText(distText, midX, midY + dp(3.5f), textPaint)
        }

        // 4. Draw Technician Live Position Marker
        val auraPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#330284C7")
            style = Paint.Style.FILL
        }
        canvas.drawCircle(centerX, centerY, dp(22f), auraPaint)

        pinFillPaint.color = Color.parseColor("#9CAEFF")
        canvas.drawCircle(centerX, centerY, dp(10f), pinFillPaint)
        canvas.drawCircle(centerX, centerY, dp(10f), pinStrokePaint)

        // Technician Label
        val techLabel = if (hasValidTechGps) "POSISI ANDA (GPS)" else "POSISI TEKNISI"
        val tw = textPaint.measureText(techLabel) + dp(14f)
        val techRect = RectF(centerX - tw / 2f, centerY + dp(13f), centerX + tw / 2f, centerY + dp(31f))
        canvas.drawRoundRect(techRect, dp(6f), dp(6f), labelBgPaint)
        canvas.drawText(techLabel, centerX, centerY + dp(25.5f), textPaint)

        // 5. Draw All Ticket Pins Colored by Status
        for (p in pins) {
            val isSelected = p.ticket.id == selectedPin?.ticket?.id
            val radius = if (isSelected) dp(15f) else dp(12f)
            val color = getPinColorForStatus(p.ticket.status)

            if (isSelected) {
                val selHalo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    this.color = Color.argb(75, Color.red(color), Color.green(color), Color.blue(color))
                    style = Paint.Style.FILL
                }
                canvas.drawCircle(p.screenX, p.screenY, dp(23f), selHalo)
            }

            pinFillPaint.color = color
            canvas.drawCircle(p.screenX, p.screenY, radius, pinFillPaint)
            canvas.drawCircle(p.screenX, p.screenY, radius, pinStrokePaint)

            // Ticket # label above pin
            val numStr = "#${p.ticket.ticketNumber}"
            val nw = textPaint.measureText(numStr) + dp(12f)
            val nRect = RectF(
                p.screenX - nw / 2f,
                p.screenY - radius - dp(22f),
                p.screenX + nw / 2f,
                p.screenY - radius - dp(4f)
            )
            labelBgPaint.color = if (isSelected) Color.parseColor("#F6F6F8") else Color.parseColor("#CC1E293B")
            canvas.drawRoundRect(nRect, dp(6f), dp(6f), labelBgPaint)
            canvas.drawText(numStr, p.screenX, p.screenY - radius - dp(9.5f), textPaint)
        }

        // 6. Top-Left Compass / Legend Hint
        canvas.drawText(
            "Ketuk pin #tiket untuk pratinjau • Geser untuk melihat area",
            dp(14f),
            dp(22f),
            legendPaint
        )
    }
}
