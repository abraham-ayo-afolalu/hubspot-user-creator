import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Clear cookies and redirect to home
  const response = NextResponse.redirect(new URL('/', request.url));
  
  // Clear authentication cookies
  response.cookies.delete('okta-session');
  response.cookies.delete('okta-id-token');
  
  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
