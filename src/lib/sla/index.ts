import { db } from "@/lib/db";
import {
  slaPolicies,
  tickets,
  businessHours,
  slaEvents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { addMinutes, isWithinInterval, setHours, setMinutes, startOfDay, addDays } from "date-fns";

interface SlaCalculationResult {
  firstResponseDue: Date;
  resolutionDue: Date;
  policyId: string;
}

/**
 * Find the best matching SLA policy for a ticket
 */
export async function findSlaPolicy(
  priority: string,
  departmentId?: string | null
): Promise<typeof slaPolicies.$inferSelect | null> {
  // Try department-specific policy first
  if (departmentId) {
    const deptPolicy = await db.query.slaPolicies.findFirst({
      where: and(
        eq(slaPolicies.priority, priority as any),
        eq(slaPolicies.departmentId, departmentId),
        eq(slaPolicies.isActive, true)
      ),
    });
    if (deptPolicy) return deptPolicy;
  }

  // Fall back to global policy for this priority
  const globalPolicy = await db.query.slaPolicies.findFirst({
    where: and(
      eq(slaPolicies.priority, priority as any),
      eq(slaPolicies.isActive, true)
    ),
  });

  return globalPolicy || null;
}

/**
 * Calculate SLA due dates for a ticket
 * Handles both calendar and business hours
 */
export async function calculateSlaDates(
  startDate: Date,
  policy: typeof slaPolicies.$inferSelect
): Promise<{ firstResponseDue: Date; resolutionDue: Date }> {
  if (!policy.useBusinessHours) {
    return {
      firstResponseDue: addMinutes(startDate, policy.firstResponseMinutes),
      resolutionDue: addMinutes(startDate, policy.resolutionMinutes),
    };
  }

  // Business hours calculation
  const hours = await db.query.businessHours.findMany();
  
  return {
    firstResponseDue: addBusinessMinutes(startDate, policy.firstResponseMinutes, hours),
    resolutionDue: addBusinessMinutes(startDate, policy.resolutionMinutes, hours),
  };
}

/**
 * Add business minutes to a date respecting business hours
 */
function addBusinessMinutes(
  startDate: Date,
  minutes: number,
  businessHoursConfig: typeof businessHours.$inferSelect[]
): Date {
  let current = new Date(startDate);
  let remainingMinutes = minutes;
  let iterations = 0;
  const maxIterations = 365; // Safety limit

  while (remainingMinutes > 0 && iterations < maxIterations) {
    iterations++;
    const dayOfWeek = current.getDay();
    const dayConfig = businessHoursConfig.find((h) => h.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.isOpen) {
      // Skip to next day
      current = startOfDay(addDays(current, 1));
      const nextDayConfig = businessHoursConfig.find(
        (h) => h.dayOfWeek === current.getDay()
      );
      if (nextDayConfig?.isOpen) {
        const [openH, openM] = nextDayConfig.openTime.split(":").map(Number);
        current = setMinutes(setHours(current, openH), openM);
      }
      continue;
    }

    const [openH, openM] = dayConfig.openTime.split(":").map(Number);
    const [closeH, closeM] = dayConfig.closeTime.split(":").map(Number);

    const dayOpen = setMinutes(setHours(startOfDay(current), openH), openM);
    const dayClose = setMinutes(setHours(startOfDay(current), closeH), closeM);

    // If current time is before open, jump to open
    if (current < dayOpen) {
      current = dayOpen;
    }

    // If current time is after close, jump to next day
    if (current >= dayClose) {
      current = startOfDay(addDays(current, 1));
      continue;
    }

    // Minutes available today
    const minutesAvailableToday = Math.floor(
      (dayClose.getTime() - current.getTime()) / 60000
    );

    if (remainingMinutes <= minutesAvailableToday) {
      current = addMinutes(current, remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesAvailableToday;
      current = startOfDay(addDays(current, 1));
    }
  }

  return current;
}

/**
 * Apply SLA policy to a ticket
 */
export async function applySlaPolicyToTicket(
  ticketId: string,
  priority: string,
  departmentId: string | null | undefined,
  createdAt: Date
): Promise<void> {
  const policy = await findSlaPolicy(priority, departmentId);
  if (!policy) return;

  const { firstResponseDue, resolutionDue } = await calculateSlaDates(
    createdAt,
    policy
  );

  await db
    .update(tickets)
    .set({
      slaPolicyId: policy.id,
      slaFirstResponseDue: firstResponseDue,
      slaResolutionDue: resolutionDue,
    })
    .where(eq(tickets.id, ticketId));
}

/**
 * Check if SLA is breached
 */
export function isSlaBreached(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date() > new Date(dueDate);
}

/**
 * Get SLA status percentage
 */
export function getSlaPercentage(
  startDate: Date,
  dueDate: Date
): number {
  const total = dueDate.getTime() - startDate.getTime();
  const elapsed = Date.now() - startDate.getTime();
  return Math.min(100, Math.round((elapsed / total) * 100));
}
