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

data class TicketStatusHistoryItem(
    val id: String,
    val fromStatus: String?,
    val toStatus: String,
    val reason: String?,
    val createdAt: String
)

data class WorkReportSnapshot(
    val id: String,
    val summary: String,
    val actionTaken: String,
    val materialsUsed: String?,
    val finalResult: String?,
    val beforePhotos: List<String>,
    val afterPhotos: List<String>,
    val createdAt: String
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
    val updatedAt: String,
    val slaFirstResponseDue: String? = null,
    val slaResolutionDue: String? = null,
    val resolution: String? = null,
    val resolvedAt: String? = null,
    val specDataJson: String? = null,
    val statusHistory: List<TicketStatusHistoryItem> = emptyList(),
    val latestReport: WorkReportSnapshot? = null
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
    val battery: Int?,
    val activeTicketId: String? = null,
    val deviceTime: Long = System.currentTimeMillis()
)

data class OfflineActionItem(
    val id: String,
    val actionType: String, // "status_update", "coord_update", "work_report"
    val ticketId: String,
    val ticketNumber: Int,
    val status: String?,
    val notes: String?,
    val latitude: Double?,
    val longitude: Double?,
    val distanceMeters: Double?,
    val odpCoordinateType: String? = null,
    val reportSummary: String? = null,
    val reportActionTaken: String? = null,
    val reportMaterials: String? = null,
    val reportFinalResult: String? = null,
    val reportTechnicalJson: String? = null,
    val beforePhotoPaths: List<String> = emptyList(),
    val afterPhotoPaths: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis()
)

data class ReportDraftData(
    val ticketId: String,
    val summary: String = "",
    val actionTaken: String = "",
    val materialsUsed: String = "",
    val finalResult: String = "",
    val ontSerial: String = "",
    val routerType: String = "",
    val ssidName: String = "",
    val opticalPowerDbm: String = "",
    val odpNamePort: String = "",
    val cableLengthMeter: String = "",
    val pingSpeedResult: String = "",
    val rootCauseIndex: Int = 0,
    val customerRecipientName: String = "",
    val checkedIndices: Set<Int> = emptySet(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class NotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val ticketId: String?,
    val ticketNumber: Int,
    val ticketTitle: String,
    val ticketStatus: String,
    val ticketPriority: String,
    val ticketType: String?,
    val reporterName: String?,
    val reporterPhone: String?,
    val reporterAddress: String?,
    val reporterMapUrl: String?,
    val ticketDescription: String?,
    val isRead: Boolean,
    val createdAt: String
)

data class NotificationsPayload(
    val notifications: List<NotificationItem>,
    val unreadCount: Int
)
