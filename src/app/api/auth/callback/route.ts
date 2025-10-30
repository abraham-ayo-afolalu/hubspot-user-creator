import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle authentication error
  if (error) {
    console.error('Okta authentication error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/?error=missing_parameters', request.url)
    );
  }

  try {
    // Decode state to get return URL
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const returnTo = stateData.returnTo || '/';

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_OKTA_ISSUER}/v1/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.NEXT_PUBLIC_OKTA_REDIRECT_URI!,
          client_id: process.env.NEXT_PUBLIC_OKTA_CLIENT_ID!,
          client_secret: process.env.OKTA_CLIENT_SECRET!,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorData);
      console.error('Issuer:', process.env.NEXT_PUBLIC_OKTA_ISSUER);
      console.error('Client ID:', process.env.NEXT_PUBLIC_OKTA_CLIENT_ID);
      console.error('Redirect URI:', process.env.NEXT_PUBLIC_OKTA_REDIRECT_URI);
      return NextResponse.redirect(
        new URL(`/?error=token_exchange_failed&details=${encodeURIComponent(errorData)}`, request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Create response with redirect
    const response = NextResponse.redirect(new URL(returnTo, request.url));

    // Set secure HTTP-only cookie with the session token
    response.cookies.set('okta-session', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600, // Default 1 hour
      path: '/',
    });

    // Store tokens in another cookie for client-side access (less sensitive)
    response.cookies.set('okta-id-token', tokens.id_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Callback processing error:', error);
    return NextResponse.redirect(
      new URL('/?error=callback_failed', request.url)
    );
  }
}
