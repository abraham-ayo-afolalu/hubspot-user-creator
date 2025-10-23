import { NextResponse } from 'next/server';

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export class CustomError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Predefined error types
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  HUBSPOT_API_ERROR: 'HUBSPOT_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
  ASSOCIATION_ERROR: 'ASSOCIATION_ERROR',
} as const;

// Error logging utility
export function logError(error: Error | CustomError, context?: any) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    context,
    ...(error instanceof CustomError && {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    }),
  };

  // Log to console (in production, send to external logging service)
  console.error('[ERROR]', JSON.stringify(errorLog, null, 2));

  // In production, you might want to send to external services like:
  // - Sentry: Sentry.captureException(error, { extra: context });
  // - DataDog: logger.error(error.message, errorLog);
  // - CloudWatch: cloudwatchLogger.error(errorLog);
}

// HubSpot API error handler
export function handleHubSpotError(error: any): CustomError {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        return new CustomError(
          `Invalid request: ${data?.message || 'Bad request'}`,
          ErrorCodes.VALIDATION_ERROR,
          400,
          data
        );
      case 401:
        return new CustomError(
          'HubSpot authentication failed. Please check API credentials.',
          ErrorCodes.AUTHENTICATION_ERROR,
          401,
          data
        );
      case 403:
        return new CustomError(
          'Insufficient permissions for HubSpot API operation.',
          ErrorCodes.AUTHENTICATION_ERROR,
          403,
          data
        );
      case 404:
        return new CustomError(
          'HubSpot resource not found.',
          ErrorCodes.COMPANY_NOT_FOUND,
          404,
          data
        );
      case 409:
        return new CustomError(
          'User already exists in HubSpot.',
          ErrorCodes.USER_ALREADY_EXISTS,
          409,
          data
        );
      case 429:
        return new CustomError(
          'HubSpot API rate limit exceeded. Please try again later.',
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          429,
          data
        );
      case 500:
      case 502:
      case 503:
        return new CustomError(
          'HubSpot API is temporarily unavailable.',
          ErrorCodes.HUBSPOT_API_ERROR,
          503,
          data
        );
      default:
        return new CustomError(
          `HubSpot API error: ${data?.message || 'Unknown error'}`,
          ErrorCodes.HUBSPOT_API_ERROR,
          status,
          data
        );
    }
  }

  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new CustomError(
      'Unable to connect to HubSpot API. Please check network connection.',
      ErrorCodes.NETWORK_ERROR,
      503,
      { originalError: error.code }
    );
  }

  return new CustomError(
    `Unexpected HubSpot API error: ${error.message}`,
    ErrorCodes.HUBSPOT_API_ERROR,
    500,
    { originalError: error.message }
  );
}

// Generic API response builder
export function createErrorResponse(error: CustomError | Error, requestId?: string): NextResponse {
  let apiError: ApiError;

  if (error instanceof CustomError) {
    apiError = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId,
    };
  } else {
    apiError = {
      message: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  // Log the error
  logError(error, { requestId });

  return NextResponse.json({ error: apiError }, { status: apiError.statusCode });
}

// Success response builder
export function createSuccessResponse(data: any, message?: string, statusCode: number = 200): NextResponse {
  return NextResponse.json({
    success: true,
    message: message || 'Operation completed successfully',
    data,
    timestamp: new Date().toISOString(),
  }, { status: statusCode });
}

// Validation helper
export function validateRequiredFields(data: any, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => !data[field] || (typeof data[field] === 'string' && !data[field].trim()));
  
  if (missingFields.length > 0) {
    throw new CustomError(
      `Missing or empty required fields: ${missingFields.join(', ')}`,
      ErrorCodes.VALIDATION_ERROR,
      400,
      { missingFields }
    );
  }
}

// Email validation helper
export function validateEmail(email: string): void {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    throw new CustomError(
      'Invalid email format',
      ErrorCodes.VALIDATION_ERROR,
      400,
      { email }
    );
  }
}
