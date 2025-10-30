// Server-side auth utilities
export const AUTH_COOKIE_NAME = 'okta-session';
export const SESSION_DURATION = 60 * 60 * 24; // 24 hours in seconds

// Helper to verify JWT token (server-side)
export async function verifyOktaToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_OKTA_ISSUER}/v1/introspect`, {
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
    });

    const data = await response.json();
    return data.active === true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}
