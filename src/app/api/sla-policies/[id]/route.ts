import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slaPolicies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { updateSlaPolicySchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";

// GET /api/sla-policies/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const policy = await db.query.slaPolicies.findFirst({
    where: eq(slaPolicies.id, id),
    with: { department: { columns: { id: true, name: true } } },
  });

  if (!policy) return errorResponse("Kebijakan SLA tidak ditemukan", 404);
  return NextResponse.json(policy);
}

// PUT /api/sla-policies/[id] — Update SLA policy (noc & owner)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") {
    return errorResponse("Forbidden: Akses khusus NOC dan Owner", 403);
  }

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = updateSlaPolicySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const existing = await db.query.slaPolicies.findFirst({
    where: eq(slaPolicies.id, id),
  });

  if (!existing) return errorResponse("Kebijakan SLA tidak ditemukan", 404);

  const [updated] = await db
    .update(slaPolicies)
    .set({
      ...parsed.data,
      departmentId: parsed.data.departmentId === "none" ? null : parsed.data.departmentId,
      updatedAt: new Date(),
    })
    .where(eq(slaPolicies.id, id))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "sla_policy_updated",
    targetType: "sla_policy",
    targetId: updated.id,
    metadata: { name: updated.name, changes: parsed.data },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/sla-policies/[id] — Delete or deactivate SLA policy (noc & owner)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") {
    return errorResponse("Forbidden: Akses khusus NOC dan Owner", 403);
  }

  const { id } = await params;
  const existing = await db.query.slaPolicies.findFirst({
    where: eq(slaPolicies.id, id),
  });

  if (!existing) return errorResponse("Kebijakan SLA tidak ditemukan", 404);

  // Mark inactive
  const [updated] = await db
    .update(slaPolicies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(slaPolicies.id, id))
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "sla_policy_updated",
    targetType: "sla_policy",
    targetId: id,
    metadata: { name: existing.name, action: "deactivated" },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true, message: "Kebijakan SLA berhasil dinonaktifkan", policy: updated });
}
