import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/api/helpers";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";
import sharp from "sharp";

const AVATAR_UPLOAD_DIR = process.env.AVATAR_UPLOAD_DIR || "./uploads/avatars";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_AVATAR_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const ALLOWED_AVATAR_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// POST /api/users/avatar — Upload & update profile picture
export async function POST(req: NextRequest) {
  const currentUser = await getAuthUser(req);
  const session = currentUser ? { user: currentUser } : null;
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const currentUserRole = (session.user as any).role;
  const currentUserId = session.user.id!;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Invalid form data", 400);
  }

  const file = formData.get("file") as File | null;
  const targetUserId = (formData.get("userId") as string) || currentUserId;

  // Authorization: Only self or NOC/Owner/Admin can change someone else's avatar
  if (targetUserId !== currentUserId) {
    if (!["noc", "owner", "admin"].includes(currentUserRole)) {
      return errorResponse("Forbidden: Tidak memiliki izin mengubah avatar akun lain", 403);
    }
  }

  if (!file) return errorResponse("Pilih berkas foto profil", 400);

  // Validate size
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return errorResponse("Ukuran foto profil maksimal 5MB", 400);
  }

  // Validate extension
  const ext = path.extname(file.name).replace(".", "").toLowerCase();
  if (!ALLOWED_AVATAR_EXTS.has(ext)) {
    return errorResponse("Format foto tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF", 400);
  }

  const detectedMime = lookup(ext) || file.type || "application/octet-stream";
  if (!ALLOWED_AVATAR_MIMES.has(detectedMime)) {
    return errorResponse("Format berkas bukan merupakan gambar valid", 400);
  }

  let buffer: Buffer;
  try {
    const source = Buffer.from(await file.arrayBuffer());
    const info = await sharp(source, { limitInputPixels: 25000000 }).metadata();
    if (!info.format || !["jpeg","png","webp","gif"].includes(info.format)) throw new Error("Unsupported image");
    buffer = await sharp(source, { limitInputPixels: 25000000 }).rotate().resize(512,512,{fit:"cover",withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  } catch { return errorResponse("Foto tidak valid. Gunakan gambar JPG, PNG, WEBP, atau GIF",422); }

  // Generate unique file name
  const storedName = `avatar_${nanoid(24)}.jpg`;
  const uploadDirResolved = path.resolve(process.cwd(), AVATAR_UPLOAD_DIR);
  const storagePath = path.join(uploadDirResolved, storedName);

  // Ensure directory exists
  await fs.mkdir(uploadDirResolved, { recursive: true });

  // Write file to disk
  await fs.writeFile(storagePath, buffer);

  const avatarUrl = `/api/avatars/${storedName}`;

  // Update user in database
  const [updatedUser] = await db
    .update(users)
    .set({
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning();

  if (!updatedUser) {
    return errorResponse("Pengguna tidak ditemukan", 404);
  }

  await createAuditLog({
    actorId: currentUserId,
    actorEmail: session.user.email,
    action: "user_updated",
    targetType: "user",
    targetId: targetUserId,
    metadata: { action: "avatar_updated", avatarUrl },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    success: true,
    message: "Foto profil berhasil diperbarui",
    avatarUrl,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
    },
  });
}

// DELETE /api/users/avatar — Remove profile picture
export async function DELETE(req: NextRequest) {
  const currentUser = await getAuthUser(req);
  const session = currentUser ? { user: currentUser } : null;
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const currentUserRole = (session.user as any).role;
  const currentUserId = session.user.id!;

  const searchParams = req.nextUrl.searchParams;
  const targetUserId = searchParams.get("userId") || currentUserId;

  if (targetUserId !== currentUserId) {
    if (!["noc", "owner", "admin"].includes(currentUserRole)) {
      return errorResponse("Forbidden: Tidak memiliki izin menghapus avatar akun lain", 403);
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      avatarUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning();

  if (!updatedUser) {
    return errorResponse("Pengguna tidak ditemukan", 404);
  }

  await createAuditLog({
    actorId: currentUserId,
    actorEmail: session.user.email,
    action: "user_updated",
    targetType: "user",
    targetId: targetUserId,
    metadata: { action: "avatar_removed" },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    success: true,
    message: "Foto profil berhasil dihapus",
    avatarUrl: null,
  });
}
