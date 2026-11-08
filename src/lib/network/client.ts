/** Pages, login, APIs and assets share this application origin. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit) { return fetch(input, init); }
