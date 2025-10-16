import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password';
import { revokeAllUserTokens } from '../auth/tokens';
import { mailer } from '../services/mailer';
import type { AuthUser } from '../../types/auth';
import { UserRole, UserStatus } from '../../types/auth';

// User schemas
const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  bio: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const userRouter = router({
  // Get current user profile
  me: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            emailVerified: true,
            lastLoginAt: true,
            lastLoginIp: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true
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
          user
        };
      } catch (error) {
        console.error('Get user profile error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user profile',
          cause: error
        });
      }
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Check if email is being changed
        if (input.email && input.email !== ctx.user.email) {
          // Check if new email is already taken
          const existingUser = await prisma.user.findUnique({
            where: { email: input.email }
          });

          if (existingUser) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Email address is already in use'
            });
          }

          // For email changes, we'll handle this in a separate endpoint
          // that requires email verification
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Email changes require verification. Please use the change email endpoint.'
          });
        }

        // Update user profile
        const updatedUser = await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            name: input.name,
            // email: input.email, // Handled separately for security
            updatedAt: new Date()
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            emailVerified: true,
            lastLoginAt: true,
            lastLoginIp: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true
          }
        });

        return {
          success: true,
          user: updatedUser
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Update profile error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile',
          cause: error
        });
      }
    }),

  // Change password
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Get current user with password hash
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id }
        });

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or no password set'
          });
        }

        // Verify current password
        if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Current password is incorrect'
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

        // Update password and revoke all refresh tokens for security
        await prisma.$transaction(async (tx: any) => {
          // Update password
          await tx.user.update({
            where: { id: ctx.user.id },
            data: { 
              passwordHash: newPasswordHash,
              updatedAt: new Date()
            }
          });

          // Revoke all refresh tokens for this user
          await tx.refreshToken.updateMany({
            where: { 
              userId: ctx.user.id,
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
          user.email,
          'Password Changed',
          'Your password has been successfully changed. All existing sessions have been logged out for security.'
        );

        return {
          success: true,
          message: 'Password changed successfully. All sessions have been logged out for security.'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Change password error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to change password',
          cause: error
        });
      }
    }),

  // Change email address
  changeEmail: protectedProcedure
    .input(changeEmailSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Check if new email is already taken
        const existingUser = await prisma.user.findUnique({
          where: { email: input.newEmail }
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email address is already in use'
          });
        }

        // Get current user with password hash
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id }
        });

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or no password set'
          });
        }

        // Verify current password
        if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Current password is incorrect'
          });
        }

        // Generate email change verification token
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenHash = await hashPassword(verificationToken);
        
        // Create verification token (expires in 24 hours)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.verificationToken.create({
          data: {
            userId: ctx.user.id,
            email: input.newEmail,
            type: 'EMAIL_CHANGE',
            tokenHash: tokenHash,
            expiresAt: expiresAt,
            maxAttempts: 3,
            metadata: JSON.stringify({ oldEmail: user.email })
          }
        });

        // Send verification email to new address
        await mailer.sendEmailChangeVerificationEmail(input.newEmail, verificationToken, user.email);

        return {
          success: true,
          message: 'Email change request sent. Please check your new email address for verification.'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Change email error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process email change request',
          cause: error
        });
      }
    }),

  // Verify email change
  verifyEmailChange: protectedProcedure
    .input(z.object({ token: z.string().min(1, 'Verification token is required') }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

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

        // Check if token belongs to current user
        if (verificationToken.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Token does not belong to current user'
          });
        }

        // Check if token is for email change
        if (verificationToken.type !== 'EMAIL_CHANGE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid token type'
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
            message: 'Email change already verified'
          });
        }

        // Check attempts
        if (verificationToken.attempts >= verificationToken.maxAttempts) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Too many verification attempts. Please request a new email change.'
          });
        }

        // Get old email from metadata
        const metadata = verificationToken.metadata ? verificationToken.metadata as any : {};
        const oldEmail = metadata.oldEmail || ctx.user.email;

        // Update email and revoke all refresh tokens
        await prisma.$transaction(async (tx: any) => {
          // Update user email
          await tx.user.update({
            where: { id: ctx.user.id },
            data: { 
              email: verificationToken.email,
              updatedAt: new Date()
            }
          });

          // Mark token as verified
          await tx.verificationToken.update({
            where: { id: verificationToken.id },
            data: {
              verifiedAt: new Date()
            }
          });

          // Revoke all refresh tokens for this user
          await tx.refreshToken.updateMany({
            where: { 
              userId: ctx.user.id,
              isRevoked: false 
            },
            data: {
              isRevoked: true,
              revokedAt: new Date()
            }
          });
        });

        // Send confirmation emails
        await mailer.sendEmailChangeConfirmationEmail(verificationToken.email, oldEmail);
        await mailer.sendSecurityAlertEmail(
          oldEmail,
          'Email Address Changed',
          `Your email address has been changed from ${oldEmail} to ${verificationToken.email}. All sessions have been logged out for security.`
        );

        return {
          success: true,
          message: 'Email address changed successfully. All sessions have been logged out for security.'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Verify email change error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify email change',
          cause: error
        });
      }
    }),

  // Delete account
  deleteAccount: protectedProcedure
    .input(z.object({ 
      password: z.string().min(1, 'Password is required'),
      confirmation: z.literal('DELETE', { 
        errorMap: () => ({ message: 'Please type DELETE to confirm account deletion' })
      })
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Get current user with password hash
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id }
        });

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or no password set'
          });
        }

        // Verify password
        if (!(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Password is incorrect'
          });
        }

        // Soft delete user account
        await prisma.$transaction(async (tx: any) => {
          // Mark user as deleted
          await tx.user.update({
            where: { id: ctx.user.id },
            data: { 
              status: UserStatus.DELETED,
              email: `deleted_${Date.now()}_${user.email}`,
              updatedAt: new Date()
            }
          });

          // Revoke all refresh tokens
          await tx.refreshToken.updateMany({
            where: { userId: ctx.user.id },
            data: {
              isRevoked: true,
              revokedAt: new Date()
            }
          });

          // Mark all verification tokens as expired
          await tx.verificationToken.updateMany({
            where: { userId: ctx.user.id },
            data: {
              expiresAt: new Date()
            }
          });
        });

        // Send account deletion confirmation email
        await mailer.sendAccountDeletionEmail(user.email);

        return {
          success: true,
          message: 'Account deleted successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Delete account error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account',
          cause: error
        });
      }
    }),

  // Delete self (alias for deleteAccount with different input schema)
  deleteSelf: protectedProcedure
    .input(z.object({ 
      password: z.string().min(1, 'Password is required'),
      confirmText: z.string().min(1, 'Confirmation text is required')
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Get current user with password hash
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id }
        });

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or no password set'
          });
        }

        // Verify password
        if (!(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Password is incorrect'
          });
        }

        // Verify confirmation text
        if (input.confirmText !== 'DELETE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Please type "DELETE" to confirm account deletion'
          });
        }

        // Use the delete policy service for proper cleanup
        const { deletePolicyService } = await import('../services/delete-policy');
        
        // Check for critical data before deletion
        const criticalData = await deletePolicyService.hasCriticalData(user.id);
        if (criticalData.hasData) {
          console.warn(`User ${user.id} has critical data before deletion:`, criticalData.dataTypes);
        }

        // Perform hard delete with cascade
        const deleteResult = await deletePolicyService.deleteUserAccount(user.id, {
          anonymizeData: false,
          cascadeDelete: true,
          preserveAuditLogs: false
        });

        // Send account deletion confirmation email
        await mailer.sendAccountDeletionEmail(user.email);

        console.log(`User account deleted: ${user.id}`, deleteResult);

        return {
          success: true,
          message: 'Account deleted successfully',
          deletedRecords: deleteResult.deletedRecords
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Delete account error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account',
          cause: error
        });
      }
    })
});
