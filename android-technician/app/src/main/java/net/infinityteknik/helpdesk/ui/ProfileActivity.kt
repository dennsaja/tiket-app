package net.infinityteknik.helpdesk.ui

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.*
import net.infinityteknik.helpdesk.data.*
import net.infinityteknik.helpdesk.util.OfflineSyncManager
import org.json.JSONObject
import java.io.File

class ProfileActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var avatar: AvatarView
    private lateinit var name: EditText
    private lateinit var email: EditText
    private lateinit var phone: EditText
    private lateinit var current: EditText
    private lateinit var password: EditText
    private lateinit var confirmation: EditText
    private lateinit var save: com.google.android.material.button.MaterialButton
    private lateinit var status: TextView
    private lateinit var photoButton: com.google.android.material.button.MaterialButton
    private var busy = false
    private val picker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null && !busy) lifecycleScope.launch {
            setBusy(true)
            var file: File? = null
            try {
                file = withContext(Dispatchers.IO) {
                    File.createTempFile("avatar_", ".jpg", cacheDir).also { target ->
                        contentResolver.openInputStream(uri)?.use { input -> target.outputStream().use { output ->
                            val buffer = ByteArray(8192); var total = 0
                            while (true) { val n = input.read(buffer); if (n < 0) break; total += n
                                if (total > 5 * 1024 * 1024) throw java.io.IOException("Ukuran foto maksimal 5 MB")
                                output.write(buffer, 0, n)
                            }
                        } } ?: throw java.io.IOException("Foto tidak dapat dibaca")
                    }
                }
                val token = session.token ?: return@launch
                ApiClient.updateAvatar(session.serverUrl, token, file).onSuccess {
                    session.userAvatar = it; avatar.bind(session.userName.orEmpty(), it); status.text = "Foto profil diperbarui."; setResult(RESULT_OK)
                }.onFailure { showError(it) }
            } catch (e: Exception) { status.text = e.message ?: "Foto belum dapat diperbarui." }
            finally { file?.delete(); setBusy(false) }
        }
    }
    override fun onCreate(state: Bundle?) {
        super.onCreate(state); session = SessionManager(this)
        if (!session.isLoggedIn) { finish(); return }
        val root = HelpdeskTheme.column(this, 22).apply { setBackgroundColor(HelpdeskTheme.canvas); isFocusableInTouchMode = true }
        root.addView(HelpdeskTheme.button(this, "‹  Kembali") { finish() })
        root.addView(HelpdeskTheme.text(this, "Profil kamu", 30f, bold = true), margins(24))
        root.addView(HelpdeskTheme.text(this, "Identitas yang sama di web dan aplikasi.", 13f, HelpdeskTheme.muted), margins(6))
        val identity = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(24), 0, dp(20)) }
        avatar = AvatarView(this).apply { bind(session.userName.orEmpty(), session.userAvatar) }
        identity.addView(avatar, LinearLayout.LayoutParams(dp(64), dp(64)))
        val description = HelpdeskTheme.column(this).apply { setPadding(dp(16), 0, 0, 0) }
        description.addView(HelpdeskTheme.text(this, session.userName.orEmpty(), 18f, bold = true))
        description.addView(HelpdeskTheme.text(this, roleLabel(session.userRole), 12f, HelpdeskTheme.muted))
        identity.addView(description); root.addView(identity)
        photoButton = HelpdeskTheme.button(this, "Ganti foto profil") { if (!busy) picker.launch("image/*") }
        root.addView(photoButton, margins(0))
        root.addView(HelpdeskTheme.button(this,"Hapus foto profil") {
            if(!busy && session.userAvatar!=null) lifecycleScope.launch {
                setBusy(true)
                try { session.token?.let { token -> ApiClient.updateAvatar(session.serverUrl,token,null).onSuccess {
                    session.userAvatar=null; avatar.bind(session.userName.orEmpty(),null); status.text="Foto profil dihapus."; setResult(RESULT_OK)
                }.onFailure { showError(it) } } } finally { setBusy(false) }
            }
        },margins(8))
        val form = HelpdeskTheme.column(this, 18).apply { background = HelpdeskTheme.shape(this@ProfileActivity) }
        name = field(form, "Nama lengkap", session.userName.orEmpty())
        email = field(form, "Email", session.userEmail.orEmpty(), InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        phone = field(form, "Nomor telepon", session.userPhone.orEmpty(), InputType.TYPE_CLASS_PHONE)
        form.addView(HelpdeskTheme.text(this, "Keamanan akun", 17f, bold = true), margins(22))
        form.addView(HelpdeskTheme.text(this, "Isi kata sandi saat ini hanya jika mengganti email atau kata sandi.", 12f, HelpdeskTheme.muted), margins(8))
        current = field(form, "Kata sandi saat ini", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        password = field(form, "Kata sandi baru (opsional)", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        confirmation = field(form, "Ulangi kata sandi baru", "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        root.addView(form, margins(20))
        status = HelpdeskTheme.text(this, "", 13f, HelpdeskTheme.muted).apply { accessibilityLiveRegion = android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE }
        root.addView(status, margins(16))
        save = HelpdeskTheme.button(this, "Simpan perubahan", true) { submit() }; root.addView(save, margins(16))
        root.addView(HelpdeskTheme.text(this, "Peran dan akses akun dikelola oleh administrator.", 11f, HelpdeskTheme.muted), margins(14))
        setContentView(ScrollView(this).apply { isFillViewport = true; addView(root) })
        state?.let { name.setText(it.getString("profile_name",session.userName)); email.setText(it.getString("profile_email",session.userEmail)); phone.setText(it.getString("profile_phone",session.userPhone)) }
        listOf(current,password,confirmation).forEach { it.isSaveEnabled=false }
        if (state == null && OfflineSyncManager.isOnline(this)) lifecycleScope.launch {
            session.token?.let { token -> ApiClient.getMe(session.serverUrl, token).onSuccess { user ->
                if (!busy && !name.hasFocus() && !email.hasFocus() && !phone.hasFocus()) {
                    session.saveUser(user, token); name.setText(user.name); email.setText(user.email); phone.setText(user.phone.orEmpty()); avatar.bind(user.name, user.avatarUrl)
                }
            } }
        }
    }
    private fun field(parent: LinearLayout, label: String, value: String, type: Int = InputType.TYPE_CLASS_TEXT): EditText {
        val title = HelpdeskTheme.text(this, label, 12f, HelpdeskTheme.muted).apply { id = android.view.View.generateViewId() }
        parent.addView(title, margins(16))
        return EditText(this).apply {
            id = android.view.View.generateViewId(); title.labelFor = id; setText(value); textSize = 14f; inputType = type; isSingleLine = true
            setTextColor(HelpdeskTheme.text); setHintTextColor(HelpdeskTheme.muted); background = HelpdeskTheme.shape(this@ProfileActivity, HelpdeskTheme.canvas, 16)
            setPadding(dp(14), 0, dp(14), 0)
            parent.addView(this, LinearLayout.LayoutParams(-1, dp(52)).apply { topMargin = dp(8) })
        }
    }
    private fun submit() {
        if (busy) return
        val nextPassword = password.text.toString()
        if (nextPassword != confirmation.text.toString()) { status.text = "Konfirmasi kata sandi belum cocok."; return }
        if (name.text.toString().trim().length < 2 || !android.util.Patterns.EMAIL_ADDRESS.matcher(email.text.toString().trim()).matches()) { status.text = "Periksa nama dan email kamu."; return }
        if (nextPassword.isNotEmpty() && nextPassword.length < 12) { status.text = "Kata sandi baru minimal 12 karakter."; return }
        val data = JSONObject().put("name", name.text.toString().trim()).put("email", email.text.toString().trim()).put("phone", phone.text.toString().trim())
        if (current.text.isNotEmpty()) data.put("currentPassword", current.text.toString())
        if (nextPassword.isNotEmpty()) data.put("newPassword", nextPassword)
        val token = session.token ?: return
        setBusy(true); status.text = "Menyimpan perubahan..."
        lifecycleScope.launch {
            ApiClient.updateProfile(session.serverUrl, token, data).onSuccess { (user, refreshedToken) ->
                session.saveUser(user, refreshedToken); avatar.bind(user.name, user.avatarUrl); current.text.clear(); password.text.clear(); confirmation.text.clear()
                status.text = "Profil berhasil diperbarui."; setResult(RESULT_OK)
            }.onFailure { showError(it) }
            setBusy(false)
        }
    }
    private fun showError(error: Throwable) {
        status.text = error.message ?: "Profil belum dapat disimpan. Periksa koneksi."
        if (error is ApiException && error.statusCode == 401) { session.logout(); startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)); finish() }
    }
    override fun onSaveInstanceState(out:Bundle) {
        out.putString("profile_name",name.text.toString()); out.putString("profile_email",email.text.toString()); out.putString("profile_phone",phone.text.toString())
        super.onSaveInstanceState(out)
    }
    private fun setBusy(value: Boolean) { busy = value; save.isEnabled = !value; photoButton.isEnabled = !value }
    private fun dp(v: Int) = HelpdeskTheme.dp(this, v)
    private fun margins(top: Int) = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top) }
    companion object { fun roleLabel(role: String?) = when(role) { "agent" -> "Teknisi"; "noc" -> "NOC"; "owner" -> "Owner"; "admin" -> "Admin"; else -> "Pengguna" } }
}
