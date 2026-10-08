package net.infinityteknik.helpdesk.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
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

    suspend fun getTicketMessages(serverUrl: String, token: String, ticketId: String): Result<List<TicketMessage>> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/tickets/$ticketId/messages")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (!response.isSuccessful) {
                        return@withContext Result.failure(Exception("HTTP ${response.code}"))
                    }

                    val arr = JSONArray(bodyStr)
                    val list = ArrayList<TicketMessage>()
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val author = o.optJSONObject("author")
                        list.add(
                            TicketMessage(
                                id = o.getString("id"),
                                ticketId = o.getString("ticketId"),
                                authorId = o.getString("authorId"),
                                content = o.getString("content"),
                                type = o.optString("type", "public"),
                                createdAt = o.optString("createdAt", ""),
                                authorName = author?.optNullableString("name"),
                                authorRole = author?.optNullableString("role")
                            )
                        )
                    }
                    Result.success(list)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun sendTicketMessage(
        serverUrl: String,
        token: String,
        ticketId: String,
        content: String,
        type: String = "public"
    ): Result<TicketMessage> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("content", content.trim())
                    put("type", type)
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/tickets/$ticketId/messages")
                    .addHeader("Authorization", "Bearer $token")
                    .post(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (!response.isSuccessful) {
                        val errMsg = try { JSONObject(bodyStr).optString("error", bodyStr) } catch (e: Exception) { bodyStr }
                        return@withContext Result.failure(Exception(errMsg))
                    }

                    val o = JSONObject(bodyStr)
                    val author = o.optJSONObject("author")
                    val msg = TicketMessage(
                        id = o.getString("id"),
                        ticketId = o.getString("ticketId"),
                        authorId = o.getString("authorId"),
                        content = o.getString("content"),
                        type = o.optString("type", "public"),
                        createdAt = o.optString("createdAt", ""),
                        authorName = author?.optNullableString("name"),
                        authorRole = author?.optNullableString("role")
                    )
                    Result.success(msg)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun submitWorkReport(
        serverUrl: String,
        token: String,
        ticketId: String,
        summary: String,
        actionTaken: String,
        materialsUsed: String,
        finalResult: String,
        beforePhotos: List<File>,
        afterPhotos: List<File>
    ): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
                builder.addFormDataPart("summary", summary.trim())
                builder.addFormDataPart("actionTaken", actionTaken.trim())
                if (materialsUsed.isNotBlank()) builder.addFormDataPart("materialsUsed", materialsUsed.trim())
                if (finalResult.isNotBlank()) builder.addFormDataPart("finalResult", finalResult.trim())

                val mediaType = "image/jpeg".toMediaType()

                beforePhotos.forEachIndexed { i, file ->
                    if (file.exists() && file.length() > 0) {
                        builder.addFormDataPart("beforePhoto_$i", file.name, file.asRequestBody(mediaType))
                    }
                }

                afterPhotos.forEachIndexed { i, file ->
                    if (file.exists() && file.length() > 0) {
                        builder.addFormDataPart("afterPhoto_$i", file.name, file.asRequestBody(mediaType))
                    }
                }

                val request = Request.Builder()
                    .url("$serverUrl/api/tickets/$ticketId/work-report")
                    .addHeader("Authorization", "Bearer $token")
                    .post(builder.build())
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        Result.success(true)
                    } else {
                        val errMsg = try { JSONObject(bodyStr).optString("error", bodyStr) } catch (e: Exception) { bodyStr }
                        Result.failure(Exception(errMsg))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
