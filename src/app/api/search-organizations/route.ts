import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';
import { calculateStringSimilarity, normalizeCompanyName } from '@/lib/utils';
import { 
  CustomError, 
  ErrorCodes, 
  handleHubSpotError, 
  createErrorResponse, 
  createSuccessResponse,
  validateRequiredFields,
  logError
} from '@/lib/errorHandler';
import { checkRateLimit, getClientIdentifier } from '@/lib/security';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

interface Company {
  id: string;
  properties: {
    name: string;
    domain?: string;
  };
  similarity?: number;
}

// Function to search for companies in HubSpot using basic API
async function searchCompanies(searchTerm: string): Promise<Company[]> {
  if (!searchTerm?.trim()) {
    throw new CustomError(
      'Search term is required and cannot be empty',
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  if (searchTerm.trim().length < 2) {
    throw new CustomError(
      'Search term must be at least 2 characters long',
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  try {
    // Use the basic API to get companies and filter manually
    const apiResponse = await hubspotClient.crm.companies.basicApi.getPage(100, undefined, ['name', 'domain']);
    
    if (!apiResponse || !apiResponse.results) {
      logError(new Error('No companies found in HubSpot response'), { searchTerm });
      return [];
    }
    
    // Get all companies and map them first
    const allCompanies: Company[] = apiResponse.results
      .filter(result => result.id && result.properties?.name) // Ensure valid data
      .map(result => ({
        id: result.id,
        properties: {
          name: result.properties!.name!.trim(),
          domain: result.properties?.domain?.trim() || undefined,
        },
      }));
    
    if (allCompanies.length === 0) {
      logError(new Error('No valid companies found in HubSpot'), { 
        searchTerm,
        totalResults: apiResponse.results.length 
      });
      return [];
    }
    
    // Use more restrictive filtering - focus on meaningful matches
    const normalizedSearch = normalizeCompanyName(searchTerm);
    const searchWords = normalizedSearch.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    if (searchWords.length === 0) {
      throw new CustomError(
        'Search term must contain meaningful words (at least 3 characters)',
        ErrorCodes.VALIDATION_ERROR,
        400
      );
    }
    
    const candidateCompanies = allCompanies.filter(company => {
      try {
        const normalizedCompanyName = normalizeCompanyName(company.properties.name);
        const companyWords = normalizedCompanyName.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        
        // Only include if there's a meaningful word overlap or strong similarity
        const hasWordOverlap = searchWords.some(searchWord => 
          companyWords.some(companyWord => 
            companyWord.includes(searchWord) || searchWord.includes(companyWord)
          )
        );
        
        // Or if the company name contains the search term (for exact/partial matches)
        const directMatch = normalizedCompanyName.toLowerCase().includes(normalizedSearch.toLowerCase()) ||
                           normalizedSearch.toLowerCase().includes(normalizedCompanyName.toLowerCase());
        
        // Only consider companies with high similarity (> 0.5) if no word overlap
        const similarity = calculateStringSimilarity(normalizedSearch, normalizedCompanyName);
        const highSimilarity = similarity > 0.5;
        
        return hasWordOverlap || directMatch || highSimilarity;
      } catch (filterError) {
        logError(filterError as Error, { 
          companyId: company.id, 
          companyName: company.properties.name,
          searchTerm 
        });
        return false; // Exclude companies that cause filtering errors
      }
    });
    
    return candidateCompanies.slice(0, 20); // Get more candidates for ranking
  } catch (error: any) {
    const hubspotError = handleHubSpotError(error);
    logError(hubspotError, { searchTerm, operation: 'searchCompanies' });
    throw hubspotError;
  }
}

// Function to rank companies by similarity
function rankCompaniesBySimilarity(companies: Company[], searchTerm: string): Company[] {
  const normalizedSearch = normalizeCompanyName(searchTerm);
  
  const rankedCompanies = companies.map(company => {
    const normalizedCompanyName = normalizeCompanyName(company.properties.name);
    const similarity = calculateStringSimilarity(normalizedSearch, normalizedCompanyName);
    
    // Boost score for exact matches or prefix matches
    let score = similarity;
    if (normalizedCompanyName === normalizedSearch) {
      score = 1.0;
    } else if (normalizedCompanyName.startsWith(normalizedSearch)) {
      score = Math.max(score, 0.9);
    }
    
    return {
      ...company,
      similarity: score,
    };
  });
  
  // Sort by similarity score (highest first) and filter out low scores
  return rankedCompanies
    .filter(company => company.similarity! >= 0.6) // Show matches with at least 60% similarity
    .sort((a, b) => b.similarity! - a.similarity!)
    .slice(0, 5); // Show top 5 matches
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  const clientId = getClientIdentifier(request.headers);
  const userAgent = request.headers.get('user-agent') || undefined;
  let organizationName: string | undefined;
  
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
    const rateLimitResult = checkRateLimit(clientId, 'SEARCH_ORG');
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for ${clientId} - SEARCH_ORG`);
      throw new CustomError(
        'Too many search requests. Please try again later.',
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        429,
        { remaining: rateLimitResult.remaining }
      );
    }

    // Parse and validate request body
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

    if (!body) {
      throw new CustomError(
        'Request body is required',
        ErrorCodes.INVALID_REQUEST,
        400
      );
    }

    // Validate required fields
    validateRequiredFields(body, ['organizationName']);
    
    organizationName = body.organizationName;

    if (!organizationName?.trim()) {
      throw new CustomError(
        'Organization name is required and cannot be empty',
        ErrorCodes.VALIDATION_ERROR,
        400
      );
    }

    // Trim and validate the search term
    organizationName = organizationName.trim();

    if (organizationName.length > 100) {
      throw new CustomError(
        'Organization name is too long (maximum 100 characters)',
        ErrorCodes.VALIDATION_ERROR,
        400,
        { length: organizationName.length }
      );
    }

    // Search for companies with enhanced error handling
    let companies: Company[];
    try {
      companies = await searchCompanies(organizationName);
      console.log(`Found ${companies.length} candidate companies for "${organizationName}"`);
    } catch (searchError: any) {
      // If it's already a CustomError, re-throw it
      if (searchError instanceof CustomError) {
        throw searchError;
      }
      
      // Otherwise, handle as HubSpot API error
      const hubspotError = handleHubSpotError(searchError);
      throw hubspotError;
    }

    // Rank companies by similarity with error handling
    let rankedCompanies: Company[];
    try {
      rankedCompanies = rankCompaniesBySimilarity(companies, organizationName);
      console.log(`Ranked to ${rankedCompanies.length} matches:`, 
        rankedCompanies.map(c => `${c.properties.name} (${Math.round((c.similarity || 0) * 100)}%)`));
    } catch (rankingError) {
      logError(rankingError as Error, { 
        organizationName,
        companiesCount: companies.length,
        requestId 
      });
      
      // Fall back to unranked results
      rankedCompanies = companies.slice(0, 5);
    }

    // Log successful organization search
    console.log(`Organization search for ${clientId}: "${organizationName}" - found ${rankedCompanies.length} matches`);

    return createSuccessResponse({
      matches: rankedCompanies,
      searchTerm: organizationName,
      totalCandidates: companies.length,
      filteredMatches: rankedCompanies.length,
      requestId,
      searchDetails: {
        hasExactMatch: rankedCompanies.some(c => c.similarity === 1.0),
        hasHighConfidenceMatches: rankedCompanies.some(c => (c.similarity || 0) >= 0.9),
        averageConfidence: rankedCompanies.length > 0 
          ? ((rankedCompanies.reduce((sum, c) => sum + (c.similarity || 0), 0) / rankedCompanies.length) * 100).toFixed(1) + '%'
          : '0%'
      }
    }, `Found ${rankedCompanies.length} matching organizations for "${organizationName}"`);

  } catch (error: any) {
    // Enhanced error logging with context
    logError(error, {
      requestId,
      clientId,
      userAgent,
      searchContext: {
        organizationName: organizationName ? organizationName.substring(0, 20) + (organizationName.length > 20 ? '...' : '') : undefined,
      }
    });

    // Handle CustomError instances
    if (error instanceof CustomError) {
      return createErrorResponse(error, requestId);
    }

    // Handle unexpected errors
    const unexpectedError = new CustomError(
      'An unexpected error occurred while searching organizations',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      { originalError: error.message }
    );

    return createErrorResponse(unexpectedError, requestId);
  }
}
