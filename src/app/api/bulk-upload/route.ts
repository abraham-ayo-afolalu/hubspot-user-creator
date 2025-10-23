import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';
import { checkRateLimit, validateBulkUpload, sanitizeErrorMessage, getClientIdentifier } from '@/lib/security';
import { 
  CustomError, 
  ErrorCodes, 
  handleHubSpotError, 
  createErrorResponse, 
  createSuccessResponse,
  validateRequiredFields,
  validateEmail,
  logError
} from '@/lib/errorHandler';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

interface CsvUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface BulkUploadRequest {
  users: CsvUser[];
  organizationId: string;
  organizationName: string;
}

interface UploadError {
  row: number;
  user: CsvUser;
  error: string;
}

interface BulkUploadResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: UploadError[];
}

// Function to create a single contact
async function createContact(user: CsvUser, organizationId: string, organizationName: string): Promise<{ success: boolean; error?: string; contactId?: string; errorCode?: string }> {
  try {
    // Validate user data first
    if (!user.firstName?.trim() || !user.lastName?.trim() || !user.email?.trim()) {
      return {
        success: false,
        error: 'Missing required user data',
        errorCode: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Validate email format
    try {
      validateEmail(user.email);
    } catch (emailError) {
      return {
        success: false,
        error: 'Invalid email format',
        errorCode: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Step 1: Create contact with minimal properties first to avoid automatic associations
    const basicContactProperties: any = {
      firstname: user.firstName.trim(),
      lastname: user.lastName.trim(),
      active_in_okta: 'yes',
      lifecyclestage: 'lead'
      // NOTE: Intentionally NOT including email in initial creation to prevent domain matching
    };

    const apiResponse = await hubspotClient.crm.contacts.basicApi.create({
      properties: basicContactProperties
    });

    // Step 2: Update the contact with email and company name after creation
    if (apiResponse.id) {
      const updateProperties: any = {
        email: user.email.trim().toLowerCase()
      };

      // Set the company name on the contact for display in profile
      if (organizationName) {
        updateProperties.company = organizationName;
      }

      await hubspotClient.crm.contacts.basicApi.update(apiResponse.id, {
        properties: updateProperties
      });
    }
    
    // Create manual association with the selected organization
    if (organizationId && apiResponse.id) {
      try {
        const associationRequest = {
          inputs: [
            {
              _from: { id: apiResponse.id },
              to: { id: organizationId },
              type: 'contact_to_company'
            }
          ]
        };
        
        await hubspotClient.crm.associations.batchApi.create(
          'contacts',
          'companies', 
          associationRequest
        );
      } catch (associationError) {
        logError(new Error('Association failed in bulk upload'), { 
          contactId: apiResponse.id, 
          organizationId,
          user: { firstName: user.firstName, lastName: user.lastName, email: user.email.substring(0, 3) + '***' }
        });
        // Don't fail the contact creation for association errors
      }
    }
    
    return {
      success: true,
      contactId: apiResponse.id,
    };
  } catch (error: any) {
    const hubspotError = handleHubSpotError(error);
    
    logError(hubspotError, {
      user: { firstName: user.firstName, lastName: user.lastName, email: user.email ? user.email.substring(0, 3) + '***' : undefined },
      organizationId
    });
    
    return {
      success: false,
      error: hubspotError.message,
      errorCode: hubspotError.code,
    };
  }
}

// Function to validate user data
function validateUser(user: CsvUser, index: number): { valid: boolean; error?: string } {
  if (!user.firstName?.trim()) {
    return { valid: false, error: 'First name is required' };
  }
  
  if (!user.lastName?.trim()) {
    return { valid: false, error: 'Last name is required' };
  }
  
  if (!user.email?.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(user.email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const clientId = getClientIdentifier(request.headers);
  const userAgent = request.headers.get('user-agent') || undefined;
  let body: BulkUploadRequest | undefined;
  
  try {
    // Environment validation
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      throw new CustomError(
        'HubSpot integration is not properly configured',
        ErrorCodes.INTERNAL_SERVER_ERROR,
        500
      );
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit(clientId, 'BULK_UPLOAD');
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for ${clientId} - BULK_UPLOAD`);
      throw new CustomError(
        'Too many bulk upload requests. Please try again later.',
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        429,
        { remaining: rateLimitResult.remaining }
      );
    }

    // Parse and validate request body
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

    if (!body) {
      throw new CustomError(
        'Request body is required',
        ErrorCodes.INVALID_REQUEST,
        400
      );
    }

    const { users, organizationId, organizationName } = body;

    // Validate required fields
    validateRequiredFields(body, ['users', 'organizationId', 'organizationName']);

    // Validate users array
    if (!Array.isArray(users) || users.length === 0) {
      throw new CustomError(
        'Users array is required and must not be empty',
        ErrorCodes.VALIDATION_ERROR,
        400,
        { usersLength: users?.length || 0 }
      );
    }

    // Validate bulk upload limits
    const bulkValidation = validateBulkUpload(users);
    if (!bulkValidation.valid) {
      throw new CustomError(
        bulkValidation.error || 'Bulk upload validation failed',
        ErrorCodes.FILE_PROCESSING_ERROR,
        400,
        { 
          userCount: users.length,
          maxAllowed: 100 // From BULK_UPLOAD_LIMITS
        }
      );
    }

    // Validate organization data
    if (!organizationId?.trim()) {
      throw new CustomError(
        'Organization ID is required and must not be empty',
        ErrorCodes.VALIDATION_ERROR,
        400
      );
    }

    if (!organizationName?.trim()) {
      throw new CustomError(
        'Organization name is required and must not be empty',
        ErrorCodes.VALIDATION_ERROR,
        400
      );
    }

    const result: BulkUploadResult = {
      success: true,
      total: users.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Process each user with enhanced error handling
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      try {
        // Validate user data
        const validation = validateUser(user, i);
        if (!validation.valid) {
          result.failed++;
          result.errors.push({
            row: i + 1, // 1-based row numbers for user-friendly display
            user,
            error: validation.error || 'Validation failed',
          });
          continue;
        }

        // Create the contact with comprehensive error handling
        const createResult = await createContact(user, organizationId, organizationName);
        
        if (createResult.success) {
          result.successful++;
          console.log(`Successfully created contact: ${user.firstName} ${user.lastName} (${createResult.contactId})`);
        } else {
          result.failed++;
          result.errors.push({
            row: i + 1,
            user,
            error: createResult.error || 'Failed to create contact',
          });
          
          // Log individual user creation failure for debugging
          logError(new Error('User creation failed in bulk upload'), {
            user: { 
              firstName: user.firstName, 
              lastName: user.lastName, 
              email: user.email ? user.email.substring(0, 3) + '***' : undefined 
            },
            error: createResult.error,
            errorCode: createResult.errorCode,
            row: i + 1,
            requestId
          });
        }

        // Add delay to avoid rate limiting, with exponential backoff on errors
        if (i < users.length - 1) {
          const baseDelay = 100;
          const errorMultiplier = result.failed > 5 ? 2 : 1; // Slow down if many failures
          await new Promise(resolve => setTimeout(resolve, baseDelay * errorMultiplier));
        }
        
      } catch (unexpectedError: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          user,
          error: 'Unexpected error during processing',
        });
        
        logError(unexpectedError, {
          user: { firstName: user.firstName, lastName: user.lastName, email: user.email ? user.email.substring(0, 3) + '***' : undefined },
          row: i + 1,
          requestId
        });
      }
    }

    // Determine overall success (partial success is still considered success)
    const hasAnySuccess = result.successful > 0;
    const allSuccessful = result.failed === 0;
    result.success = hasAnySuccess;

    // Build comprehensive success message
    let message: string;
    if (allSuccessful) {
      message = `Bulk upload completed successfully. All ${result.successful} users created in organization "${organizationName}".`;
    } else if (hasAnySuccess) {
      message = `Bulk upload partially completed. ${result.successful} users created successfully, ${result.failed} failed in organization "${organizationName}".`;
    } else {
      message = `Bulk upload failed. No users were created. ${result.failed} users failed processing.`;
    }

    // Log bulk upload completion
    console.log(`Bulk upload completed for ${clientId}: ${result.successful}/${result.total} users created successfully`);

    return createSuccessResponse({
      ...result,
      requestId,
      processingDetails: {
        totalProcessed: result.total,
        successRate: result.total > 0 ? (result.successful / result.total * 100).toFixed(1) + '%' : '0%',
        hasErrors: result.failed > 0,
        errorSummary: result.errors.length > 0 ? {
          totalErrors: result.errors.length,
          commonErrors: getCommonErrors(result.errors)
        } : undefined
      }
    }, message, hasAnySuccess ? 200 : 207); // 207 Multi-Status for partial success

  } catch (error: any) {
    // Enhanced error logging with full context
    logError(error, {
      requestId,
      clientId,
      userAgent,
      bulkUploadContext: {
        userCount: body?.users?.length || 0,
        organizationId: body?.organizationId,
        organizationName: body?.organizationName,
      }
    });

    // Log failed bulk upload attempt
    if (body) {
      console.log(`Failed bulk upload attempt for ${clientId}: ${body.users?.length || 0} users - ${error.message}`);
    }

    // Handle CustomError instances
    if (error instanceof CustomError) {
      return createErrorResponse(error, requestId);
    }

    // Handle unexpected errors
    const unexpectedError = new CustomError(
      'An unexpected error occurred during bulk upload',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      { originalError: error.message, userCount: body?.users?.length || 0 }
    );

    return createErrorResponse(unexpectedError, requestId);
  }
}

// Helper function to analyze common errors
function getCommonErrors(errors: UploadError[]): { [key: string]: number } {
  const errorCounts: { [key: string]: number } = {};
  
  errors.forEach(error => {
    const errorType = error.error.toLowerCase();
    if (errorType.includes('email already exists') || errorType.includes('409')) {
      errorCounts['Duplicate emails'] = (errorCounts['Duplicate emails'] || 0) + 1;
    } else if (errorType.includes('invalid email')) {
      errorCounts['Invalid email format'] = (errorCounts['Invalid email format'] || 0) + 1;
    } else if (errorType.includes('required') || errorType.includes('missing')) {
      errorCounts['Missing required fields'] = (errorCounts['Missing required fields'] || 0) + 1;
    } else {
      errorCounts['Other errors'] = (errorCounts['Other errors'] || 0) + 1;
    }
  });
  
  return errorCounts;
}
