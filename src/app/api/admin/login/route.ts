import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials, createAdminToken } from '@/lib/auth';
import { 
  CustomError, 
  ErrorCodes, 
  createErrorResponse, 
  createSuccessResponse,
  validateRequiredFields,
  logError
} from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      throw new CustomError(
        'Invalid JSON in request body',
        ErrorCodes.INVALID_REQUEST,
        400,
        { originalError: parseError }
      );
    }

    // Validate required fields
    validateRequiredFields(body, ['username', 'password']);
    
    const { username, password } = body;

    // Verify credentials
    if (!verifyAdminCredentials(username, password)) {
      // Log failed login attempt
      logError(new Error('Failed admin login attempt'), {
        username,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        requestId
      });

      throw new CustomError(
        'Invalid username or password',
        ErrorCodes.AUTHENTICATION_ERROR,
        401
      );
    }

    // Create JWT token
    const token = await createAdminToken(username);

    // Create response with secure cookie
    const response = createSuccessResponse({
      authenticated: true,
      username,
      expiresIn: '8h'
    }, 'Login successful');

    // Set secure HTTP-only cookie
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: '/'
    });

    // Log successful login
    console.log(`Admin login successful: ${username} at ${new Date().toISOString()}`);

    return response;

  } catch (error: any) {
    logError(error, { requestId, endpoint: 'admin/login' });

    if (error instanceof CustomError) {
      return createErrorResponse(error, requestId);
    }

    const unexpectedError = new CustomError(
      'An unexpected error occurred during login',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      { originalError: error.message }
    );

    return createErrorResponse(unexpectedError, requestId);
  }
}
