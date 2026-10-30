function origin(value: string | undefined): string {
  if (!value) return "";
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("Configure an HTTP(S) origin without a path or credentials");
  return parsed.origin;
}
export const FRONTEND_ORIGIN = origin(process.env.NEXT_PUBLIC_FRONTEND_ORIGIN);
export const API_ORIGIN = origin(process.env.NEXT_PUBLIC_API_ORIGIN);
export const CDN_ORIGIN = origin(process.env.NEXT_PUBLIC_CDN_ORIGIN);
export function apiUrl(value: string): string {
  return value.startsWith("/api/") ? API_ORIGIN + value : value;
}
export function assetUrl(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? CDN_ORIGIN + value : value;
}
export function resourceUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("/api/") ? apiUrl(value) : value;
}
