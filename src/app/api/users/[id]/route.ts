import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { updateUserSchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";
import bcrypt from "bcryptjs";

// GET /api/users/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id!;

  // Users can only view their own profile
  if (userRole === "user" && id !== currentUserId) {
    return errorResponse("Forbidden", 403);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true, name: true, email: true, role: true, avatarUrl: true,
      phone: true, isActive: true, lastLoginAt: true, createdAt: true,
      departmentId: true,
    },
    with: { department: true },
  });

  if (!user) return errorResponse("User not found", 404);
  return NextResponse.json(user);
}

// PATCH /api/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const userRole = (session.user as any).role;
  const currentUserId = session.user.id!;

  // Only NOC and Owner can update other users; users can update own basic info
  const isOwnProfile = id === currentUserId;
  const isManager = userRole === "noc" || userRole === "owner";
  if (!isOwnProfile && !isManager) {
    return errorResponse("Forbidden: Akses ditolak", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  // Non-managers cannot change role or active status
  if (!isManager) {
    delete body.role;
    delete body.isActive;
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) return errorResponse("User not found", 404);

  const updates: Record<string, any> = { ...parsed.data, updatedAt: new Date() };

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning({
      id: users.id, name: users.name, email: users.email,
      role: users.role, isActive: users.isActive,
    });

  await createAuditLog({
    actorId: currentUserId,
    actorEmail: session.user.email,
    action: "user_updated",
    targetType: "user",
    targetId: id,
    metadata: { changes: Object.keys(parsed.data) },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(updated);
}

// DELETE /api/users/[id] — deactivate (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") return errorResponse("Forbidden", 403);

  const { id } = await params;
  
  // Cannot deactivate yourself
  if (id === session.user.id) {
    return errorResponse("Cannot deactivate your own account", 400);
  }

  await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "user_deactivated",
    targetType: "user",
    targetId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
