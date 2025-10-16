import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password';
import { createTokenPair, rotateRefreshToken, revokeRefreshToken } from '../auth/tokens';
import { mailer } from '../services/mailer';
import { audit } from '../services/audit';
import type { AuthUser } from '../../types/auth';
import { UserRole, UserStatus } from '../../types/auth';

// Helper functions
async function signinHandler(input: { email: string; password: string }, ctx: any) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: input.email }
  });

  if (!user) {
    // Log failed login attempt
    await audit.signinFailure(input.email, 'User not found', {
      ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
      userAgent: ctx.req?.headers['user-agent']
    });

    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password'
    });
  }

  // Check if user is active
  if (user.status !== UserStatus.ACTIVE) {
    // Log failed login attempt due to inactive account
    await audit.signinFailure(input.email, `Account status: ${user.status}`, {
      ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
      userAgent: ctx.req?.headers['user-agent']
    });

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account is not active. Please contact support.'
    });
  }

  // Verify password
  if (!user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    // Increment failed login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: user.failedLoginAttempts + 1
      }
    });

    // Log failed login attempt
    await audit.signinFailure(input.email, 'Invalid password', {
      ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
      userAgent: ctx.req?.headers['user-agent']
    });

    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password'
    });
  }

  // Reset failed login attempts and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      lastLoginIp: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
    }
  });

  // Create token pair
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  const tokens = await createTokenPair(
    authUser,
    {
      userAgent: ctx.req?.headers['user-agent'],
      ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
    },
    ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
    ctx.req?.headers['user-agent']
  );

  // Log successful signin
  await audit.signinSuccess(user.id, user.email, {
    ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
    userAgent: ctx.req?.headers['user-agent']
  });

  return {
    success: true,
    user: authUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer'
  };
}

async function refreshHandler(input: { refreshToken: string }, ctx: any) {
  // Find the refresh token in database
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: input.refreshToken },
    include: { user: true }
  });

  if (!refreshTokenRecord || refreshTokenRecord.isRevoked) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired refresh token'
    });
  }

  // Check if token is expired
  if (refreshTokenRecord.expiresAt < new Date()) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Refresh token has expired'
    });
  }

  // Create auth user object
  const authUser: AuthUser = {
    id: refreshTokenRecord.user.id,
    email: refreshTokenRecord.user.email,
    name: refreshTokenRecord.user.name,
    role: refreshTokenRecord.user.role,
    status: refreshTokenRecord.user.status,
    emailVerified: refreshTokenRecord.user.emailVerified,
    lastLoginAt: refreshTokenRecord.user.lastLoginAt,
    lastLoginIp: refreshTokenRecord.user.lastLoginIp,
    twoFactorEnabled: refreshTokenRecord.user.twoFactorEnabled,
    createdAt: refreshTokenRecord.user.createdAt,
    updatedAt: refreshTokenRecord.user.updatedAt
  };

  // Rotate refresh token
  const tokens = await rotateRefreshToken(
    input.refreshToken,
    authUser,
    {
      userAgent: ctx.req?.headers['user-agent'],
      ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
    },
    ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
    ctx.req?.headers['user-agent']
  );

  // Log refresh token usage
  await audit.refreshToken(refreshTokenRecord.user.id, {
    ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
    userAgent: ctx.req?.headers['user-agent']
  });

  return {
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer'
  };
}

// Auth schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').optional(),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});


const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const authRouter: ReturnType<typeof router> = router({
  // Signup procedure
  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate password strength
        const passwordValidation = validatePasswordStrength(input.password);
        if (!passwordValidation.isValid) {
            throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Password does not meet requirements',
            cause: passwordValidation.errors
          });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: input.email }
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User with this email already exists'
          });
        }

        // Hash password
        const passwordHash = await hashPassword(input.password);

        // Create user
        const user = await prisma.user.create({
          data: {
          email: input.email,
            name: input.name || input.email.split('@')[0],
            passwordHash,
            role: UserRole.USER,
            status: UserStatus.PENDING_VERIFICATION, // Start as pending verification
            emailVerified: false
          }
        });

        // Generate email verification token
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenHash = await hashPassword(verificationToken);
        
        // Create verification token (expires in 24 hours)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            email: user.email,
            type: 'EMAIL_VERIFICATION',
            tokenHash: tokenHash,
            expiresAt: expiresAt,
            maxAttempts: 3
          }
        });

        // Send verification email
        await mailer.sendVerificationEmail(user.email, verificationToken);

        // Send welcome email
        await mailer.sendWelcomeEmail(user.email, user.name || user.email);

        // Log successful signup
        await audit.signup(user.id, user.email, {
          ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          userAgent: ctx.req?.headers['user-agent']
        });

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          },
          message: 'Account created successfully. Please check your email to verify your account.'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Signup error:', error);
          throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create account',
          cause: error
        });
      }
    }),

  // Signin procedure
  signin: publicProcedure
    .input(signinSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await signinHandler(input, ctx);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Signin error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication failed',
          cause: error
        });
      }
    }),

  // Refresh token procedure
  refresh: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await refreshHandler(input, ctx);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Refresh token error:', error);
          throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to refresh token',
          cause: error
        });
      }
    }),

  // Logout procedure
  logout: publicProcedure
    .input(logoutSchema)
    .mutation(async ({ input }) => {
      try {
        // Revoke the refresh token
        await revokeRefreshToken(input.refreshToken);

        return {
          success: true,
          message: 'Logged out successfully'
        };
      } catch (error) {
        console.error('Logout error:', error);
        // Always return success for logout to clear frontend session
        return {
          success: true,
          message: 'Logged out successfully'
        };
      }
    }),

  // Get current user procedure
  getCurrentUser: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
          message: 'User not authenticated'
          });
        }

        return {
          success: true,
        user: ctx.user
      };
    }),

  // Legacy login procedure (for backward compatibility)
  login: publicProcedure
    .input(signinSchema)
    .mutation(async ({ input, ctx }) => {
      // For backward compatibility, redirect to signin
      const signinResult = await signinHandler(input, ctx);
        return {
        success: signinResult.success,
        user: signinResult.user,
        accessToken: signinResult.accessToken,
        refreshToken: signinResult.refreshToken,
        tokenType: signinResult.tokenType
      };
    }),

  // Verify email procedure
  verifyEmail: publicProcedure
    .input(verifyEmailSchema)
    .mutation(async ({ input }) => {
      try {
        // Find the verification token
        const verificationToken = await prisma.verificationToken.findUnique({
          where: { tokenHash: input.token },
          include: { user: true }
        });

        if (!verificationToken) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invalid verification token'
          });
        }

        // Check if token is expired
        if (verificationToken.expiresAt < new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Verification token has expired'
          });
        }

        // Check if already verified
        if (verificationToken.verifiedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Email already verified'
          });
        }

        // Check attempts
        if (verificationToken.attempts >= verificationToken.maxAttempts) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Too many verification attempts. Please request a new verification email.'
          });
        }

        // Verify the email
        await prisma.$transaction(async (tx: any) => {
          // Update user email verification status and activate account
          await tx.user.update({
            where: { id: verificationToken.userId! },
            data: { 
              emailVerified: true,
              status: UserStatus.ACTIVE // Activate the account after email verification
            }
          });

          // Mark token as verified
          await tx.verificationToken.update({
            where: { id: verificationToken.id },
            data: {
              verifiedAt: new Date()
            }
          });
        });

        return {
          success: true,
          message: 'Email verified successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Email verification error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify email',
          cause: error
        });
      }
    }),

  // Request password reset procedure
  requestPasswordReset: publicProcedure
    .input(resetPasswordRequestSchema)
    .mutation(async ({ input }) => {
      try {
        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: input.email }
        });

        // Always return success to prevent email enumeration
        if (!user) {
          return {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
          };
        }

        // Check if user is active
        if (user.status !== UserStatus.ACTIVE) {
          return {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
          };
        }

        // Generate verification token for password reset
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenHash = await hashPassword(resetToken);
        
        // Create verification token (expires in 1 hour)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

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

        // Send password reset email
        await mailer.sendPasswordResetEmail(user.email, resetToken);

        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      } catch (error) {
        console.error('Password reset request error:', error);
        // Always return success to prevent email enumeration
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }
    }),

  // Reset password procedure
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input }) => {
      try {
        // Find the reset token
        const resetToken = await prisma.verificationToken.findUnique({
          where: { tokenHash: input.token },
          include: { user: true }
        });

        if (!resetToken) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invalid reset token'
          });
        }

        // Check if token is expired
        if (resetToken.expiresAt < new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Reset token has expired'
          });
        }

        // Check if already used
        if (resetToken.verifiedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Reset token has already been used'
          });
        }

        // Check attempts
        if (resetToken.attempts >= resetToken.maxAttempts) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Too many reset attempts. Please request a new password reset.'
          });
        }

        // Validate new password strength
        const passwordValidation = validatePasswordStrength(input.newPassword);
        if (!passwordValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Password does not meet requirements',
            cause: passwordValidation.errors
          });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(input.newPassword);

        // Reset password and revoke all refresh tokens
        await prisma.$transaction(async (tx: any) => {
          // Update user password
          await tx.user.update({
            where: { id: resetToken.userId! },
            data: { passwordHash: newPasswordHash }
          });

          // Mark token as used
          await tx.verificationToken.update({
            where: { id: resetToken.id },
            data: {
              verifiedAt: new Date()
            }
          });

          // Revoke all refresh tokens for this user
          await tx.refreshToken.updateMany({
            where: { 
              userId: resetToken.userId!,
              isRevoked: false 
            },
            data: {
              isRevoked: true,
              revokedAt: new Date()
            }
          });
        });

        // Send security alert email
        await mailer.sendSecurityAlertEmail(
          resetToken.user!.email,
          'Password Reset',
          'Your password has been successfully reset. All existing sessions have been logged out for security.'
        );

        return {
          success: true,
          message: 'Password reset successfully. Please log in with your new password.'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Password reset error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset password',
          cause: error
        });
      }
    }),

  // Legacy refresh token procedure (for backward compatibility)
  refreshToken: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ input, ctx }) => {
      // For backward compatibility, redirect to refresh
      const refreshResult = await refreshHandler(input, ctx);
          return {
        success: refreshResult.success,
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        tokenType: refreshResult.tokenType
      };
    }),
});
