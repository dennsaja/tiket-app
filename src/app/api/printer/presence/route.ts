import { auth } from "@/lib/auth";
import { PrinterPresence, PRINTER_ROLES } from "@/lib/printing/presence";

export const dynamic = "force-dynamic";
const runtime = globalThis as typeof globalThis & { usbPresence?: PrinterPresence };
const registry = runtime.usbPresence ??= new PrinterPresence();

async function respond(req?: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !role || !PRINTER_ROLES.includes(role)) return new Response(null, { status: 403 });
  if (req) {
    const id = new URL(req.url).searchParams.get("host") || "";
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return new Response(null, { status: 400 });
    const transport = new URL(req.url).searchParams.get("transport") ?? "USB";
    if (transport !== "USB" && transport !== "Bluetooth") return new Response(null, { status: 400 });
    if (!registry.update(id, session.user.id, role, req.method === "PUT", Date.now(), transport)) return new Response(null, { status: 409 });
  }
  const bluetoothRoles = registry.roles(Date.now(), "Bluetooth");
  return Response.json({ roles: registry.roles(), ...(bluetoothRoles.length ? { bluetoothRoles } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() { return respond(); }
export async function PUT(req: Request) { return respond(req); }
export async function DELETE(req: Request) { return respond(req); }
