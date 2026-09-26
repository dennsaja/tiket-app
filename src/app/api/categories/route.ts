import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories, subcategories } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createCategorySchema } from "@/lib/validations";
import { createAuditLog, getClientIp } from "@/lib/audit";

// GET /api/categories
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const searchParams = req.nextUrl.searchParams;
  const departmentId = searchParams.get("departmentId");

  const categoryList = await db.query.categories.findMany({
    where: departmentId
      ? eq(categories.departmentId, departmentId)
      : eq(categories.isActive, true),
    with: {
      subcategories: {
        where: eq(subcategories.isActive, true),
        orderBy: [asc(subcategories.name)],
      },
    },
    orderBy: [asc(categories.name)],
  });

  return NextResponse.json(categoryList);
}

// POST /api/categories (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userRole = (session.user as any).role;
  if (userRole !== "admin") return errorResponse("Forbidden", 403);

  let body: any;
  try { body = await req.json(); }
  catch { return errorResponse("Invalid JSON body", 400); }

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const [category] = await db.insert(categories).values(parsed.data).returning();

  await createAuditLog({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "category_created",
    targetType: "category",
    targetId: category.id,
    metadata: { name: category.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(category, { status: 201 });
}
