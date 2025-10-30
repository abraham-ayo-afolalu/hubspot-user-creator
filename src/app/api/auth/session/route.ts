import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('okta-session')?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  try {
    // Verify token with Okta
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_OKTA_ISSUER}/v1/introspect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${process.env.NEXT_PUBLIC_OKTA_CLIENT_ID}:${process.env.OKTA_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      }
    );

    const data = await response.json();

    if (data.active) {
      return NextResponse.json({
        authenticated: true,
        user: {
          sub: data.sub,
          email: data.email,
          name: data.name,
        },
      });
    } else {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'verification_failed' },
      { status: 500 }
    );
  }
}
