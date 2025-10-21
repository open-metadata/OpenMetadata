import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Google OAuth initiation route
 * Checks OpenMetadata config and redirects to Google OAuth if configured
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard/thirdeye';
    const backendUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    
    // Store the callback URL in a cookie for after authentication
    const cookieStore = await cookies();
    cookieStore.set('oauth-callback-url', callbackUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600 // 10 minutes
    });
    
    try {
      // Try to get OpenMetadata's auth configuration
      const configResponse = await fetch(`${backendUrl}/api/v1/system/config/auth`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });
      
      if (configResponse.ok) {
        const authConfig = await configResponse.json();
        
        // Check if Google OAuth is configured
        if (authConfig.provider === 'google' || authConfig.provider === 'Google') {
          const frontendUrl = process.env.NEXTAUTH_URL || 'http://coming.live';
          
          // Build Google OAuth URL
          const googleAuthUrl = new URL(`${authConfig.authority}/o/oauth2/v2/auth`);
          googleAuthUrl.searchParams.set('client_id', authConfig.clientId);
          googleAuthUrl.searchParams.set('redirect_uri', `${frontendUrl}/api/auth/google/callback`);
          googleAuthUrl.searchParams.set('response_type', authConfig.responseType || 'id_token');
          googleAuthUrl.searchParams.set('scope', 'openid email profile');
          googleAuthUrl.searchParams.set('nonce', Math.random().toString(36).substring(7));
          
          // Redirect to Google
          return NextResponse.redirect(googleAuthUrl.toString());
        }
      }
    } catch (fetchError) {
      console.error('Failed to fetch OpenMetadata auth config:', fetchError);
    }
    
    // If Google OAuth is not configured, return an error
    const frontendUrl = process.env.NEXTAUTH_URL || 'http://coming.live';
    return NextResponse.redirect(
      `${frontendUrl}/auth/signin?error=${encodeURIComponent('Google OAuth is not configured in OpenMetadata. Please set AUTHENTICATION_PROVIDER=google')}`
    );
    
  } catch (error) {
    console.error('Google OAuth initialization error:', error);
    const frontendUrl = process.env.NEXTAUTH_URL || 'http://coming.live';
    return NextResponse.redirect(
      `${frontendUrl}/auth/signin?error=oauth_init_failed`
    );
  }
}

