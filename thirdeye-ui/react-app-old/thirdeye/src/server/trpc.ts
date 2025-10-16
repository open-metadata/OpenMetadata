import { initTRPC } from '@trpc/server';
import type { TRPCContext } from './trpc/context';

// Extend Express Request type to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
  }
}

// Export context creation function
export { createTRPCContext } from './trpc/context';
export type { TRPCContext } from './trpc/context';
export type { AuthUser } from '../types/auth';

// Initialize tRPC with proper context
const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        cause: error.cause,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

// Base procedures
export const publicProcedure = t.procedure;

// Import auth middleware factory
import { createAuthMiddleware } from './trpc/middleware/auth';

// Create auth middleware instances
const authMiddleware = createAuthMiddleware(middleware);

// Protected procedures
export const protectedProcedure = t.procedure.use(authMiddleware.requireAuth);
export const verifiedUserProcedure = t.procedure.use(authMiddleware.requireEmailVerification);
export const adminProcedure = t.procedure.use(authMiddleware.requireAdmin);
export const managerProcedure = t.procedure.use(authMiddleware.requireManagerOrAdmin);
export const userProcedure = t.procedure.use(authMiddleware.requireActiveUser);
export const optionalAuthProcedure = t.procedure.use(authMiddleware.optionalAuth);

// Utility function to create role-based procedures
export const createRoleProcedure = (roles: string[]) => t.procedure.use(authMiddleware.requireRole(roles));
