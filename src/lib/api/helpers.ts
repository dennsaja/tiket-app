import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export type ApiHandler = (
  req: Request,
  ctx: { params?: any; session: Session }
) => Promise<NextResponse>;

/**
 * Standard error response
 */
export function errorResponse(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response
 */
export function successResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Validate request body with Zod schema
 */
export async function validateBody<T>(
  req: Request,
  schema: { safeParse: (data: any) => { success: boolean; data?: T; error?: any } }
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const errorMessage = result.error?.issues
        .map((i: any) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return {
        data: null,
        error: errorResponse(`Validation error: ${errorMessage}`, 422),
      };
    }
    return { data: result.data!, error: null };
  } catch {
    return {
      data: null,
      error: errorResponse("Invalid JSON body", 400),
    };
  }
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

/**
 * Get pagination params
 */
export function getPaginationParams(searchParams: URLSearchParams): {
  page: number;
  perPage: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("perPage") || "25", 10))
  );
  return { page, perPage, offset: (page - 1) * perPage };
}

/**
 * Standard paginated response
 */
export function paginatedResponse(
  data: any[],
  total: number,
  page: number,
  perPage: number
): NextResponse {
  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      perPage,
      pageCount: Math.ceil(total / perPage),
    },
  });
}
