/**
 * OAuth configuration for ThirdEye application
 */

export interface OAuthConfig {
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
  };
  snowflake?: {
    domain: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
    authUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
  };
}

/**
 * Get OAuth configuration from environment variables
 */
export function getOAuthConfig(): OAuthConfig {
  const baseUrl = process.env.API_URL || 'http://localhost:3002';

  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${baseUrl}/api/oauth/google/callback`,
      scope: ['openid', 'email', 'profile'],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
    },
    snowflake: process.env.SNOWFLAKE_OAUTH_DOMAIN ? {
      domain: process.env.SNOWFLAKE_OAUTH_DOMAIN,
      clientId: process.env.SNOWFLAKE_CLIENT_ID || '',
      clientSecret: process.env.SNOWFLAKE_CLIENT_SECRET || '',
      redirectUri: `${baseUrl}/api/oauth/snowflake/callback`,
      scope: ['openid', 'email', 'profile'],
      authUrl: `https://${process.env.SNOWFLAKE_OAUTH_DOMAIN}/oauth/authorize`,
      tokenUrl: `https://${process.env.SNOWFLAKE_OAUTH_DOMAIN}/oauth/token-request`,
      userInfoUrl: `https://${process.env.SNOWFLAKE_OAUTH_DOMAIN}/oauth/userinfo`
    } : undefined
  };
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = base64URLEncode(sha256(codeVerifier));
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * Generate random string for PKCE and state
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Base64 URL encode
 */
function base64URLEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * SHA256 hash (simplified for Node.js)
 */
function sha256(str: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str).digest('base64');
}

/**
 * Generate state parameter for OAuth flow
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Validate state parameter
 */
export function validateState(received: string, expected: string): boolean {
  return received === expected;
}
