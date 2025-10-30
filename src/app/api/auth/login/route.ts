import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const returnTo = searchParams.get('returnTo') || '/';
  
  // Build the Okta authorization URL
  const oktaIssuer = process.env.NEXT_PUBLIC_OKTA_ISSUER;
  const clientId = process.env.NEXT_PUBLIC_OKTA_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_OKTA_REDIRECT_URI;

  if (!oktaIssuer || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Okta configuration is missing' },
      { status: 500 }
    );
  }

  // Generate state and nonce for security
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64');
  const nonce = Math.random().toString(36).substring(7);

  // Build authorization URL
  const authUrl = new URL(`${oktaIssuer}/v1/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  // Redirect to Okta for authentication
  return NextResponse.redirect(authUrl.toString());
}
