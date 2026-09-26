import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

interface AuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: typeof auditLogs.$inferInsert["action"];
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    // Audit log failures should not break the application
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
