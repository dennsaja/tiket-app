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

data class LocationPayload(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float?,
    val speed: Float?,
    val heading: Float?,
    val battery: Int?
)
