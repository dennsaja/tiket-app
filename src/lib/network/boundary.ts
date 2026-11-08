import { NextRequest, NextResponse } from 'next/server';
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Single-origin browser access; native clients keep using Bearer authentication. */
export function serviceBoundary(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (path === '/healthz') return NextResponse.json({ service: 'monolith', ready: true }, { headers: { 'Cache-Control': 'no-store' } });
  if (!path.startsWith('/api/')) return null;
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  const ownOrigin = host ? protocol + '://' + host : request.nextUrl.origin;
  if (origin && origin !== ownOrigin) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!readMethods.has(request.method) && request.headers.has('cookie') && !origin) return NextResponse.json({ error: 'Origin required for cookie-authenticated writes' }, { status: 403 });
  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204 });
  return null;
}
