import { TRPCError } from '@trpc/server';
import type { AuthUser } from '../../../types/auth';
import { UserRole, UserStatus } from '../../../types/auth';

/**
 * Create authentication middleware factory
 */
export const createAuthMiddleware = (middleware: any) => {
  /**
   * Authentication middleware - requires valid JWT token
   */
  const requireAuth = middleware(({ ctx, next }: any) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
        cause: 'Missing or invalid JWT token'
      });
    }
    
    // Check if user is active
    if (ctx.user.status !== UserStatus.ACTIVE) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account is not active. Please contact support.',
        cause: `User status: ${ctx.user.status}`
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        user: ctx.user as AuthUser // Type assertion since we've verified it exists
      }
    });
  });

  /**
   * Role-based access control middleware
   */
  const requireRole = (allowedRoles: string[]) => {
    return middleware(({ ctx, next }: any) => {
      // First check authentication
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please log in.',
          cause: 'Missing or invalid JWT token'
        });
      }
      
      // Check if user is active
      if (ctx.user.status !== UserStatus.ACTIVE) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Account is not active. Please contact support.',
          cause: `User status: ${ctx.user.status}`
        });
      }
      
      // Check role authorization
      if (!allowedRoles.includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient permissions. Access denied.',
          cause: `Required roles: ${allowedRoles.join(', ')}, User role: ${ctx.user.role}`
        });
      }
      
      return next({
        ctx: {
          ...ctx,
          user: ctx.user as AuthUser
        }
      });
    });
  };

  /**
   * Admin-only middleware
   */
  const requireAdmin = requireRole([UserRole.ADMIN]);

  /**
   * Manager or Admin middleware
   */
  const requireManagerOrAdmin = requireRole([UserRole.ADMIN, UserRole.MANAGER]);

  /**
   * Any authenticated user middleware (but must be active)
   */
  const requireActiveUser = middleware(({ ctx, next }: any) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
        cause: 'Missing or invalid JWT token'
      });
    }
    
    // Check if user is active (but allow any role)
    if (ctx.user.status !== UserStatus.ACTIVE) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account is not active. Please contact support.',
        cause: `User status: ${ctx.user.status}`
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        user: ctx.user as AuthUser
      }
    });
  });

  /**
   * Email verification required middleware
   */
  const requireEmailVerification = middleware(({ ctx, next }: any) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
        cause: 'Missing or invalid JWT token'
      });
    }
    
    // Check if user is active
    if (ctx.user.status !== UserStatus.ACTIVE) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Account is not active. Please contact support.',
        cause: `User status: ${ctx.user.status}`
      });
    }

    // Check if email is verified
    if (!ctx.user.emailVerified) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Email verification required. Please verify your email address to access this feature.',
        cause: 'Email not verified'
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        user: ctx.user as AuthUser
      }
    });
  });

  /**
   * Optional authentication middleware - adds user to context if available
   */
  const optionalAuth = middleware(({ ctx, next }: any) => {
    // Don't throw errors, just pass through with whatever user context exists
    return next({
      ctx: {
        ...ctx,
        user: ctx.user || null
      }
    });
  });

  return {
    requireAuth,
    requireRole,
    requireAdmin,
    requireManagerOrAdmin,
    requireActiveUser,
    requireEmailVerification,
    optionalAuth
  };
};
