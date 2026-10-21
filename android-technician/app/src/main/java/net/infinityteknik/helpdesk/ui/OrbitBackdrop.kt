package net.infinityteknik.helpdesk.ui

import android.graphics.*
import android.graphics.drawable.Drawable

class OrbitBackdrop : Drawable() {
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    override fun draw(canvas:Canvas) {
        val rect=RectF(bounds)
        paint.style=Paint.Style.FILL
        paint.shader=LinearGradient(0f,rect.bottom,rect.right,0f,intArrayOf(Color.rgb(23,23,28),Color.rgb(34,39,61)),null,Shader.TileMode.CLAMP)
        canvas.drawRoundRect(rect,48f,48f,paint); paint.shader=null
        canvas.save(); val path=Path().apply { addRoundRect(rect,48f,48f,Path.Direction.CW) }; canvas.clipPath(path)
        paint.style=Paint.Style.STROKE; paint.strokeWidth=1.2f; paint.color=Color.argb(18,172,184,255)
        for(i in 1..25) { val r=i*rect.width()/20f; canvas.drawCircle(rect.right+rect.width()*.1f,-rect.height()*.3f,r,paint) }
        canvas.restore()
    }
    override fun setAlpha(alpha:Int) { paint.alpha=alpha }
    override fun setColorFilter(filter:ColorFilter?) { paint.colorFilter=filter }
    @Deprecated("Deprecated in Android") override fun getOpacity()=PixelFormat.TRANSLUCENT
}
