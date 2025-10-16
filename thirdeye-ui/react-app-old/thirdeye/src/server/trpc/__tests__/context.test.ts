import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createTRPCContext, createTestContext } from '../context';
import type { AuthUser, JWTPayload } from '../../../types/auth';
import { UserRole, UserStatus } from '../../../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

describe('tRPC Context', () => {
  describe('createTRPCContext', () => {
    it('should return context without user when no Authorization header', () => {
      const mockReq = {
        headers: {}
      } as any;

      const context = createTRPCContext({ req: mockReq });

      expect(context.user).toBeNull();
      expect(context.prisma).toBeDefined();
    });

    it('should return context without user when Authorization header is malformed', () => {
      const mockReq = {
        headers: {
          authorization: 'InvalidToken'
        }
      } as any;

      const context = createTRPCContext({ req: mockReq });

      expect(context.user).toBeNull();
      expect(context.prisma).toBeDefined();
    });

    it('should return context without user when JWT is invalid', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer invalid.jwt.token'
        }
      } as any;

      const context = createTRPCContext({ req: mockReq });

      expect(context.user).toBeNull();
      expect(context.prisma).toBeDefined();
    });

    it('should return context with user when valid JWT is provided', () => {
      const payload: JWTPayload = {
        userId: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
        status: UserStatus.ACTIVE
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as any;

      const context = createTRPCContext({ req: mockReq });

      expect(context.user).toBeDefined();
      expect(context.user?.id).toBe('123');
      expect(context.user?.email).toBe('test@example.com');
      expect(context.user?.name).toBe('Test User');
      expect(context.user?.role).toBe(UserRole.USER);
      expect(context.user?.status).toBe(UserStatus.ACTIVE);
    });

    it('should return context with user when Express middleware provides user', () => {
      const mockReq = {
        headers: {},
        user: {
          id: '456',
          email: 'express@example.com',
          name: 'Express User',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE
        }
      } as any;

      const context = createTRPCContext({ req: mockReq });

      expect(context.user).toBeDefined();
      expect(context.user?.id).toBe('456');
      expect(context.user?.email).toBe('express@example.com');
      expect(context.user?.name).toBe('Express User');
      expect(context.user?.role).toBe(UserRole.ADMIN);
      expect(context.user?.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('createTestContext', () => {
    it('should create context without user', () => {
      const context = createTestContext();

      expect(context.user).toBeNull();
      expect(context.prisma).toBeDefined();
    });

    it('should create context with provided user', () => {
      const testUser: AuthUser = {
        id: '789',
        email: 'test@example.com',
        role: UserRole.MANAGER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const context = createTestContext(testUser);

      expect(context.user).toEqual(testUser);
      expect(context.prisma).toBeDefined();
    });
  });
});
