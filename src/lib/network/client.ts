import { apiUrl, API_ORIGIN } from "./origins";
/** Auth.js retains its same-origin compatibility endpoint; business requests go directly to the API. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const relative = typeof input === "string" && input.startsWith("/api/") && !input.startsWith("/api/auth/");
  return fetch(relative ? apiUrl(input as string) : input, { ...init, ...(relative && API_ORIGIN ? { credentials: "include" as const } : {}) });
}
