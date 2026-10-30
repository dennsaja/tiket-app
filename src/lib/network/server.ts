import "server-only";
export function backendOrigin(): string {
  const value = process.env.BACKEND_INTERNAL_ORIGIN || process.env.NEXT_PUBLIC_API_ORIGIN;
  if (!value) throw new Error("BACKEND_INTERNAL_ORIGIN is required for the frontend service");
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("Invalid backend origin");
  return parsed.origin;
}
