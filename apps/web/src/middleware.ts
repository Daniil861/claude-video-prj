import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-cookie';

const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Verify signature and expiry here, not just cookie presence: a stale token
  // would otherwise bounce between the guard and the page forever.
  const claims = token ? await verifySessionToken(token) : null;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!claims) {
    if (isAuthRoute) {
      return NextResponse.next();
    }

    const response = NextResponse.redirect(new URL('/auth/login', request.url));

    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }

    return response;
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/meetings/:path*', '/auth/login', '/auth/register'],
};
