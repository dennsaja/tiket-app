import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/auth/mobile";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/).optional().default(""),
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(12, "Kata sandi baru minimal 12 karakter").max(72).optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["agent", "noc", "admin", "owner"].includes(actor.role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const limit = rateLimit("mobile_profile:" + actor.id, { windowMs: 60000, max: 10 });
  if (!limit.success) return rateLimitResponse(limit.reset);
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 }); }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 422 });
  const current = await db.query.users.findFirst({ where: and(eq(users.id, actor.id), isNull(users.deletedAt)) });
  if (!current || !current.isActive) return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
  const data = parsed.data;
  if (data.newPassword && Buffer.byteLength(data.newPassword,"utf8")>72) return NextResponse.json({error:"Kata sandi baru maksimal 72 byte"},{status:422});
  if (data.email !== current.email.toLowerCase() || data.newPassword) {
    if (!data.currentPassword || !current.passwordHash || !await bcrypt.compare(data.currentPassword, current.passwordHash)) {
      return NextResponse.json({ error: "Kata sandi saat ini diperlukan untuk mengganti email atau kata sandi" }, { status: 422 });
    }
  }
  try {
    const [updated] = await db.update(users).set({
      name: data.name, email: data.email, phone: data.phone || null, updatedAt: new Date(),
      ...(data.newPassword ? { passwordHash: await bcrypt.hash(data.newPassword, 12) } : {}),
      ...(data.email !== current.email.toLowerCase() ? { emailVerified: null } : {}),
    }).where(and(eq(users.id, actor.id), isNull(users.deletedAt), eq(users.isActive, true))).returning({
      id: users.id, name: users.name, email: users.email, role: users.role, phone: users.phone, avatarUrl: users.avatarUrl,
    });
    if (!updated) return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
    await createAuditLog({ actorId: actor.id, actorEmail: actor.email, action: "user_updated", targetType: "user", targetId: actor.id,
      metadata: { source: "android_profile", fields: ["name", "email", "phone", ...(data.newPassword ? ["password"] : [])] }, ipAddress: getClientIp(req) });
    return NextResponse.json({ success: true, user: updated, token: await signMobileToken(updated) });
  } catch (error: any) {
    if (error.code === "23505" || error.cause?.code === "23505") return NextResponse.json({ error: "Email sudah digunakan akun lain" }, { status: 409 });
    throw error;
  }
}
