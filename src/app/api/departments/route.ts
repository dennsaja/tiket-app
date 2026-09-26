import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";
import { eq, count, asc } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createDepartmentSchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";

// GET /api/departments
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const deptList = await db.query.departments.findMany({
    where: eq(departments.isActive, true),
    orderBy: [asc(departments.name)],
  });

  return NextResponse.json(deptList);
}

// POST /api/departments (noc & owner only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "noc" && userRole !== "owner") {
    return errorResponse("Forbidden: Akses khusus NOC dan Owner", 403);
  }

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const [dept] = await db
    .insert(departments)
    .values(parsed.data)
    .returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "department_created",
    targetType: "department",
    targetId: dept.id,
    metadata: { name: dept.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(dept, { status: 201 });
}
