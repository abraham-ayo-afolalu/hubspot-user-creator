import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';
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
import { calculateStringSimilarity, normalizeCompanyName } from '@/lib/utils';
import { checkRateLimit, validateAndSanitizeInput, sanitizeErrorMessage, getClientIdentifier } from '@/lib/security';
import { AuditLogger } from '@/lib/audit';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

interface RequestBody {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  companyId?: string;
  companyName?: string;
}

interface Company {
  id: string;
  properties: {
    name: string;
    domain?: string;
  };
}

// Function to search for companies in HubSpot using basic API
async function searchCompanies(searchTerm: string): Promise<Company[]> {
  try {
    // Use the basic API to get companies and filter manually
    const apiResponse = await hubspotClient.crm.companies.basicApi.getPage(100, undefined, ['name', 'domain']);
    
    if (!apiResponse.results) return [];
    
    // Filter companies that contain the search term
    const filteredCompanies: Company[] = apiResponse.results
      .filter(result => {
        const name = result.properties?.name || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .map(result => ({
        id: result.id,
        properties: {
          name: result.properties?.name || '',
          domain: result.properties?.domain || undefined,
        },
      }))
      .slice(0, 10); // Limit to 10 results
    
    return filteredCompanies;
  } catch (error) {
    console.error('Error searching companies:', error);
    return [];
  }
}

// Function to find the best matching company using improved matching algorithm
function findBestMatch(companies: Company[], searchTerm: string): Company | null {
  if (companies.length === 0) return null;

  const normalizedSearch = normalizeCompanyName(searchTerm);
  let bestMatch = companies[0];
  let bestScore = 0;

  for (const company of companies) {
    const normalizedCompanyName = normalizeCompanyName(company.properties.name);
    
    // Calculate similarity score
    const similarity = calculateStringSimilarity(normalizedSearch, normalizedCompanyName);
    
    // Boost score for exact matches or if company name starts with search term
    let score = similarity;
    if (normalizedCompanyName === normalizedSearch) {
      score = 1.0; // Perfect match
    } else if (normalizedCompanyName.startsWith(normalizedSearch)) {
      score = Math.max(score, 0.9); // High score for prefix matches
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = company;
    }
  }

  // Only return a match if similarity is above threshold (60%)
  return bestScore >= 0.6 ? bestMatch : null;
}

// Function to create a contact in HubSpot and associate with company
async function createContact(firstName: string, lastName: string, email: string, companyId?: string, companyName?: string) {
  try {
    // Step 1: Create contact with minimal properties first to avoid automatic associations
    const basicContactProperties: any = {
      firstname: firstName,
      lastname: lastName,
      active_in_okta: 'yes',
      lifecyclestage: 'lead'
      // NOTE: Intentionally NOT including email in initial creation to prevent domain matching
    };

    console.log('Creating contact with basic properties (no email):', basicContactProperties);
    const apiResponse = await hubspotClient.crm.contacts.basicApi.create({
      properties: basicContactProperties
    });

    console.log('Contact created with ID:', apiResponse.id);

    // Step 2: Update the contact with email and company name after creation
    if (apiResponse.id) {
      console.log('Updating contact with email and company information...');
      
      const updateProperties: any = {
        email: email
      };

      // If we have a company name, set it on the contact for display in profile
      if (companyName) {
        updateProperties.company = companyName;
        console.log('Setting company name on contact:', companyName);
      }

      await hubspotClient.crm.contacts.basicApi.update(apiResponse.id, {
        properties: updateProperties
      });

      console.log('Contact updated successfully with email and company information');
    }
    
    // If we have a company ID, create the association
    if (companyId && apiResponse.id) {
      try {
        // Create association between contact and company using the associations API
        const associationRequest = {
          inputs: [
            {
              _from: { id: apiResponse.id },
              to: { id: companyId },
              type: 'contact_to_company'
            }
          ]
        };
        
        await hubspotClient.crm.associations.batchApi.create(
          'contacts',
          'companies', 
          associationRequest
        );
        console.log(`Successfully associated contact ${apiResponse.id} with company ${companyId}`);
      } catch (associationError: any) {
        console.error('Error creating company association:', associationError);
        // Log the association error but don't fail the entire operation
        console.error('Association error details:', associationError.response?.data || associationError.message);
      }
    } else {
      console.log('No manual company association requested');
    }
    
    return apiResponse;
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const clientId = getClientIdentifier(request.headers);
  const userAgent = request.headers.get('user-agent') || undefined;
  let body: RequestBody | undefined;
  
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
    const rateLimitResult = checkRateLimit(clientId, 'CREATE_USER');
    if (!rateLimitResult.allowed) {
      AuditLogger.logRateLimitExceeded(clientId, 'CREATE_USER', userAgent);
      throw new CustomError(
        'Too many requests. Please try again later.',
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

    const { firstName, lastName, email, organizationName, companyId: providedCompanyId, companyName: providedCompanyName } = body;

    // Validate required fields
    validateRequiredFields(body, ['firstName', 'lastName', 'email', 'organizationName']);
    
    // Validate email format
    validateEmail(email);

    // Validate and sanitize input
    const validation = validateAndSanitizeInput({
      firstName,
      lastName,
      email,
      organizationName,
    });

    if (!validation.valid) {
      AuditLogger.logValidationError(clientId, validation.errors, userAgent);
      throw new CustomError(
        `Validation failed: ${validation.errors.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR,
        400,
        { errors: validation.errors }
      );
    }

    // Use sanitized data
    const { firstName: cleanFirstName, lastName: cleanLastName, email: cleanEmail, organizationName: cleanOrgName } = validation.sanitizedData;

    let companyId: string | undefined = providedCompanyId;
    let companyName: string | undefined = providedCompanyName;

    // Company search and matching
    if (!companyId && cleanOrgName) {
      try {
        const companies = await searchCompanies(cleanOrgName);
        const bestMatch = findBestMatch(companies, cleanOrgName);

        if (bestMatch) {
          companyId = bestMatch.id;
          companyName = bestMatch.properties.name;
        }
      } catch (searchError) {
        logError(new Error('Company search failed'), { organizationName: cleanOrgName, requestId });
        // Continue without company association rather than failing
      }
    }

    // Create the contact
    let contact;
    try {
      contact = await createContact(cleanFirstName!, cleanLastName!, cleanEmail!, companyId, companyName);
    } catch (createError: any) {
      const hubspotError = handleHubSpotError(createError);
      
      // Log the failed creation
      AuditLogger.logUserCreation(
        clientId,
        { firstName: cleanFirstName!, lastName: cleanLastName!, email: cleanEmail! },
        companyName || cleanOrgName || 'Unknown',
        false,
        undefined,
        hubspotError.message,
        undefined,
        userAgent
      );
      
      throw hubspotError;
    }

    // Build success message
    let successMessage = `User "${cleanFirstName} ${cleanLastName}" created successfully.`;
    
    if (companyName) {
      successMessage += ` Associated with company "${companyName}".`;
    } else {
      successMessage += ' No matching organization found, user created without company association.';
    }

    // Log successful user creation
    AuditLogger.logUserCreation(
      clientId,
      { firstName: cleanFirstName!, lastName: cleanLastName!, email: cleanEmail! },
      companyName || cleanOrgName || 'Unknown',
      true,
      contact.id,
      undefined,
      undefined, // userId from SSO when available
      userAgent
    );

    return createSuccessResponse({
      contactId: contact.id,
      companyId: companyId,
      associatedCompany: companyName,
    }, successMessage, 201);

  } catch (error: any) {
    // Enhanced error logging with context
    logError(error, {
      requestId,
      clientId,
      userAgent,
      body: body ? {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ? body.email.substring(0, 3) + '***' : undefined, // Partial email for privacy
        organizationName: body.organizationName,
      } : undefined,
    });

    // Log failed user creation attempt if we have body data
    if (body) {
      AuditLogger.logUserCreation(
        clientId,
        { 
          firstName: body.firstName || 'Unknown', 
          lastName: body.lastName || 'Unknown', 
          email: body.email || 'Unknown' 
        },
        body.organizationName || 'Unknown',
        false,
        undefined,
        error.message,
        undefined,
        userAgent
      );
    }

    // Handle CustomError instances
    if (error instanceof CustomError) {
      return createErrorResponse(error, requestId);
    }

    // Handle unexpected errors
    const unexpectedError = new CustomError(
      'An unexpected error occurred while creating the user',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      { originalError: error.message }
    );

    return createErrorResponse(unexpectedError, requestId);
  }
}
