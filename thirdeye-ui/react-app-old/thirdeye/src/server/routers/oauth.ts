import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../lib/prisma';
import { getOAuthConfig, generatePKCE, generateState } from '../config/oauth';
import { createTokenPair } from '../auth/tokens';
import { mailer } from '../services/mailer';
import type { AuthUser } from '../../types/auth';
import { UserRole, UserStatus, OAuthProvider } from '../../types/auth';

// OAuth schemas
const googleAuthUrlSchema = z.object({
  redirectUrl: z.string().url().optional(),
});

const googleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  codeVerifier: z.string().min(1, 'Code verifier is required').optional(),
});

const snowflakeAuthUrlSchema = z.object({
  redirectUrl: z.string().url().optional(),
});

const snowflakeCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export const oauthRouter = router({
  // Get Google OAuth authorization URL
  getGoogleAuthUrl: publicProcedure
    .input(googleAuthUrlSchema)
    .mutation(async ({ input }) => {
      try {
        const config = getOAuthConfig();
        
        if (!config.google.clientId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Google OAuth is not configured'
          });
        }

        // Generate PKCE parameters
        const pkce = generatePKCE();
        const state = generateState();

        // Build authorization URL
        const params = new URLSearchParams({
          client_id: config.google.clientId,
          redirect_uri: config.google.redirectUri,
          scope: config.google.scope.join(' '),
          response_type: 'code',
          state: state,
          code_challenge: pkce.codeChallenge,
          code_challenge_method: pkce.codeChallengeMethod,
          access_type: 'offline',
          prompt: 'consent'
        });

        const authUrl = `${config.google.authUrl}?${params.toString()}`;

        return {
          success: true,
          authUrl,
          state,
          codeVerifier: pkce.codeVerifier
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Google auth URL generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate Google auth URL',
          cause: error
        });
      }
    }),

  // Handle Google OAuth callback
  googleCallback: publicProcedure
    .input(googleCallbackSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const config = getOAuthConfig();
        
        if (!config.google.clientId || !config.google.clientSecret) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Google OAuth is not configured'
          });
        }

        // Exchange authorization code for access token
        const tokenResponse = await fetch(config.google.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            code: input.code,
            grant_type: 'authorization_code',
            redirect_uri: config.google.redirectUri,
            ...(input.codeVerifier && { code_verifier: input.codeVerifier })
          })
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('Google token exchange failed:', errorData);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to exchange authorization code for token'
          });
        }

        const tokenData = await tokenResponse.json();
        const { access_token, id_token } = tokenData;

        // Fetch user profile
        const profileResponse = await fetch(config.google.userInfoUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        if (!profileResponse.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to fetch user profile from Google'
          });
        }

        const profile = await profileResponse.json();
        const { id: googleId, email, name, picture } = profile;

        if (!email) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No email address provided by Google'
          });
        }

        // Check if user already exists by email
        let user = await prisma.user.findUnique({
          where: { email }
        });

        let isNewUser = false;

        if (user) {
          // User exists, check if they have this OAuth provider linked
          const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
            where: {
              uk_oauth_provider_account: {
                provider: OAuthProvider.GOOGLE,
                providerAccountId: googleId
              }
            }
          });

          if (!existingOAuthAccount) {
            // Link the OAuth account to existing user
            await prisma.oAuthAccount.create({
              data: {
                provider: OAuthProvider.GOOGLE,
                providerAccountId: googleId,
                type: 'oauth',
                accessToken: access_token,
                userId: user.id,
                tokenType: 'Bearer',
                scope: config.google.scope.join(' ')
              }
            });

            // Send security alert email
            await mailer.sendSecurityAlertEmail(
              user.email,
              'New Login Method Added',
              `Google OAuth has been linked to your account. If this wasn't you, please contact support immediately.`
            );
          }
        } else {
          // Create new user
          isNewUser = true;
          user = await prisma.user.create({
            data: {
              email,
              name: name || email.split('@')[0],
              image: picture,
              role: UserRole.USER,
              status: UserStatus.ACTIVE,
              emailVerified: true // Google emails are pre-verified
            }
          });

          // Create OAuth account
          await prisma.oAuthAccount.create({
            data: {
              provider: OAuthProvider.GOOGLE,
              providerAccountId: googleId,
              type: 'oauth',
              accessToken: access_token,
              userId: user.id,
              tokenType: 'Bearer',
              scope: config.google.scope.join(' ')
            }
          });

          // Send welcome email
          await mailer.sendWelcomeEmail(user.email, user.name || user.email);
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
          }
        });

        // Create auth user object
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

        // Create token pair
        const tokens = await createTokenPair(
          authUser,
          {
            userAgent: ctx.req?.headers['user-agent'],
            ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
          },
          ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          ctx.req?.headers['user-agent']
        );

        return {
          success: true,
          user: authUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: 'Bearer',
          isNewUser
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Google OAuth callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Google OAuth authentication failed',
          cause: error
        });
      }
    }),

  // Get Snowflake OAuth authorization URL
  getSnowflakeAuthUrl: publicProcedure
    .input(snowflakeAuthUrlSchema)
    .mutation(async ({ input }) => {
      try {
        const config = getOAuthConfig();
        
        if (!config.snowflake) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Snowflake OAuth is not configured'
          });
        }

        const state = generateState();

        // Build authorization URL
        const params = new URLSearchParams({
          client_id: config.snowflake.clientId,
          redirect_uri: config.snowflake.redirectUri,
          scope: config.snowflake.scope.join(' '),
          response_type: 'code',
          state: state
        });

        const authUrl = `${config.snowflake.authUrl}?${params.toString()}`;

        return {
          success: true,
          authUrl,
          state
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Snowflake auth URL generation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate Snowflake auth URL',
          cause: error
        });
      }
    }),

  // Handle Snowflake OAuth callback
  snowflakeCallback: publicProcedure
    .input(snowflakeCallbackSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const config = getOAuthConfig();
        
        if (!config.snowflake) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Snowflake OAuth is not configured'
          });
        }

        // Exchange authorization code for access token
        const tokenResponse = await fetch(config.snowflake.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: config.snowflake.clientId,
            client_secret: config.snowflake.clientSecret,
            code: input.code,
            grant_type: 'authorization_code',
            redirect_uri: config.snowflake.redirectUri
          })
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('Snowflake token exchange failed:', errorData);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to exchange authorization code for token'
          });
        }

        const tokenData = await tokenResponse.json();
        const { access_token } = tokenData;

        // Fetch user profile
        const profileResponse = await fetch(config.snowflake.userInfoUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        if (!profileResponse.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Failed to fetch user profile from Snowflake'
          });
        }

        const profile = await profileResponse.json();
        const { sub: snowflakeId, email, name } = profile;

        if (!email) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No email address provided by Snowflake'
          });
        }

        // Check if user already exists by email
        let user = await prisma.user.findUnique({
          where: { email }
        });

        let isNewUser = false;

        if (user) {
          // User exists, check if they have this OAuth provider linked
          const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
            where: {
              uk_oauth_provider_account: {
                provider: OAuthProvider.SNOWFLAKE,
                providerAccountId: snowflakeId
              }
            }
          });

          if (!existingOAuthAccount) {
            // Link the OAuth account to existing user
            await prisma.oAuthAccount.create({
              data: {
                provider: OAuthProvider.SNOWFLAKE,
                providerAccountId: snowflakeId,
                type: 'oauth',
                accessToken: access_token,
                userId: user.id,
                tokenType: 'Bearer',
                scope: config.snowflake.scope.join(' ')
              }
            });

            // Send security alert email
            await mailer.sendSecurityAlertEmail(
              user.email,
              'New Login Method Added',
              `Snowflake SSO has been linked to your account. If this wasn't you, please contact support immediately.`
            );
          }
        } else {
          // Create new user
          isNewUser = true;
          user = await prisma.user.create({
            data: {
              email,
              name: name || email.split('@')[0],
              role: UserRole.USER,
              status: UserStatus.ACTIVE,
              emailVerified: true // Snowflake emails are pre-verified
            }
          });

          // Create OAuth account
          await prisma.oAuthAccount.create({
            data: {
              provider: OAuthProvider.SNOWFLAKE,
              providerAccountId: snowflakeId,
              type: 'oauth',
              accessToken: access_token,
              userId: user.id,
              tokenType: 'Bearer',
              scope: config.snowflake.scope.join(' ')
            }
          });

          // Send welcome email
          await mailer.sendWelcomeEmail(user.email, user.name || user.email);
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
          }
        });

        // Create auth user object
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

        // Create token pair
        const tokens = await createTokenPair(
          authUser,
          {
            userAgent: ctx.req?.headers['user-agent'],
            ipAddress: ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string
          },
          ctx.req?.ip || ctx.req?.headers['x-forwarded-for'] as string,
          ctx.req?.headers['user-agent']
        );

        return {
          success: true,
          user: authUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: 'Bearer',
          isNewUser
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Snowflake OAuth callback error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Snowflake OAuth authentication failed',
          cause: error
        });
      }
    })
});
