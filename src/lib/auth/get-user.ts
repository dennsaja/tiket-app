import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getMobileUserFromRequest } from "./mobile";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Universal authentication helper that resolves user identity from either:
 * 1. Mobile app `Authorization: Bearer <token>`
 * 2. Web browser NextAuth session cookie
 */
export async function getAuthUser(req: NextRequest): Promise<UnifiedUser | null> {
  // 1. Check Mobile Bearer Token
  const mobileUser = await getMobileUserFromRequest(req);
  if (mobileUser) {
    const current = await db.query.users.findFirst({ where: eq(users.id, mobileUser.id) });
    if (!current || !current.isActive || current.deletedAt) return null;
    return { id: current.id, name: current.name, email: current.email, role: current.role };
  }
  if (req.headers.has("authorization")) return null;

  // 2. Check NextAuth Web Session
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      name: session.user.name || "User",
      email: session.user.email || "",
      role: (session.user as any).role || "user",
    };
  }

  return null;
}
