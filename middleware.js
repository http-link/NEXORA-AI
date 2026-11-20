const COOKIE = 'nexora_session';

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function validSession(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key, base64UrlToBytes(parts[1]), new TextEncoder().encode(parts[0])
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    return payload.sub === 'nexora-owner' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname === '/login.html' || url.pathname === '/api/login' || url.pathname === '/api/logout') {
    return;
  }

  const secret = process.env.NEXORA_SESSION_SECRET || '';
  const cookieHeader = request.headers.get('cookie') || '';
const cookie = cookieHeader
  .split(';')
  .map(part => part.trim())
  .find(part => part.startsWith(`${COOKIE}=`))
  ?.slice(COOKIE.length + 1) || '';
  if (await validSession(cookie, secret)) return;

  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  return Response.redirect(new URL('/login.html', request.url));
}

export const config = {
  matcher: ['/((?!_vercel|favicon.ico).*)']
};
