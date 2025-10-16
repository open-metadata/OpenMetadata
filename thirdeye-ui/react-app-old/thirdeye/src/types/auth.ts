/**
 * Shared authentication types for the ThirdEye application
 */

import { UserRole, UserStatus, OAuthProvider } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified?: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  twoFactorEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export Prisma enums for convenience
export { UserRole, UserStatus, OAuthProvider };

export interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  user?: AuthUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isActive: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR';
  message: string;
  details?: any;
}
