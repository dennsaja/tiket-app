package net.infinityteknik.helpdesk.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    private fun JSONObject.optNullableString(key: String): String? {
        if (!has(key) || isNull(key)) return null
        val v = optString(key)
        return if (v.isEmpty() || v == "null") null else v
    }

    suspend fun login(serverUrl: String, email: String, pass: String): Result<LoginResponse> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("email", email.trim())
                    put("password", pass)
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/mobile/auth/login")
                    .post(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val resJson = JSONObject(bodyStr)

                    if (response.isSuccessful && resJson.optBoolean("success", false)) {
                        val token = resJson.getString("token")
                        val uObj = resJson.getJSONObject("user")
                        val user = UserProfile(
                            id = uObj.getString("id"),
                            name = uObj.getString("name"),
                            email = uObj.getString("email"),
                            role = uObj.getString("role"),
                            phone = uObj.optNullableString("phone"),
                            avatarUrl = uObj.optNullableString("avatarUrl")
                        )
                        Result.success(LoginResponse(true, token, user, null))
                    } else {
                        val errMsg = resJson.optString("error", "Login gagal (${response.code})")
                        Result.failure(Exception(errMsg))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getMe(serverUrl: String, token: String): Result<UserProfile> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/mobile/auth/me")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val resJson = JSONObject(bodyStr)

                    if (response.isSuccessful && resJson.optBoolean("success", false)) {
                        val uObj = resJson.getJSONObject("user")
                        val user = UserProfile(
                            id = uObj.getString("id"),
                            name = uObj.getString("name"),
                            email = uObj.getString("email"),
                            role = uObj.getString("role"),
                            phone = uObj.optNullableString("phone"),
                            avatarUrl = uObj.optNullableString("avatarUrl"),
                            activeTicketsCount = uObj.optInt("activeTicketsCount", 0)
                        )
                        Result.success(user)
                    } else {
                        Result.failure(Exception(resJson.optString("error", "Gagal memuat profil")))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun sendLocation(serverUrl: String, token: String, loc: LocationPayload): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("latitude", loc.latitude)
                    put("longitude", loc.longitude)
                    if (loc.accuracy != null) put("accuracy", loc.accuracy.toDouble())
                    if (loc.speed != null) put("speed", loc.speed.toDouble())
                    if (loc.heading != null) put("heading", loc.heading.toDouble())
                    if (loc.battery != null) put("battery", loc.battery)
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/technicians/location")
                    .addHeader("Authorization", "Bearer $token")
                    .post(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        Result.success(true)
                    } else {
                        Result.failure(Exception("HTTP ${response.code}"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun stopLocation(serverUrl: String, token: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/technicians/location")
                    .addHeader("Authorization", "Bearer $token")
                    .delete()
                    .build()

                client.newCall(request).execute().use { response ->
                    Result.success(response.isSuccessful)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getTickets(serverUrl: String, token: String): Result<List<TicketItem>> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/mobile/tickets")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val resJson = JSONObject(bodyStr)

                    if (response.isSuccessful && resJson.optBoolean("success", false)) {
                        val arr: JSONArray = resJson.getJSONArray("tickets")
                        val list = ArrayList<TicketItem>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            list.add(
                                TicketItem(
                                    id = o.getString("id"),
                                    ticketNumber = o.getInt("ticketNumber"),
                                    title = o.getString("title"),
                                    description = o.optNullableString("description"),
                                    status = o.getString("status"),
                                    priority = o.getString("priority"),
                                    ticketType = o.optNullableString("ticketType"),
                                    reporterName = o.optNullableString("reporterName"),
                                    reporterPhone = o.optNullableString("reporterPhone"),
                                    reporterAddress = o.optNullableString("reporterAddress"),
                                    reporterMapUrl = o.optNullableString("reporterMapUrl"),
                                    latitude = if (o.isNull("latitude")) null else o.optDouble("latitude"),
                                    longitude = if (o.isNull("longitude")) null else o.optDouble("longitude"),
                                    isLead = o.optBoolean("isLead", false),
                                    createdAt = o.getString("createdAt"),
                                    updatedAt = o.getString("updatedAt")
                                )
                            )
                        }
                        Result.success(list)
                    } else {
                        Result.failure(Exception(resJson.optString("error", "Gagal mengambil daftar tiket")))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun updateTicketStatus(
        serverUrl: String,
        token: String,
        ticketId: String,
        status: String,
        notes: String?,
        summary: String?
    ): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("status", status)
                    if (!notes.isNullOrBlank()) put("notes", notes)
                    if (!summary.isNullOrBlank()) put("resolutionSummary", summary)
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/mobile/tickets/$ticketId")
                    .addHeader("Authorization", "Bearer $token")
                    .patch(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        Result.success(true)
                    } else {
                        val err = response.body?.string() ?: ""
                        Result.failure(Exception("Gagal update status: $err"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
