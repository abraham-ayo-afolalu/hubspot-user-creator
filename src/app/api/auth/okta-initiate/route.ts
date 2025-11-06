import { NextRequest, NextResponse } from 'next/server';

// Handle Okta IdP-initiated login (when clicking app icon in Okta dashboard)
export async function POST(request: NextRequest) {
  console.log('Okta IdP-initiated login detected');
  
  // Redirect to NextAuth signin which will handle the OAuth flow
  return NextResponse.redirect(new URL('/api/auth/signin', request.url));
}

// Also handle GET just in case
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/api/auth/signin', request.url));
}
