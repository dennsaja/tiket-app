import { NextResponse } from "next/server";

// In-memory rate limit store (use Redis for multi-instance)
const attempts = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig = { windowMs: 60000, max: 100 }
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || now > existing.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.max - 1, reset: now + config.windowMs };
  }

  if (existing.count >= config.max) {
    return { success: false, remaining: 0, reset: existing.resetAt };
  }

  existing.count++;
  return {
    success: true,
    remaining: config.max - existing.count,
    reset: existing.resetAt,
  };
}

export function rateLimitResponse(reset: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": "5",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
      },
    }
  );
}

// Clean up expired entries periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts.entries()) {
    if (now > value.resetAt) {
      attempts.delete(key);
    }
  }
}, 60000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}
