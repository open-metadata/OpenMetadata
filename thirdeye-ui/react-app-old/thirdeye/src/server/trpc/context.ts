import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import * as jwt from 'jsonwebtoken';
// Removed unused import
// Removed unused import
import type { AuthUser, JWTPayload } from '../../types/auth';
import { UserRole, UserStatus } from '../../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export interface TRPCContext {
  prisma: typeof prisma;
  user?: AuthUser | null;
  req?: Request;
}

/**
 * Parse JWT token from Authorization header
 */
function parseJWTToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Verify JWT token and extract user information
 */
function verifyJWTToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Validate required fields
    if (!payload.userId || !payload.email) {
      return null;
    }
    
    return {
      id: payload.userId,
      email: payload.email,
      name: payload.name || null,
      role: payload.role || UserRole.USER,
      status: payload.status || UserStatus.ACTIVE,
      emailVerified: payload.emailVerified || false,
      lastLoginAt: null,
      lastLoginIp: null,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Create tRPC context with authentication
 */
export const createTRPCContext = (opts?: { req?: Request }): TRPCContext => {
  const { req } = opts || {};
  
  let user: AuthUser | null = null;
  
  if (req) {
    // Extract Authorization header
    const authHeader = req.headers.authorization;
    const token = parseJWTToken(authHeader);
    
    if (token) {
      user = verifyJWTToken(token);
    }
    
    // If JWT verification failed but we have a user from Express middleware, use it
    if (!user && req.user) {
      user = {
        id: req.user.id || req.user.userId,
        email: req.user.email,
        name: req.user.name || null,
        role: req.user.role || UserRole.USER,
        status: req.user.status || UserStatus.ACTIVE,
        emailVerified: req.user.emailVerified || false,
        lastLoginAt: req.user.lastLoginAt || null,
        lastLoginIp: req.user.lastLoginIp || null,
        twoFactorEnabled: req.user.twoFactorEnabled || false,
        createdAt: req.user.createdAt || new Date(),
        updatedAt: req.user.updatedAt || new Date()
      };
    }
  }
  
  return {
    prisma,
    user,
    req
  };
};

/**
 * Create context for testing or server-side usage
 */
export const createTestContext = (user?: AuthUser): TRPCContext => {
  return {
    prisma,
    user: user || null
  };
};
