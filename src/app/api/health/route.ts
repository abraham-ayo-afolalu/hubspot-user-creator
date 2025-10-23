import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hubspotTokenConfigured: !!process.env.HUBSPOT_ACCESS_TOKEN,
      nodeEnv: process.env.NODE_ENV,
    }
  });
}
