import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for admin auth endpoints
  if (pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  // Only protect /admin routes and their API endpoints (but not login page)
  const isAdminRoute = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isAdminApiRoute = pathname.startsWith('/api/admin-');

  if (isAdminRoute || isAdminApiRoute) {
    // Check admin authentication
    const session = await getAdminSession(request);
    
    if (!session?.isAuthenticated) {
      if (isAdminRoute) {
        // Redirect to admin login page
        const loginUrl = new URL('/admin/login', request.url);
        return NextResponse.redirect(loginUrl);
      } else {
        // API route - return 401
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Admin authentication required',
              code: 'AUTHENTICATION_REQUIRED',
              statusCode: 401,
              timestamp: new Date().toISOString(),
            }
          },
          { status: 401 }
        );
      }
    }

    // Add admin session info to request headers for logging
    const response = NextResponse.next();
    response.headers.set('X-Admin-User', session.username);
    response.headers.set('X-Admin-Login-Time', session.loginTime.toString());
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin-:path*',
    '/api/admin/:path*'
  ]
};
