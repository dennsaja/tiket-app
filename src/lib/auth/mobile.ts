import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

function signingKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export interface MobileUserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Generate a JWT token for mobile technician login valid for 60 days
 */
export async function signMobileToken(user: MobileUserPayload): Promise<string> {
  return await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(signingKey());
}

/**
 * Verify and decode mobile JWT token
 */
export async function verifyMobileToken(token: string): Promise<MobileUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    if (![payload.id, payload.email, payload.name, payload.role].every(value => typeof value === "string" && value.length > 0)) return null;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (err: any) {
    console.warn(`[MOBILE_AUTH] Token verification failed: ${err?.message}`);
    return null;
  }
}

/**
 * Extract mobile user from Authorization Bearer header
 */
export async function getMobileUserFromRequest(req: NextRequest): Promise<MobileUserPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return await verifyMobileToken(token);
}
