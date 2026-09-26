import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { lookup } from "mime-types";

const AVATAR_UPLOAD_DIR = process.env.AVATAR_UPLOAD_DIR || "./uploads/avatars";

// GET /api/avatars/[filename] — Serve avatar image
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  if (!safeFilename || safeFilename !== filename) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const uploadDirResolved = path.resolve(process.cwd(), AVATAR_UPLOAD_DIR);
  const filePath = path.join(uploadDirResolved, safeFilename);

  try {
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = lookup(safeFilename) || "image/jpeg";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Avatar not found", { status: 404 });
  }
}
