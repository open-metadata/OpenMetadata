import jwt from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import type { AuthUser, UserRole, UserStatus, JWTPayload } from '../../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface AccessTokenPayload extends JWTPayload {
  type: 'access';
  jti?: string; // JWT ID for refresh token rotation
}

export interface RefreshTokenPayload {
  type: 'refresh';
  userId: string;
  jti: string; // JWT ID for rotation tracking
  email: string;
  role: UserRole;
  status: UserStatus;
  iat?: number;
  exp?: number;
}

/**
 * Sign an access token
 */
export function signAccessToken(user: AuthUser, jti?: string): string {
  try {
    const payload: AccessTokenPayload = {
      type: 'access',
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified || false,
      jti
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'thirdeye',
      audience: 'thirdeye-client'
    } as jwt.SignOptions);
  } catch (error) {
    console.error('Error signing access token:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create access token',
      cause: error
    });
  }
}

/**
 * Sign a refresh token
 */
export function signRefreshToken(user: AuthUser, jti: string): string {
  try {
    const payload: RefreshTokenPayload = {
      type: 'refresh',
      userId: user.id,
      jti,
      email: user.email,
      role: user.role,
      status: user.status
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'thirdeye',
      audience: 'thirdeye-client'
    } as jwt.SignOptions);
  } catch (error) {
    console.error('Error signing refresh token:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create refresh token',
      cause: error
    });
  }
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'thirdeye',
      audience: 'thirdeye-client'
    }) as AccessTokenPayload;

    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Access token has expired',
        cause: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid access token',
        cause: 'TOKEN_INVALID'
      });
    }
    
    console.error('Error verifying access token:', error);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Failed to verify access token',
      cause: error
    });
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'thirdeye',
      audience: 'thirdeye-client'
    }) as RefreshTokenPayload;

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Refresh token has expired',
        cause: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token',
        cause: 'TOKEN_INVALID'
      });
    }
    
    console.error('Error verifying refresh token:', error);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Failed to verify refresh token',
      cause: error
    });
  }
}

/**
 * Generate a unique JWT ID for token rotation
 */
export function generateJWTId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

/**
 * Extract JWT ID from token without verification (for logging/cleanup)
 */
export function extractJWTId(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as any;
    return decoded?.jti || null;
  } catch (error) {
    return null;
  }
}
