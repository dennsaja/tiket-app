package net.infinityteknik.helpdesk.data

data class LoginResponse(
    val success: Boolean,
    val token: String?,
    val user: UserProfile?,
    val error: String?
)

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val phone: String?,
    val avatarUrl: String?,
    val activeTicketsCount: Int = 0
)

data class TicketItem(
    val id: String,
    val ticketNumber: Int,
    val title: String,
    val description: String?,
    val status: String,
    val priority: String,
    val ticketType: String?,
    val reporterName: String?,
    val reporterPhone: String?,
    val reporterAddress: String?,
    val reporterMapUrl: String?,
    val latitude: Double?,
    val longitude: Double?,
    val isLead: Boolean,
    val createdAt: String,
    val updatedAt: String
)

data class TicketMessage(
    val id: String,
    val ticketId: String,
    val authorId: String,
    val content: String,
    val type: String, // "public" or "internal_note"
    val createdAt: String,
    val authorName: String?,
    val authorRole: String?
)

data class LocationPayload(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float?,
    val speed: Float?,
    val heading: Float?,
    val battery: Int?
)
