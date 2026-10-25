package net.infinityteknik.helpdesk.ui

import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.infinityteknik.helpdesk.data.SessionManager
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object UpdateReporter {
    private val client = OkHttpClient.Builder().callTimeout(12, TimeUnit.SECONDS).build()
    suspend fun send(context: Context, release: JSONObject, phase: String, message: String = "") = withContext(Dispatchers.IO) {
        runCatching {
            val session = SessionManager(context)
            if (!session.isLoggedIn || !release.has("revision")) return@runCatching
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
            val body = JSONObject().put("revision", release.getString("revision")).put("versionCode", release.getLong("versionCode"))
                .put("installedVersionCode", code).put("phase", phase).put("message", message.take(300))
            client.newCall(Request.Builder().url(session.serverUrl + "/api/mobile/update-status").header("Authorization", "Bearer " + session.token)
                .post(body.toString().toRequestBody("application/json".toMediaType())).build()).execute().use { check(it.isSuccessful) }
        }.isSuccess
    }
}
