import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

// Simple admin credentials (for development only)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '111111';
const JWT_SECRET = new TextEncoder().encode('your-secret-key-change-in-production');

export interface AdminSession {
  username: string;
  isAuthenticated: boolean;
  loginTime: number;
}

// Verify admin credentials
export function verifyAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

// Create JWT token for admin session
export async function createAdminToken(username: string): Promise<string> {
  const token = await new SignJWT({ 
    username,
    isAuthenticated: true,
    loginTime: Date.now()
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h') // Token expires in 8 hours
    .sign(JWT_SECRET);

  return token;
}

// Verify JWT token and return session
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      username: payload.username as string,
      isAuthenticated: payload.isAuthenticated as boolean,
      loginTime: payload.loginTime as number,
    };
  } catch (error) {
    return null;
  }
}

// Check if request has valid admin authentication
export async function isAdminAuthenticated(request: NextRequest): Promise<AdminSession | null> {
  const token = request.cookies.get('admin-token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  return await verifyAdminToken(token);
}

// Helper to get admin session from request
export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  return await isAdminAuthenticated(request);
}
