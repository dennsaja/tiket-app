import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { registerSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

// POST /api/auth/register — register a new user
export async function POST(req: NextRequest) {
  // Rate limit: 3 registrations per 10 minutes per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limitResult = rateLimit(`register:${ip}`, {
    windowMs: 10 * 60 * 1000,
    max: 3,
  });
  if (!limitResult.success) return rateLimitResponse(limitResult.reset);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      422
    );
  }

  const { name, email, password } = parsed.data;

  // Check for duplicate
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (existing) {
    // Return generic message to prevent user enumeration
    return errorResponse("Registration failed. Please try different credentials.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "user", // New users always get 'user' role
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    });

  return NextResponse.json(
    { message: "Account created successfully", user },
    { status: 201 }
  );
}
