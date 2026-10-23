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

class ApiException(val statusCode: Int, message: String) : Exception(message)

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(25, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    suspend fun getMobileConfiguration(serverUrl: String, token: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url("$serverUrl/api/mobile/config")
                .header("Authorization", "Bearer $token").header("Cache-Control", "no-cache").build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw ApiException(response.code, "Pembaruan belum dapat dimuat")
                val body = response.body ?: error("Konfigurasi kosong")
                val source = body.source()
                // Bound both advertised and actual body size before parsing/caching.
                require(body.contentLength() <= 8192 && !source.request(8193)) { "Konfigurasi terlalu besar" }
                source.readUtf8()
            }
        }
    }

    private fun JSONObject.optNullableString(key: String): String? {
        if (!has(key) || isNull(key)) return null
        val v = optString(key)
        return if (v.isEmpty() || v == "null") null else v
    }

    suspend fun acknowledgeConfiguration(serverUrl: String, token: String, version: Long, appCode: Long, appVersion: String): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val body = JSONObject().put("version", version).put("appVersionCode", appCode).put("appVersion", appVersion)
            jsonResponse(Request.Builder().url("$serverUrl/api/mobile/config").header("Authorization", "Bearer $token")
                .post(body.toString().toRequestBody(JSON_MEDIA_TYPE)).build())
            true
        }
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
                        Result.failure(ApiException(response.code, errMsg))
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
                        Result.failure(ApiException(response.code, resJson.optString("error", "Gagal memuat profil")))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    fun parseChatRoom(o: JSONObject): ChatRoom {
        val last = o.optJSONObject("lastMessage")
        return ChatRoom(o.optString("ticketId", o.optString("id")), o.optInt("ticketNumber"), o.optString("title"),
            o.optString("status"), o.optJSONObject("department")?.optString("name") ?: "Tim HelpDesk",
            last?.optNullableString("content"), last?.optNullableString("authorName"), last?.optNullableString("id"),
            last?.optNullableString("authorId"), last?.optString("createdAt") ?: o.optString("updatedAt"))
    }
    fun parseTeamMessage(o: JSONObject, ticketId: String): TicketMessage {
        val author = o.optJSONObject("author")
        return TicketMessage(o.getString("id"), ticketId, o.optString("authorId", author?.optString("id").orEmpty()),
            o.getString("content"), "internal_note", o.optString("createdAt"), author?.optNullableString("name"),
            author?.optNullableString("role"), author?.optNullableString("avatarUrl"))
    }
    private fun jsonResponse(request: Request): String = client.newCall(request).execute().use { response ->
        val body = response.body?.string().orEmpty()
        if (!response.isSuccessful) throw ApiException(response.code, try { JSONObject(body).optString("error", "Permintaan gagal") } catch (_: Exception) { "Server belum dapat dihubungi (" + response.code + ")" })
        body
    }
    suspend fun getChatRooms(serverUrl: String, token: String): Result<List<ChatRoom>> = withContext(Dispatchers.IO) {
        runCatching {
            val list = mutableListOf<ChatRoom>()
            var page = 1
            do {
                val arr = JSONArray(jsonResponse(Request.Builder().url(serverUrl + "/api/chat/rooms?page=" + page + "&perPage=100").header("Authorization", "Bearer " + token).build()))
                for (i in 0 until arr.length()) list.add(parseChatRoom(arr.getJSONObject(i)))
                page++
            } while (arr.length() == 100 && page <= 100)
            list.distinctBy { it.ticketId }
        }
    }
    suspend fun getTeamThread(serverUrl: String, token: String, ticketId: String): Result<TeamThread> = withContext(Dispatchers.IO) {
        runCatching {
            val json = JSONObject(jsonResponse(Request.Builder().url(serverUrl + "/api/chat/rooms/" + ticketId).header("Authorization", "Bearer " + token).build()))
            val arr = json.getJSONArray("messages")
            TeamThread(parseChatRoom(json.getJSONObject("ticket")), (0 until arr.length()).map { parseTeamMessage(arr.getJSONObject(it), ticketId) })
        }
    }
    suspend fun sendTeamMessage(serverUrl: String, token: String, ticketId: String, content: String): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            jsonResponse(Request.Builder().url(serverUrl + "/api/chat/rooms/" + ticketId).header("Authorization", "Bearer " + token)
                .post(JSONObject().put("content", content.trim()).toString().toRequestBody(JSON_MEDIA_TYPE)).build())
            true
        }
    }
    suspend fun updateProfile(serverUrl: String, token: String, data: JSONObject): Result<Pair<UserProfile, String>> = withContext(Dispatchers.IO) {
        runCatching {
            val response = JSONObject(jsonResponse(Request.Builder().url(serverUrl + "/api/mobile/profile").header("Authorization", "Bearer " + token)
                .patch(data.toString().toRequestBody(JSON_MEDIA_TYPE)).build()))
            val user = response.getJSONObject("user")
            UserProfile(user.getString("id"), user.getString("name"), user.getString("email"), user.getString("role"),
                user.optNullableString("phone"), user.optNullableString("avatarUrl")) to response.getString("token")
        }
    }
    suspend fun updateAvatar(serverUrl: String, token: String, jpeg: File?): Result<String?> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url(serverUrl + "/api/users/avatar").header("Authorization", "Bearer " + token)
            if (jpeg == null) request.delete() else request.post(MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("file", "profile.jpg", jpeg.asRequestBody("image/jpeg".toMediaType())).build())
            val response = JSONObject(jsonResponse(request.build()))
            response.optNullableString("avatarUrl")
        }
    }

    suspend fun getTicketDetail(serverUrl: String, token: String, ticketId: String): Result<TicketItem> = withContext(Dispatchers.IO) {
        runCatching { parseTicketObject(JSONObject(jsonResponse(Request.Builder().url(serverUrl + "/api/mobile/tickets/" + ticketId)
            .header("Authorization", "Bearer " + token).build())).getJSONObject("ticket")) }
    }
    suspend fun getReportImage(serverUrl: String, token: String, path: String): Result<android.graphics.Bitmap> = withContext(Dispatchers.IO) {
        runCatching {
            val base = java.net.URI(serverUrl); val resolved = base.resolve(path)
            require(resolved.scheme == "https" && resolved.host == base.host) { "Alamat foto tidak valid" }
            client.newCall(Request.Builder().url(resolved.toString()).header("Authorization", "Bearer " + token).build()).execute().use { response ->
                if(!response.isSuccessful) throw ApiException(response.code,"Foto belum dapat dimuat")
                val body = response.body ?: throw java.io.IOException("Foto kosong")
                val output = java.io.ByteArrayOutputStream()
                body.byteStream().use { stream ->
                    val buffer = ByteArray(8192)
                    while(true) { val count = stream.read(buffer); if(count < 0) break
                        if(output.size() + count > 15 * 1024 * 1024) throw java.io.IOException("Foto terlalu besar")
                        output.write(buffer,0,count)
                    }
                }
                val bytes = output.toByteArray()
                val options = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size,options)
                require(options.outWidth > 0 && options.outHeight > 0) { "Format foto tidak didukung" }
                var sample=1; while(options.outWidth/sample > 1600 || options.outHeight/sample > 1600) sample*=2
                android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size,android.graphics.BitmapFactory.Options().apply { inSampleSize=sample }) ?: throw java.io.IOException("Foto tidak dapat dibaca")
            }
        }
    }

    suspend fun downloadAttachment(context: android.content.Context, serverUrl: String, token: String, attachment: TicketAttachment): Result<File> = withContext(Dispatchers.IO) {
        runCatching {
            val target = File(context.cacheDir,"attachments").apply { mkdirs() }
            val safeName = attachment.name.replace(Regex("[^a-zA-Z0-9._ -]"),"_").take(150).ifBlank { "lampiran" }
            val file = File(target, java.util.UUID.randomUUID().toString()+"-"+safeName)
            try {
                client.newCall(Request.Builder().url(serverUrl+"/api/attachments/"+attachment.id).header("Authorization","Bearer "+token).build()).execute().use { response ->
                    if(!response.isSuccessful) throw ApiException(response.code,"Lampiran belum dapat diunduh")
                    val body=response.body ?: throw java.io.IOException("Lampiran kosong")
                    require(body.contentLength() <= 15L*1024*1024) { "Lampiran terlalu besar" }
                    body.byteStream().use { input -> file.outputStream().use { output ->
                        var size=0L; val buffer=ByteArray(8192)
                        while(true) { val count=input.read(buffer); if(count<0) break
                            size+=count; require(size<=15L*1024*1024) { "Lampiran terlalu besar" }; output.write(buffer,0,count)
                        }
                    } }
                }
                file
            } catch(error:Exception) { file.delete(); throw error }
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
                    if (loc.battery != null && loc.battery in 0..100) put("battery", loc.battery)
                    if (!loc.activeTicketId.isNullOrBlank()) put("activeTicketId", loc.activeTicketId)
                    put("deviceTime", loc.deviceTime)
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

    suspend fun sendLocationBatch(serverUrl: String, token: String, batch: List<LocationPayload>): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                if (batch.isEmpty()) return@withContext Result.success(true)
                val arr = JSONArray()
                for (loc in batch) {
                    arr.put(JSONObject().apply {
                        put("latitude", loc.latitude)
                        put("longitude", loc.longitude)
                        if (loc.accuracy != null) put("accuracy", loc.accuracy.toDouble())
                        if (loc.speed != null) put("speed", loc.speed.toDouble())
                        if (loc.heading != null) put("heading", loc.heading.toDouble())
                        if (loc.battery != null && loc.battery in 0..100) put("battery", loc.battery)
                        if (!loc.activeTicketId.isNullOrBlank()) put("activeTicketId", loc.activeTicketId)
                        put("deviceTime", loc.deviceTime)
                    })
                }
                val latest = batch.last()
                val json = JSONObject().apply {
                    put("latitude", latest.latitude)
                    put("longitude", latest.longitude)
                    put("batch", arr)
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

    fun parseTicketObject(o: JSONObject): TicketItem {
        val shArr = o.optJSONArray("statusHistory") ?: JSONArray()
        val historyList = ArrayList<TicketStatusHistoryItem>()
        for (j in 0 until shArr.length()) {
            val h = shArr.getJSONObject(j)
            historyList.add(
                TicketStatusHistoryItem(
                    id = h.optString("id", "sh_$j"),
                    fromStatus = h.optNullableString("fromStatus"),
                    toStatus = h.optString("toStatus", "assigned"),
                    reason = h.optNullableString("reason"),
                    createdAt = h.optString("createdAt", "")
                )
            )
        }

        val repObj = o.optJSONObject("latestReport")
        val latestReport = if (repObj != null) {
            val bpArr = repObj.optJSONArray("beforePhotos") ?: JSONArray()
            val apArr = repObj.optJSONArray("afterPhotos") ?: JSONArray()
            val bp = (0 until bpArr.length()).mapNotNull { bpArr.optString(it).takeIf { s -> s.isNotBlank() } }
            val ap = (0 until apArr.length()).mapNotNull { apArr.optString(it).takeIf { s -> s.isNotBlank() } }
            WorkReportSnapshot(
                id = repObj.optString("id", ""),
                summary = repObj.optString("summary", ""),
                actionTaken = repObj.optString("actionTaken", ""),
                materialsUsed = repObj.optNullableString("materialsUsed"),
                finalResult = repObj.optNullableString("finalResult"),
                beforePhotos = bp,
                afterPhotos = ap,
                createdAt = repObj.optString("createdAt", "")
            )
        } else null

        val specObj = o.optJSONObject("specData")
        val specStr = specObj?.toString() ?: o.optNullableString("specDataJson")

        return TicketItem(
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
            latitude = if (o.isNull("latitude") || !o.has("latitude")) null else o.optDouble("latitude"),
            longitude = if (o.isNull("longitude") || !o.has("longitude")) null else o.optDouble("longitude"),
            isLead = o.optBoolean("isLead", false),
            createdAt = o.optString("createdAt", ""),
            updatedAt = o.optString("updatedAt", ""),
            slaFirstResponseDue = o.optNullableString("slaFirstResponseDue"),
            slaResolutionDue = o.optNullableString("slaResolutionDue"),
            resolution = o.optNullableString("resolution"),
            resolvedAt = o.optNullableString("resolvedAt"),
            specDataJson = specStr,
            statusHistory = historyList,
            latestReport = latestReport,
            categoryName = o.optJSONObject("category")?.optNullableString("name") ?: o.optNullableString("categoryName"),
            subcategoryName = o.optJSONObject("subcategory")?.optNullableString("name") ?: o.optNullableString("subcategoryName"),
            departmentName = o.optJSONObject("department")?.optNullableString("name") ?: o.optNullableString("departmentName"),
            requesterName = o.optJSONObject("requester")?.optNullableString("name") ?: o.optNullableString("requesterName"),
            attachments = o.optJSONArray("attachments")?.let { files -> (0 until files.length()).mapNotNull { index ->
                val file = files.optJSONObject(index) ?: return@mapNotNull null
                val id = file.optNullableString("id") ?: return@mapNotNull null
                TicketAttachment(id, file.optNullableString("originalName") ?: file.optString("name", "Lampiran"), file.optString("mimeType", "application/octet-stream"), file.optLong("size"))
            } } ?: emptyList()
        )
    }

    fun ticketToJsonObject(t: TicketItem): JSONObject {
        return JSONObject().apply {
            put("id", t.id)
            put("ticketNumber", t.ticketNumber)
            put("title", t.title)
            put("description", t.description ?: JSONObject.NULL)
            put("status", t.status)
            put("priority", t.priority)
            put("ticketType", t.ticketType ?: JSONObject.NULL)
            put("reporterName", t.reporterName ?: JSONObject.NULL)
            put("reporterPhone", t.reporterPhone ?: JSONObject.NULL)
            put("reporterAddress", t.reporterAddress ?: JSONObject.NULL)
            put("reporterMapUrl", t.reporterMapUrl ?: JSONObject.NULL)
            put("latitude", t.latitude ?: JSONObject.NULL)
            put("longitude", t.longitude ?: JSONObject.NULL)
            put("isLead", t.isLead)
            put("createdAt", t.createdAt)
            put("updatedAt", t.updatedAt)
            put("slaFirstResponseDue", t.slaFirstResponseDue ?: JSONObject.NULL)
            put("slaResolutionDue", t.slaResolutionDue ?: JSONObject.NULL)
            put("resolution", t.resolution ?: JSONObject.NULL)
            put("resolvedAt", t.resolvedAt ?: JSONObject.NULL)
            put("specDataJson", t.specDataJson ?: JSONObject.NULL)
            put("categoryName", t.categoryName ?: JSONObject.NULL); put("subcategoryName", t.subcategoryName ?: JSONObject.NULL)
            put("departmentName", t.departmentName ?: JSONObject.NULL); put("requesterName", t.requesterName ?: JSONObject.NULL)
            put("attachments", JSONArray(t.attachments.map { file -> JSONObject().put("id", file.id).put("originalName", file.name).put("mimeType", file.mimeType).put("size", file.size) }))

            val shArr = JSONArray()
            for (sh in t.statusHistory) {
                shArr.put(JSONObject().apply {
                    put("id", sh.id)
                    put("fromStatus", sh.fromStatus ?: JSONObject.NULL)
                    put("toStatus", sh.toStatus)
                    put("reason", sh.reason ?: JSONObject.NULL)
                    put("createdAt", sh.createdAt)
                })
            }
            put("statusHistory", shArr)

            val rep = t.latestReport
            if (rep != null) {
                put("latestReport", JSONObject().apply {
                    put("id", rep.id)
                    put("summary", rep.summary)
                    put("actionTaken", rep.actionTaken)
                    put("materialsUsed", rep.materialsUsed ?: JSONObject.NULL)
                    put("finalResult", rep.finalResult ?: JSONObject.NULL)
                    put("beforePhotos", JSONArray(rep.beforePhotos))
                    put("afterPhotos", JSONArray(rep.afterPhotos))
                    put("createdAt", rep.createdAt)
                })
            }
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
                            list.add(parseTicketObject(o))
                        }
                        Result.success(list)
                    } else {
                        Result.failure(ApiException(response.code, resJson.optString("error", "Gagal mengambil daftar tiket")))
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
        status: String?,
        notes: String?,
        summary: String?,
        latitude: Double? = null,
        longitude: Double? = null,
        distanceMeters: Double? = null,
        updateCustomerCoordinates: Boolean = false,
        odpCoordinateType: String? = null
    ): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    if (!status.isNullOrBlank()) put("status", status)
                    if (!notes.isNullOrBlank()) put("notes", notes)
                    if (!summary.isNullOrBlank()) put("resolutionSummary", summary)
                    if (latitude != null && latitude != 0.0) put("latitude", latitude)
                    if (longitude != null && longitude != 0.0) put("longitude", longitude)
                    if (distanceMeters != null) put("distanceMeters", distanceMeters)
                    if (updateCustomerCoordinates) put("updateCustomerCoordinates", true)
                    if (!odpCoordinateType.isNullOrBlank()) put("odpCoordinateType", odpCoordinateType)
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
                        return@withContext Result.failure(ApiException(response.code, errMsg))
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
        afterPhotos: List<File>,
        technicalDataJson: String? = null,
        idempotencyKey: String = java.util.UUID.randomUUID().toString()
    ): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
                builder.addFormDataPart("summary", summary.trim())
                builder.addFormDataPart("actionTaken", actionTaken.trim())
                if (materialsUsed.isNotBlank()) builder.addFormDataPart("materialsUsed", materialsUsed.trim())
                if (finalResult.isNotBlank()) builder.addFormDataPart("finalResult", finalResult.trim())
                if (!technicalDataJson.isNullOrBlank()) builder.addFormDataPart("technicalDataJson", technicalDataJson)

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
                    .header("Idempotency-Key", idempotencyKey)
                    .addHeader("Authorization", "Bearer $token")
                    .post(builder.build())
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        Result.success(true)
                    } else {
                        val errMsg = try { JSONObject(bodyStr).optString("error", bodyStr) } catch (e: Exception) { bodyStr }
                        Result.failure(ApiException(response.code, errMsg))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun getNotifications(serverUrl: String, token: String): Result<NotificationsPayload> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/notifications?perPage=25")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    if (!response.isSuccessful) {
                        return@withContext Result.failure(Exception("HTTP ${response.code}"))
                    }

                    val resJson = JSONObject(bodyStr)
                    val unreadCount = resJson.optInt("unreadCount", 0)
                    val arr = resJson.optJSONArray("notifications") ?: JSONArray()
                    val list = ArrayList<NotificationItem>()

                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        val tObj = o.optJSONObject("ticket")
                        val dObj = o.optJSONObject("data")

                        val tNum = tObj?.optInt("ticketNumber", 0)
                            ?: dObj?.optInt("ticketNumber", 0) ?: 0
                        val tTitle = tObj?.optNullableString("title")
                            ?: dObj?.optNullableString("ticketTitle") ?: ""

                        list.add(
                            NotificationItem(
                                id = o.getString("id"),
                                type = o.optString("type", "ticket_updated"),
                                title = o.optString("title", "Notifikasi HelpDesk"),
                                message = o.optString("message", ""),
                                ticketId = o.optNullableString("ticketId"),
                                ticketNumber = tNum,
                                ticketTitle = tTitle,
                                ticketStatus = tObj?.optString("status", "assigned") ?: "assigned",
                                ticketPriority = tObj?.optString("priority", dObj?.optString("priority", "medium") ?: "medium") ?: "medium",
                                ticketType = tObj?.optNullableString("ticketType") ?: dObj?.optNullableString("ticketType"),
                                reporterName = tObj?.optNullableString("reporterName") ?: dObj?.optNullableString("reporterName"),
                                reporterPhone = tObj?.optNullableString("reporterPhone") ?: dObj?.optNullableString("reporterPhone"),
                                reporterAddress = tObj?.optNullableString("reporterAddress") ?: dObj?.optNullableString("reporterAddress"),
                                reporterMapUrl = tObj?.optNullableString("reporterMapUrl"),
                                ticketDescription = tObj?.optNullableString("description"),
                                isRead = o.optBoolean("isRead", false),
                                createdAt = o.optString("createdAt", "")
                            )
                        )
                    }

                    Result.success(NotificationsPayload(list, unreadCount))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun markNotificationRead(serverUrl: String, token: String, notificationId: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().put("isRead", true)
                val request = Request.Builder()
                    .url("$serverUrl/api/notifications/$notificationId")
                    .addHeader("Authorization", "Bearer $token")
                    .patch(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    Result.success(response.isSuccessful)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun markAllNotificationsRead(serverUrl: String, token: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().put("action", "mark_all_read")
                val request = Request.Builder()
                    .url("$serverUrl/api/notifications")
                    .addHeader("Authorization", "Bearer $token")
                    .post(json.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                client.newCall(request).execute().use { response ->
                    Result.success(response.isSuccessful)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
