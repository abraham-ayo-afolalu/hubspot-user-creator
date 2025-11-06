import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if user has a session cookie
  const sessionCookie = request.cookies.get('next-auth.session-token') || 
                       request.cookies.get('__Secure-next-auth.session-token');
  
  // If no session and not already on auth routes, redirect to Okta sign-in
  if (!sessionCookie && !request.nextUrl.pathname.startsWith('/api/auth')) {
    // Redirect to your specific Okta bookmark sign-in URL
    return NextResponse.redirect('https://signin.elasticpath.com/home/bookmark/0oa1q557yurJ7iJX1358/2557');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
