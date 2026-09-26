import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, desc, ilike, and, count, or } from "drizzle-orm";
import { errorResponse, paginatedResponse } from "@/lib/api/helpers";
import { createUserSchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// GET /api/users — list users (admin/agent only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole === "user") return errorResponse("Forbidden", 403);

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, parseInt(searchParams.get("perPage") || "25"));
  const offset = (page - 1) * perPage;
  const search = searchParams.get("search");
  const role = searchParams.get("role");
  const isActive = searchParams.get("isActive");

  const conditions: any[] = [];
  if (search) {
    conditions.push(
      or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`))
    );
  }
  if (role && ["admin", "agent", "user"].includes(role)) {
    conditions.push(eq(users.role, role as any));
  }
  if (isActive !== null && isActive !== undefined) {
    conditions.push(eq(users.isActive, isActive === "true"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [userList, [{ total }]] = await Promise.all([
    db.query.users.findMany({
      where,
      columns: {
        id: true, name: true, email: true, role: true, avatarUrl: true,
        phone: true, isActive: true, lastLoginAt: true, createdAt: true,
        departmentId: true,
        // Exclude passwordHash
      },
      with: { department: { columns: { id: true, name: true } } },
      orderBy: [desc(users.createdAt)],
      limit: perPage,
      offset,
    }),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return paginatedResponse(userList, Number(total), page, perPage);
}

// POST /api/users — create user (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "admin") return errorResponse("Forbidden", 403);

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const data = parsed.data;

  // Check for duplicate email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email.toLowerCase()),
  });
  if (existing) return errorResponse("Email already in use", 409);

  const passwordHash = await bcrypt.hash(data.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      departmentId: data.departmentId || null,
      phone: data.phone || null,
    })
    .returning({
      id: users.id, name: users.name, email: users.email,
      role: users.role, createdAt: users.createdAt,
    });

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "user_created",
    targetType: "user",
    targetId: user.id,
    metadata: { name: user.name, email: user.email, role: user.role },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(user, { status: 201 });
}
