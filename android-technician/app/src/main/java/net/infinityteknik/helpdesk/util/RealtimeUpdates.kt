package net.infinityteknik.helpdesk.util

import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import net.infinityteknik.helpdesk.data.SessionManager
import okhttp3.*
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Foreground-only invalidations; existing REST endpoints remain the access boundary. */
object RealtimeUpdates {
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS).build()
    private fun events(session: SessionManager) = callbackFlow<Unit> {
        val token = session.token ?: run { close(); return@callbackFlow }
        val request = Request.Builder().url(session.serverUrl + "/api/mobile/events")
            .header("Authorization", "Bearer $token").header("Accept", "text/event-stream").build()
        val call = client.newCall(request)
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { close() }
            override fun onResponse(call: Call, response: Response) {
                try {
                    response.use {
                        if (!it.isSuccessful) return
                        val source = it.body?.source() ?: return
                        while (!call.isCanceled()) {
                            val line = source.readUtf8Line() ?: break
                            if (line == "data: refresh" && session.token == token) trySend(Unit)
                        }
                    }
                } catch (_: IOException) {} finally { close() }
            }
        })
        awaitClose { call.cancel() }
    }.buffer(Channel.CONFLATED)

    fun start(activity: AppCompatActivity, session: SessionManager, refresh: () -> Unit): Job = activity.lifecycleScope.launch {
        var last = 0L
        while (isActive && session.isLoggedIn) {
            events(session).collect {
                val now = android.os.SystemClock.elapsedRealtime()
                if (now - last > 600) { last = now; refresh() }
            }
            delay(3000)
        }
    }
}
