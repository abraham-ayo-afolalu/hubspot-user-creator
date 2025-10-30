import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Allow health check
  if (pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  // Check for authentication token
  const token = request.cookies.get('okta-session')?.value;

  // Protect main page and API routes
  const isProtectedRoute = pathname === '/' || 
                          pathname.startsWith('/api/create-user') ||
                          pathname.startsWith('/api/bulk-upload') ||
                          pathname.startsWith('/api/search-organizations');

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/api/auth/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
};
