import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../lib/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import { createAuditLog } from '../services/audit-logger';

// Admin-only middleware
const requireAdmin = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }

  if (ctx.user.role !== UserRole.ADMIN) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }

  return next({
    ctx: {
      ...ctx,
      admin: ctx.user
    }
  });
});

// Schemas
const userListSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sortBy: z.enum(['email', 'name', 'createdAt', 'lastLoginAt', 'role', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
  reason: z.string().min(1, 'Reason is required for role changes')
});

const setStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.nativeEnum(UserStatus),
  reason: z.string().min(1, 'Reason is required for status changes'),
  lockUntil: z.date().optional() // For temporary locks
});

const userDetailsSchema = z.object({
  userId: z.string().min(1)
});

export const adminUsersRouter = router({
  // List users with search, filtering, and pagination
  listUsers: requireAdmin
    .input(userListSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { page, limit, search, role, status, sortBy, sortOrder } = input;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (search) {
          where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } }
          ];
        }

        if (role) {
          where.role = role;
        }

        if (status) {
          where.status = status;
        }

        // Execute queries in parallel
        const [users, totalCount] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
              emailVerified: true,
              lastLoginAt: true,
              lastLoginIp: true,
              failedLoginAttempts: true,
              lockedUntil: true,
              twoFactorEnabled: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              // Count related records
              _count: {
                select: {
                  refreshTokens: true,
                  verificationTokens: true,
                  oauthAccounts: true,
                  auditLogs: true
                }
              }
            }
          }),
          prisma.user.count({ where })
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return {
          success: true,
          data: {
            users,
            pagination: {
              page,
              limit,
              totalCount,
              totalPages,
              hasNextPage,
              hasPrevPage
            }
          }
        };
      } catch (error) {
        console.error('Admin list users error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch users',
          cause: error
        });
      }
    }),

  // Get detailed user information
  getUserDetails: requireAdmin
    .input(userDetailsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: input.userId },
          include: {
            refreshTokens: {
              select: {
                id: true,
                isRevoked: true,
                expiresAt: true,
                createdAt: true,
                lastUsedAt: true,
                deviceInfo: true
              },
              orderBy: { createdAt: 'desc' },
              take: 10 // Last 10 tokens
            },
            verificationTokens: {
              select: {
                id: true,
                type: true,
                verifiedAt: true,
                expiresAt: true,
                attempts: true,
                maxAttempts: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' }
            },
            oauthAccounts: {
              select: {
                id: true,
                provider: true,
                providerAccountId: true,
                type: true,
                createdAt: true,
                updatedAt: true
              }
            },
            auditLogs: {
              select: {
                id: true,
                action: true,
                details: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 20 // Last 20 audit logs
            }
          }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }

        return {
          success: true,
          data: { user }
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Admin get user details error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user details',
          cause: error
        });
      }
    }),

  // Set user role
  setUserRole: requireAdmin
    .input(setRoleSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, role, reason } = input;

        // Check if user exists
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }

        // Prevent self-demotion
        if (userId === ctx.admin.id && role !== UserRole.ADMIN) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot change your own admin role'
          });
        }

        // Update user role
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { role }
        });

        // Create audit log
        await createAuditLog({
          userId: ctx.admin.id,
          action: 'USER_ROLE_CHANGED',
          details: {
            targetUserId: userId,
            targetUserEmail: user.email,
            oldRole: user.role,
            newRole: role,
            reason
          },
          ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          userAgent: ctx.req?.headers['user-agent']
        });

        return {
          success: true,
          message: `User role updated to ${role}`,
          data: { user: updatedUser }
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Admin set user role error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user role',
          cause: error
        });
      }
    }),

  // Set user status (lock/unlock/activate/suspend)
  setUserStatus: requireAdmin
    .input(setStatusSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, status, reason, lockUntil } = input;

        // Check if user exists
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }

        // Prevent self-lockout
        if (userId === ctx.admin.id && status !== UserStatus.ACTIVE) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot lock or suspend your own account'
          });
        }

        // Prepare update data
        const updateData: any = { status };

        // Handle locking with expiration
        if (status === UserStatus.SUSPENDED && lockUntil) {
          updateData.lockedUntil = lockUntil;
        } else if (status === UserStatus.ACTIVE) {
          updateData.lockedUntil = null;
          updateData.failedLoginAttempts = 0; // Reset failed attempts
        }

        // Update user status
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: updateData
        });

        // If user is being locked/suspended, revoke all their refresh tokens
        if (status !== UserStatus.ACTIVE) {
          await prisma.refreshToken.updateMany({
            where: { userId },
            data: {
              isRevoked: true,
              revokedAt: new Date()
            }
          });
        }

        // Create audit log
        await createAuditLog({
          userId: ctx.admin.id,
          action: 'USER_STATUS_CHANGED',
          details: {
            targetUserId: userId,
            targetUserEmail: user.email,
            oldStatus: user.status,
            newStatus: status,
            reason,
            lockUntil: lockUntil?.toISOString()
          },
          ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          userAgent: ctx.req?.headers['user-agent']
        });

        return {
          success: true,
          message: `User status updated to ${status}`,
          data: { user: updatedUser }
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Admin set user status error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status',
          cause: error
        });
      }
    }),

  // Reset user password (admin can force password reset)
  resetUserPassword: requireAdmin
    .input(z.object({
      userId: z.string().min(1),
      reason: z.string().min(1, 'Reason is required for password resets')
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, reason } = input;

        // Check if user exists
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }

        // Generate verification token for password reset
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenHash = await require('../auth/password').hashPassword(resetToken);
        
        // Create verification token (expires in 24 hours)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            email: user.email,
            type: 'PASSWORD_RESET',
            tokenHash: tokenHash,
            expiresAt: expiresAt,
            maxAttempts: 3
          }
        });

        // Revoke all refresh tokens
        await prisma.refreshToken.updateMany({
          where: { userId },
          data: {
            isRevoked: true,
            revokedAt: new Date()
          }
        });

        // Create audit log
        await createAuditLog({
          userId: ctx.admin.id,
          action: 'USER_PASSWORD_RESET',
          details: {
            targetUserId: userId,
            targetUserEmail: user.email,
            reason
          },
          ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          userAgent: ctx.req?.headers['user-agent']
        });

        return {
          success: true,
          message: 'Password reset initiated. User will receive an email with reset instructions.',
          data: { resetToken } // In production, this would be sent via email
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Admin reset user password error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset user password',
          cause: error
        });
      }
    }),

  // Get user statistics
  getUserStats: requireAdmin
    .query(async ({ ctx }) => {
      try {
        const [
          totalUsers,
          activeUsers,
          inactiveUsers,
          suspendedUsers,
          pendingUsers,
          deletedUsers,
          adminUsers,
          usersByRole,
          recentRegistrations,
          recentLogins
        ] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
          prisma.user.count({ where: { status: UserStatus.INACTIVE } }),
          prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
          prisma.user.count({ where: { status: UserStatus.PENDING_VERIFICATION } }),
          prisma.user.count({ where: { status: UserStatus.DELETED } }),
          prisma.user.count({ where: { role: UserRole.ADMIN } }),
          prisma.user.groupBy({
            by: ['role'],
            _count: { role: true }
          }),
          prisma.user.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          }),
          prisma.user.count({
            where: {
              lastLoginAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          })
        ]);

        return {
          success: true,
          data: {
            totalUsers,
            activeUsers,
            inactiveUsers,
            suspendedUsers,
            pendingUsers,
            deletedUsers,
            adminUsers,
            usersByRole,
            recentRegistrations,
            recentLogins
          }
        };
      } catch (error) {
        console.error('Admin get user stats error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user statistics',
          cause: error
        });
      }
    })
});
