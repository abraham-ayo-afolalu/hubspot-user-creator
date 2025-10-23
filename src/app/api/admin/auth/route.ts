import { NextRequest, NextResponse } from 'next/server';

// Simple admin password (use proper authentication in production)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password === ADMIN_PASSWORD) {
      // In production, generate JWT token here
      return NextResponse.json({ 
        success: true,
        message: 'Authentication successful' 
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid password' 
        },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Authentication failed' 
      },
      { status: 500 }
    );
  }
}
