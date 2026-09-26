import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";

export async function GET() {
  const dbHealthy = await checkDatabaseConnection();

  const health = {
    status: dbHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    services: {
      database: dbHealthy ? "healthy" : "unhealthy",
    },
  };

  return NextResponse.json(health, {
    status: dbHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
