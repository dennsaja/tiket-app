import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { notificationBus } from "@/lib/notifications/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !["agent", "admin", "noc", "owner"].includes(user.role)) return new Response(null, { status: 401 });
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = () => { if (!closed) { try { controller.enqueue(new TextEncoder().encode("data: refresh\n\n")); } catch { cleanup(); } } };
      const unsubscribe = notificationBus.subscribeSystemEvents(send);
      const unnotify = notificationBus.subscribeUser(user.id, send);
      // Also invalidates on another worker's changes and keeps proxies from buffering.
      const heartbeat = setInterval(send, 15000);
      const lifetime = setTimeout(() => { cleanup(); try { controller.close(); } catch {} }, 55000);
      cleanup = () => { if (closed) return; closed = true; clearInterval(heartbeat); clearTimeout(lifetime); unsubscribe(); unnotify(); req.signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); try { controller.close(); } catch {} };
      req.signal.addEventListener("abort", abort, { once: true });
      if (req.signal.aborted) abort(); else send();
    },
    cancel() { cleanup(); },
  });
  // Only an invalidation signal is broadcast. Ticket/chat data is fetched via scoped APIs.
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" } });
}
