import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createAuthMiddleware } from '../middleware/auth';
import type { AuthUser } from '../../../types/auth';
import { UserRole, UserStatus } from '../../../types/auth';

// Mock middleware function
const mockMiddleware = vi.fn((fn) => fn);

describe('Authentication Middleware', () => {
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();
    authMiddleware = createAuthMiddleware(mockMiddleware);
  });

  describe('requireAuth', () => {
    it('should throw UNAUTHORIZED when no user is present', async () => {
      const mockCtx = {
        user: null,
        prisma: {} as any
      };

      const mockNext = vi.fn();

      await expect(
        authMiddleware.requireAuth({
          ctx: mockCtx,
          next: mockNext
        } as any)
      ).rejects.toThrow(TRPCError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN when user is not active', async () => {
      const inactiveUser: AuthUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCtx = {
        user: inactiveUser,
        prisma: {} as any
      };

      const mockNext = vi.fn();

      await expect(
        authMiddleware.requireAuth({
          ctx: mockCtx,
          next: mockNext
        } as any)
      ).rejects.toThrow(TRPCError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should proceed when user is active', async () => {
      const activeUser: AuthUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCtx = {
        user: activeUser,
        prisma: {} as any
      };

      const mockNext = vi.fn().mockResolvedValue('success');

      const result = await authMiddleware.requireAuth({
        ctx: mockCtx,
        next: mockNext
      } as any);

      expect(mockNext).toHaveBeenCalledWith({
        ctx: {
          ...mockCtx,
          user: activeUser
        }
      });
      expect(result).toBe('success');
    });
  });

  describe('requireRole', () => {
    it('should throw UNAUTHORIZED when no user is present', async () => {
      const requireAdmin = authMiddleware.requireRole([UserRole.ADMIN]);

      const mockCtx = {
        user: null,
        prisma: {} as any
      };

      const mockNext = vi.fn();

      await expect(
        requireAdmin({
          ctx: mockCtx,
          next: mockNext
        } as any)
      ).rejects.toThrow(TRPCError);
    });

    it('should throw FORBIDDEN when user does not have required role', async () => {
      const requireAdmin = authMiddleware.requireRole([UserRole.ADMIN]);

      const regularUser: AuthUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCtx = {
        user: regularUser,
        prisma: {} as any
      };

      const mockNext = vi.fn();

      await expect(
        requireAdmin({
          ctx: mockCtx,
          next: mockNext
        } as any)
      ).rejects.toThrow(TRPCError);
    });

    it('should proceed when user has required role', async () => {
      const requireAdmin = authMiddleware.requireRole([UserRole.ADMIN]);

      const adminUser: AuthUser = {
        id: '1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCtx = {
        user: adminUser,
        prisma: {} as any
      };

      const mockNext = vi.fn().mockResolvedValue('success');

      const result = await requireAdmin({
        ctx: mockCtx,
        next: mockNext
      } as any);

      expect(mockNext).toHaveBeenCalledWith({
        ctx: {
          ...mockCtx,
          user: adminUser
        }
      });
      expect(result).toBe('success');
    });
  });

  describe('optionalAuth', () => {
    it('should proceed without user', async () => {
      const mockCtx = {
        user: null,
        prisma: {} as any
      };

      const mockNext = vi.fn().mockResolvedValue('success');

      const result = await authMiddleware.optionalAuth({
        ctx: mockCtx,
        next: mockNext
      } as any);

      expect(mockNext).toHaveBeenCalledWith({
        ctx: {
          ...mockCtx,
          user: null
        }
      });
      expect(result).toBe('success');
    });

    it('should proceed with user', async () => {
      const activeUser: AuthUser = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCtx = {
        user: activeUser,
        prisma: {} as any
      };

      const mockNext = vi.fn().mockResolvedValue('success');

      const result = await authMiddleware.optionalAuth({
        ctx: mockCtx,
        next: mockNext
      } as any);

      expect(mockNext).toHaveBeenCalledWith({
        ctx: {
          ...mockCtx,
          user: activeUser
        }
      });
      expect(result).toBe('success');
    });
  });
});
