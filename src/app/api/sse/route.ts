import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api/helpers";

// GET /api/sse — Server-Sent Events for real-time updates
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errorResponse("Unauthorized", 401);

  const userId = session.user.id!;

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client disconnected
        }
      };

      sendEvent("connected", { userId, timestamp: new Date().toISOString() });

      // Poll for new notifications every 10 seconds
      // In production, replace with a proper pub/sub system (Redis, Pusher, etc.)
      const intervalId = setInterval(async () => {
        try {
          // Send heartbeat to keep connection alive
          sendEvent("heartbeat", { timestamp: new Date().toISOString() });
        } catch {
          clearInterval(intervalId);
        }
      }, 10000);

      // Clean up on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
