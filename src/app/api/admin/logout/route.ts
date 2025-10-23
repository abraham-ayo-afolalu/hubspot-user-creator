import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { createSuccessResponse } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // Get current session (if any)
    const session = await getAdminSession(request);
    
    // Create response
    const response = createSuccessResponse({
      authenticated: false,
      message: 'Logged out successfully'
    }, 'Logout successful');

    // Clear the admin token cookie
    response.cookies.set('admin-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/'
    });

    // Log successful logout
    if (session) {
      console.log(`Admin logout: ${session.username} at ${new Date().toISOString()}`);
    }

    return response;

  } catch (error: any) {
    // Even if there's an error, we should still clear the cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
      data: { authenticated: false }
    });

    response.cookies.set('admin-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/'
    });

    return response;
  }
}
