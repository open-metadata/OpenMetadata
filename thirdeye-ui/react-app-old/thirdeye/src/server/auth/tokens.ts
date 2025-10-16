import { prisma } from '../../lib/prisma';
import { TRPCError } from '@trpc/server';
import type { AuthUser } from '../../types/auth';
import { UserStatus } from '@prisma/client';
import { generateJWTId, signAccessToken, signRefreshToken, verifyRefreshToken, extractJWTId } from './jwt';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}

/**
 * Store a new refresh token in the database
 */
export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  deviceInfo?: DeviceInfo,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.refreshToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
          deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : undefined,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('Error storing refresh token:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to store refresh token',
      cause: error
    });
  }
}

/**
 * Create a new token pair (access + refresh)
 */
export async function createTokenPair(
  user: AuthUser,
  deviceInfo?: DeviceInfo,
  ipAddress?: string,
  userAgent?: string
): Promise<TokenPair> {
  try {
    // Generate unique JWT ID for rotation
    const jti = generateJWTId();
    
    // Create tokens
    const accessToken = signAccessToken(user, jti);
    const refreshToken = signRefreshToken(user, jti);
    
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Store refresh token in database
    await storeRefreshToken(
      user.id,
      refreshToken, // In production, you'd hash this
      expiresAt,
      deviceInfo,
      ipAddress,
      userAgent
    );
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  } catch (error) {
    console.error('Error creating token pair:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create authentication tokens',
      cause: error
    });
  }
}

/**
 * Rotate refresh token (invalidate old, create new)
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  user: AuthUser,
  deviceInfo?: DeviceInfo,
  ipAddress?: string,
  userAgent?: string
): Promise<TokenPair> {
  try {
    // Verify the old refresh token
    verifyRefreshToken(oldRefreshToken);
    
    // Check if user is still active
    if (user.status !== UserStatus.ACTIVE) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account is not active',
        cause: 'USER_INACTIVE'
      });
    }
    
    // Revoke the old refresh token
    await revokeRefreshToken(oldRefreshToken);
    
    // Create new token pair
    return await createTokenPair(user, deviceInfo, ipAddress, userAgent);
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    console.error('Error rotating refresh token:', error);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Failed to rotate refresh token',
      cause: error
    });
  }
}

/**
 * Revoke a refresh token by JWT ID or token hash
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    // Extract JWT ID from token
    const jti = extractJWTId(refreshToken);
    
    if (!jti) {
      throw new Error('Invalid refresh token format');
    }
    
    // Mark token as revoked in database
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: refreshToken, // In production, you'd hash this for lookup
        isRevoked: false
      },
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to revoke refresh token',
      cause: error
    });
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: {
        isRevoked: true,
        revokedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error revoking all user tokens:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to revoke user tokens',
      cause: error
    });
  }
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 24 hours ago
        ]
      }
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
}

/**
 * Get active refresh tokens for a user
 */
export async function getUserActiveTokens(userId: string): Promise<any[]> {
  try {
    return await prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        deviceInfo: true,
        ipAddress: true,
        userAgent: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error) {
    console.error('Error getting user active tokens:', error);
    return [];
  }
}

/**
 * Update last used timestamp for a refresh token
 */
export async function updateTokenLastUsed(tokenHash: string): Promise<void> {
  try {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        isRevoked: false
      },
      data: {
        lastUsedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating token last used:', error);
    // Don't throw error for this - it's not critical
  }
}
