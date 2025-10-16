import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../lib/prisma';
import { mailer } from '../services/mailer';
import { OAuthProvider } from '../../types/auth';

// OAuth link schemas
const linkProviderSchema = z.object({
  provider: z.nativeEnum(OAuthProvider),
});

const unlinkProviderSchema = z.object({
  provider: z.nativeEnum(OAuthProvider),
});

const callbackSchema = z.object({
  provider: z.nativeEnum(OAuthProvider),
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
});

export const oauthLinkRouter = router({
  // Link OAuth provider
  link: protectedProcedure
    .input(linkProviderSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Check if provider is already linked
        const existingConnection = await prisma.oAuthAccount.findFirst({
          where: {
            userId: ctx.user.id,
            provider: input.provider
          }
        });

        if (existingConnection) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Provider is already linked to your account'
          });
        }

        // Generate OAuth state for security
        const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Store OAuth state in database (we'll use verification tokens for this)
        await prisma.verificationToken.create({
          data: {
            userId: ctx.user.id,
            email: ctx.user.email,
            type: 'TWO_FACTOR_SETUP', // Using this as a generic OAuth state type
            tokenHash: state,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            maxAttempts: 1
          }
        });

        // Generate OAuth URL based on provider
        let redirectUrl: string;
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        switch (input.provider) {
          case OAuthProvider.GOOGLE:
            redirectUrl = `https://accounts.google.com/oauth/authorize?` +
              `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
              `redirect_uri=${encodeURIComponent(`${process.env.API_URL || 'http://localhost:3002'}/api/oauth/google/callback`)}&` +
              `response_type=code&` +
              `scope=openid email profile&` +
              `state=${state}`;
            break;
            
          case OAuthProvider.SNOWFLAKE:
            redirectUrl = `https://${process.env.SNOWFLAKE_ACCOUNT}.snowflakecomputing.com/oauth/authorize?` +
              `response_type=code&` +
              `client_id=${process.env.SNOWFLAKE_CLIENT_ID}&` +
              `redirect_uri=${encodeURIComponent(`${process.env.API_URL || 'http://localhost:3002'}/api/oauth/snowflake/callback`)}&` +
              `scope=session:role:ACCOUNTADMIN&` +
              `state=${state}`;
            break;
            
          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unsupported OAuth provider'
            });
        }

        return {
          success: true,
          redirectUrl,
          message: `Redirecting to ${input.provider} for authentication...`
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Link provider error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to initiate OAuth linking',
          cause: error
        });
      }
    }),

  // Unlink OAuth provider
  unlink: protectedProcedure
    .input(unlinkProviderSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Check if provider is linked
        const existingConnection = await prisma.oAuthAccount.findFirst({
          where: {
            userId: ctx.user.id,
            provider: input.provider
          }
        });

        if (!existingConnection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Provider is not linked to your account'
          });
        }

        // Check if this is the only authentication method
        const totalConnections = await prisma.oAuthAccount.count({
          where: {
            userId: ctx.user.id
          }
        });

        const hasPassword = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { passwordHash: true }
        });

        const hasPasswordAuth = hasPassword?.passwordHash !== null;

        // If this is the only authentication method and no password, prevent unlinking
        if (totalConnections === 1 && !hasPasswordAuth) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot unlink the last remaining authentication method. Please add a password or link another provider first.'
          });
        }

        // Delete the OAuth account
        await prisma.oAuthAccount.delete({
          where: { id: existingConnection.id }
        });

        // Send security alert email
        await mailer.sendSecurityAlertEmail(
          ctx.user.email,
          'OAuth Provider Unlinked',
          `Your ${input.provider} account has been unlinked from your ThirdEye account. If you did not perform this action, please contact support immediately.`
        );

        return {
          success: true,
          message: `${input.provider} account unlinked successfully`
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Unlink provider error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unlink provider',
          cause: error
        });
      }
    }),

  // Handle OAuth callback
  callback: protectedProcedure
    .input(callbackSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        // Verify state parameter
        const oauthState = await prisma.verificationToken.findFirst({
          where: {
            tokenHash: input.state || '',
            userId: ctx.user.id,
            type: 'TWO_FACTOR_SETUP',
            expiresAt: { gt: new Date() }
          }
        });

        if (!oauthState) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid or expired OAuth state'
          });
        }

        // Exchange authorization code for access token
        let accessToken: string;
        let userInfo: any;

        switch (input.provider) {
          case OAuthProvider.GOOGLE:
            const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code: input.code,
                grant_type: 'authorization_code',
                redirect_uri: `${process.env.API_URL || 'http://localhost:3002'}/api/oauth/google/callback`
              })
            });

            if (!googleResponse.ok) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Failed to exchange Google authorization code'
              });
            }

            const googleTokens = await googleResponse.json();
            accessToken = googleTokens.access_token;

            // Get user info from Google
            const googleUserResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!googleUserResponse.ok) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Failed to fetch Google user info'
              });
            }

            userInfo = await googleUserResponse.json();
            break;

          case OAuthProvider.SNOWFLAKE:
            // Snowflake OAuth implementation would go here
            // This is a simplified version
            throw new TRPCError({
              code: 'NOT_IMPLEMENTED',
              message: 'Snowflake OAuth not yet implemented'
            });

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unsupported OAuth provider'
            });
        }

        // Create or update OAuth connection
        await prisma.$transaction(async (tx: any) => {
          // Check if connection already exists
          const existingConnection = await tx.oAuthAccount.findFirst({
            where: {
              userId: ctx.user.id,
              provider: input.provider,
              providerAccountId: userInfo.id
            }
          });

          if (existingConnection) {
            // Update existing connection
            await tx.oAuthAccount.update({
              where: { id: existingConnection.id },
              data: {
                accessToken,
                refreshToken: userInfo.refresh_token,
                expiresAt: userInfo.expires_at ? new Date(userInfo.expires_at * 1000) : null,
                updatedAt: new Date()
              }
            });
          } else {
            // Create new connection
            await tx.oAuthAccount.create({
              data: {
                userId: ctx.user.id,
                provider: input.provider,
                providerAccountId: userInfo.id,
                type: 'oauth',
                accessToken,
                refreshToken: userInfo.refresh_token,
                expiresAt: userInfo.expires_at ? new Date(userInfo.expires_at * 1000) : null,
                tokenType: 'Bearer',
                scope: 'openid email profile'
              }
            });
          }

          // Clean up OAuth state
          await tx.verificationToken.delete({
            where: { id: oauthState.id }
          });
        });

        // Send confirmation email
        await mailer.sendOAuthLinkConfirmationEmail(
          ctx.user.email,
          input.provider,
          userInfo.email
        );

        return {
          success: true,
          message: `${input.provider} account linked successfully`
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('OAuth callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete OAuth linking',
          cause: error
        });
      }
    }),

  // Get linked providers for current user
  getLinkedProviders: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      try {
        const connections = await prisma.oAuthAccount.findMany({
          where: {
            userId: ctx.user.id
          },
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        });

        return {
          success: true,
          providers: connections
        };
      } catch (error) {
        console.error('Get linked providers error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch linked providers',
          cause: error
        });
      }
    })
});
