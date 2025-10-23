import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { createSuccessResponse } from '@/lib/errorHandler';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request);
    
    if (session) {
      return createSuccessResponse({
        authenticated: true,
        username: session.username,
        loginTime: session.loginTime,
        sessionAge: Date.now() - session.loginTime
      }, 'Admin is authenticated');
    } else {
      return createSuccessResponse({
        authenticated: false
      }, 'Not authenticated');
    }

  } catch (error: any) {
    return createSuccessResponse({
      authenticated: false,
      error: 'Session verification failed'
    }, 'Authentication check failed');
  }
}
