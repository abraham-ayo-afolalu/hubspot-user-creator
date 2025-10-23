// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, number[]>();

// Rate limiting configuration
const RATE_LIMITS = {
  CREATE_USER: { requests: 5, windowMs: 60000 }, // 5 requests per minute
  BULK_UPLOAD: { requests: 2, windowMs: 300000 }, // 2 requests per 5 minutes
  SEARCH_ORG: { requests: 10, windowMs: 60000 }, // 10 requests per minute
};

export function checkRateLimit(key: string, action: keyof typeof RATE_LIMITS): { allowed: boolean; remaining: number } {
  const limit = RATE_LIMITS[action];
  const now = Date.now();
  const windowStart = now - limit.windowMs;
  
  // Get existing requests
  const requests = rateLimitStore.get(key) || [];
  
  // Filter out old requests
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  // Check if under limit
  const allowed = validRequests.length < limit.requests;
  
  if (allowed) {
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);
  }
  
  return {
    allowed,
    remaining: Math.max(0, limit.requests - validRequests.length - (allowed ? 1 : 0))
  };
}

// Input validation and sanitization
export function validateAndSanitizeInput(data: {
  firstName?: string;
  lastName?: string;
  email?: string;
  organizationName?: string;
}): { valid: boolean; errors: string[]; sanitizedData: typeof data } {
  const errors: string[] = [];
  const sanitizedData = { ...data };

  // Sanitize and validate first name
  if (data.firstName) {
    sanitizedData.firstName = data.firstName.trim().substring(0, 50);
    if (!/^[a-zA-Z\s'-]+$/.test(sanitizedData.firstName)) {
      errors.push('First name contains invalid characters');
    }
  }

  // Sanitize and validate last name
  if (data.lastName) {
    sanitizedData.lastName = data.lastName.trim().substring(0, 50);
    if (!/^[a-zA-Z\s'-]+$/.test(sanitizedData.lastName)) {
      errors.push('Last name contains invalid characters');
    }
  }

  // Sanitize and validate email
  if (data.email) {
    sanitizedData.email = data.email.trim().toLowerCase().substring(0, 254);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(sanitizedData.email)) {
      errors.push('Invalid email format');
    }
  }

  // Sanitize organization name
  if (data.organizationName) {
    sanitizedData.organizationName = data.organizationName.trim().substring(0, 100);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// Bulk upload limits
export const BULK_UPLOAD_LIMITS = {
  MAX_USERS: 100, // Maximum users per upload
  MAX_FILE_SIZE: 1024 * 1024, // 1MB max file size
};

export function validateBulkUpload(users: any[]): { valid: boolean; error?: string } {
  if (users.length > BULK_UPLOAD_LIMITS.MAX_USERS) {
    return {
      valid: false,
      error: `Too many users. Maximum allowed: ${BULK_UPLOAD_LIMITS.MAX_USERS}`
    };
  }

  return { valid: true };
}

// Error message sanitization
export function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b[A-Za-z0-9]{20,}\b/g, '[TOKEN]')
    .replace(/password|token|key|secret|api/gi, '[REDACTED]')
    .substring(0, 200); // Limit error message length
}

// Get client identifier (IP + User Agent hash)
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const userAgent = headers.get('user-agent') || '';
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  
  // Simple hash of user agent for additional uniqueness
  const uaHash = userAgent.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return `${ip}-${Math.abs(uaHash)}`;
}
