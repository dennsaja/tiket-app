import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slaPolicies } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createSlaPolicySchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";

// GET /api/sla-policies
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole === "user") return errorResponse("Forbidden", 403);

  const policies = await db.query.slaPolicies.findMany({
    where: eq(slaPolicies.isActive, true),
    with: { department: { columns: { id: true, name: true } } },
    orderBy: [asc(slaPolicies.priority)],
  });

  return NextResponse.json(policies);
}

// POST /api/sla-policies (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "admin") return errorResponse("Forbidden", 403);

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = createSlaPolicySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const [policy] = await db.insert(slaPolicies).values(parsed.data).returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "sla_policy_created",
    targetType: "sla_policy",
    targetId: policy.id,
    metadata: { name: policy.name, priority: policy.priority },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(policy, { status: 201 });
}
