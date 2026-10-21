package net.infinityteknik.helpdesk.ui
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import net.infinityteknik.helpdesk.data.*

class ReportPhotoActivity:AppCompatActivity() {
    override fun onCreate(state:Bundle?) {
        super.onCreate(state)
        val session=SessionManager(this); val token=session.token ?: run { finish(); return }
        val root=HelpdeskTheme.column(this,16).apply { setBackgroundColor(HelpdeskTheme.canvas) }
        root.addView(HelpdeskTheme.button(this,"‹  Kembali ke laporan") { finish() })
        val status=HelpdeskTheme.text(this,"Memuat foto pekerjaan...",13f,HelpdeskTheme.muted).apply { gravity=Gravity.CENTER }
        root.addView(status)
        val image=ImageView(this).apply { scaleType=ImageView.ScaleType.FIT_CENTER; contentDescription="Foto laporan pekerjaan" }
        root.addView(image,LinearLayout.LayoutParams(-1,0,1f)); setContentView(root)
        lifecycleScope.launch {
            ApiClient.getReportImage(session.serverUrl,token,intent.getStringExtra("photo_path").orEmpty()).onSuccess {
                image.setImageBitmap(it); status.visibility=View.GONE
            }.onFailure { status.text=it.message ?: "Foto belum dapat dibuka. Periksa koneksi." }
        }
    }
}
