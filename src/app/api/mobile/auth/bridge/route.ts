import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signMobileToken } from "@/lib/auth/mobile";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sesi web belum login" }, { status: 401 });
  }

  const user = session.user;
  const token = await signMobileToken({
    id: user.id!,
    email: user.email!,
    name: user.name || "Teknisi",
    role: (user as any).role || "agent",
  });

  return NextResponse.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user as any).role,
      avatarUrl: (user as any).image,
    },
  });
}
