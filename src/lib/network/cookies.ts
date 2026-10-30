/** Remove old frontend-only Auth.js cookies after introducing the shared parent-domain cookies. */
export function legacyHostCookieExpirations(header: string, secure: boolean): string[] {
  const names = new Set(header.split(";").map(part => part.trim().split("=")[0]).filter(name => /^(?:(?:__Secure-)?authjs\.(?:session-token(?:\.\d+)?|callback-url)|__Host-authjs\.csrf-token)$/.test(name)));
  return [...names].map(name => name + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : ""));
}
