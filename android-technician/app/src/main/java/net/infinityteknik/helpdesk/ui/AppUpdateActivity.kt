package net.infinityteknik.helpdesk.ui

import android.app.PendingIntent
import android.content.*
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.*
import net.infinityteknik.helpdesk.data.SessionManager
import okhttp3.*
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Download progress is measured in bytes. Verification and Android installation have separate states. */
class AppUpdateActivity : AppCompatActivity() {
    private lateinit var session: SessionManager
    private lateinit var release: JSONObject
    private lateinit var text: TextView
    private lateinit var progress: ProgressBar
    private var job: Job? = null
    private var call: Call? = null
    private var file: File? = null
    private var committed = false
    private val installPermission = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (Build.VERSION.SDK_INT < 26 || packageManager.canRequestPackageInstalls()) download()
        else fail("Izin memasang pembaruan belum diberikan. Aktifkan izin di pengaturan Android lalu coba lagi.")
    }
    private var dialog: AlertDialog? = null
    private val prefs by lazy { getSharedPreferences("apk_installer", MODE_PRIVATE) }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        session = SessionManager(this)
        release = runCatching { JSONObject(intent.getStringExtra("release") ?: "") }.getOrNull() ?: run { finish(); return }
        if (!session.isLoggedIn) { finish(); return }
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 24, 32, 16) }
        text = TextView(this).apply { textSize = 14f; setPadding(0, 0, 0, 20) }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100 }
        column.addView(text); column.addView(progress)
        dialog = AlertDialog.Builder(this).setTitle("Update HelpDesk " + release.optString("versionName"))
            .setView(column).setCancelable(false).setNegativeButton("Tutup") { _, _ -> finish() }.create().also { it.show() }
        prepare()
    }

    private fun prepare() {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            text.text = "Izinkan HelpDesk memasang pembaruan di pengaturan Android, lalu kembali ke aplikasi."
            try { installPermission.launch(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))) }
            catch (_: Exception) { fail("Pengaturan izin pemasangan tidak tersedia di perangkat ini.") }
            return
        }
        download()
    }
    override fun onResume() {
        super.onResume()
        if (committed) {
            val result = prefs.getString("result", "") ?: ""
            if (result.startsWith("failed:")) fail(result.removePrefix("failed:"))
            else if (result == "success") { progress.isIndeterminate = false; progress.progress = 100; text.text = "Android melaporkan pembaruan berhasil dipasang." }
        }
    }

    private fun status(phase: String, message: String = "") {
        lifecycleScope.launch { UpdateReporter.send(this@AppUpdateActivity, release, phase, message) }
    }
    private fun fail(message: String) {
        progress.isIndeterminate = false
        text.text = "Pembaruan gagal.\n\n$message\n\nVersi lama dan data akun tetap tersimpan."
        status("failed", message.take(300))
        AlertDialog.Builder(this).setTitle("Pembaruan gagal").setMessage(message).setPositiveButton("Mengerti", null).show()
    }
    private fun download() {
        if (job?.isActive == true || committed) return
        job = lifecycleScope.launch {
            try {
                val expected = release.getLong("fileSizeBytes")
                val hash = release.getString("sha256")
                require(expected in 1..200_000_000 && hash.matches(Regex("[a-f0-9]{64}"))) { "Metadata pembaruan tidak valid. Publikasikan ulang APK melalui console." }
                val base = Uri.parse(session.serverUrl)
                val target = Uri.parse(session.serverUrl + release.getString("downloadPath"))
                require(target.scheme == "https" && target.host == base.host && target.port == base.port && target.path?.startsWith("/api/mobile/releases/") == true) { "Alamat pembaruan tidak valid." }
                val output = File(cacheDir, "helpdesk-update.apk.part"); file = output
                status("downloading")
                text.text = "Menghubungi server…"; progress.isIndeterminate = true
                withContext(Dispatchers.IO) {
                    val client = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).callTimeout(10, TimeUnit.MINUTES).followRedirects(false).followSslRedirects(false).build()
                    call = client.newCall(Request.Builder().url(target.toString()).header("Authorization", "Bearer " + session.token).build())
                    call!!.execute().use { response ->
                        check(response.isSuccessful) { "Server menolak unduhan (HTTP ${response.code}). Periksa koneksi atau masuk kembali." }
                        val body = response.body ?: error("Berkas APK kosong")
                        check(body.contentLength() == expected) { "Ukuran APK dari server berubah. Minta pengelola memublikasikan ulang." }
                        val digest = MessageDigest.getInstance("SHA-256")
                        body.byteStream().use { input -> output.outputStream().use { destination ->
                            val buffer = ByteArray(32768); var total = 0L; var displayed = -1
                            while (true) {
                                ensureActive(); val read = input.read(buffer); if (read < 0) break
                                total += read; check(total <= expected) { "Berkas APK melebihi ukuran rilis." }
                                destination.write(buffer, 0, read); digest.update(buffer, 0, read)
                                val percent = (total * 100 / expected).toInt()
                                if (percent != displayed) { displayed = percent; withContext(Dispatchers.Main) { progress.isIndeterminate = false; progress.progress = percent; text.text = "Mengunduh $percent%\n$total / $expected byte" } }
                            }
                            check(total == expected) { "Unduhan terputus sebelum seluruh APK diterima." }
                        } }
                        check(digest.digest().joinToString("") { "%02x".format(it) } == hash) { "Pemeriksaan integritas APK gagal. Berkas tidak akan dipasang." }
                    }
                    verify(output)
                }
                progress.isIndeterminate = true; text.text = "APK terverifikasi. Menyiapkan konfirmasi pemasangan Android…"
                status("verified")
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply { setAppPackageName(packageName); setSize(expected) }
                val installer = packageManager.packageInstaller
                val id = installer.createSession(params)
                try {
                    withContext(Dispatchers.IO) {
                        installer.openSession(id).use { install ->
                            install.openWrite("base.apk", 0, expected).use { dest -> output.inputStream().use { it.copyTo(dest) }; install.fsync(dest) }
                            prefs.edit().putString("release", release.toString()).putString("result", "pending").putInt("session", id).commit()
                            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                            val callback = PendingIntent.getBroadcast(this@AppUpdateActivity, id, Intent(this@AppUpdateActivity, UpdateInstallReceiver::class.java).setAction(packageName + ".INSTALL_RESULT"), flags)
                            install.commit(callback.intentSender)
                        }
                    }
                    committed = true; status("installing"); text.text = "Menunggu konfirmasi dan hasil pemasangan dari Android.\n\nSelesaikan dialog pemasangan yang muncul."
                    lifecycleScope.launch {
                        while (isActive) {
                            delay(1000)
                            val result = prefs.getString("result", "").orEmpty()
                            if (result.startsWith("failed:")) { fail(result.removePrefix("failed:")); break }
                            if (result == "success") { progress.isIndeterminate = false; progress.progress = 100; text.text = "Android melaporkan pembaruan berhasil dipasang."; break }
                        }
                    }
                } catch (e: Exception) { installer.abandonSession(id); throw e }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { fail(error.message ?: "Pembaruan tidak dapat diselesaikan.") }
            finally { call = null; file?.delete() }
        }
    }
    @Suppress("DEPRECATION")
    private fun verify(apk: File) {
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = packageManager.getPackageArchiveInfo(apk.path, flags) ?: error("APK tidak dapat dibaca Android.")
        val current = packageManager.getPackageInfo(packageName, flags)
        val version = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        val installed = if (Build.VERSION.SDK_INT >= 28) current.longVersionCode else current.versionCode.toLong()
        check(archive.packageName == packageName && version == release.getLong("versionCode") && version > installed) { "APK tidak sesuai aplikasi ini atau versinya tidak lebih baru." }
        fun certificates(info: android.content.pm.PackageInfo) = (if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures)?.map { it.toCharsString() }?.toSet()
        check(!certificates(current).isNullOrEmpty() && certificates(current) == certificates(archive)) { "Sertifikat APK berbeda dari aplikasi terpasang. Hubungi pengelola; jangan hapus aplikasi jika ada laporan offline." }
    }
    override fun onDestroy() { call?.cancel(); dialog?.dismiss(); super.onDestroy() }
}

class UpdateInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("apk_installer", Context.MODE_PRIVATE)
        if (intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1) != prefs.getInt("session", -2)) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION") val confirmation = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            try { context.startActivity(confirmation!!.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            catch (_: Exception) { prefs.edit().putString("result", "failed:Dialog pemasangan Android tidak dapat dibuka.").commit() }
        } else {
            val message = when (status) {
                PackageInstaller.STATUS_SUCCESS -> "success"
                PackageInstaller.STATUS_FAILURE_CONFLICT -> "failed:Paket atau sertifikat bertentangan dengan aplikasi yang terpasang. Hubungi pengelola."
                PackageInstaller.STATUS_FAILURE_ABORTED -> "failed:Pemasangan dibatalkan melalui Android."
                PackageInstaller.STATUS_FAILURE_STORAGE -> "failed:Ruang penyimpanan perangkat tidak cukup."
                else -> "failed:" + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Android menolak pemasangan (kode $status).")
            }
            prefs.edit().putString("result", message).commit()
        }
    }
}
