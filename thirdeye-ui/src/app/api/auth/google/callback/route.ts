import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

/**
 * Google OAuth callback handler
 * Receives the OAuth response from Google and creates a session
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const idToken = searchParams.get('id_token');
    const accessToken = searchParams.get('access_token');
    const error = searchParams.get('error');
    
    // Get the stored callback URL from cookie
    const cookieStore = await cookies();
    const callbackUrl = cookieStore.get('oauth-callback-url')?.value || '/dashboard/thirdeye';
    
    if (error) {
      console.error('OAuth error:', error);
      // Clear the callback cookie
      cookieStore.delete('oauth-callback-url');
      const frontendUrl = process.env.NEXTAUTH_URL || 'http://coming.live';
      return NextResponse.redirect(
        `${frontendUrl}/auth/signin?error=${encodeURIComponent(error)}`
      );
    }
    
    // Google uses fragment-based response for implicit flow
    // The tokens are in the URL fragment (#), not search params
    // We need to handle this on the client side, so redirect to a client-side handler
    if (!idToken && !accessToken) {
      // Return an HTML page that will extract tokens from fragment and redirect
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Completing sign in...</title>
        </head>
        <body>
          <p>Completing sign in...</p>
          <script>
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const idToken = params.get('id_token');
            const accessToken = params.get('access_token');
            const error = params.get('error');
            
            if (error) {
              window.location.href = '/auth/signin?error=' + encodeURIComponent(error);
            } else if (idToken || accessToken) {
              // Redirect back to this endpoint with tokens in query params
              window.location.href = '/api/auth/google/callback?id_token=' + (idToken || '') + '&access_token=' + (accessToken || '');
            } else {
              window.location.href = '/auth/signin?error=missing_token';
            }
          </script>
        </body>
        </html>
        `,
        {
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }
    
    const backendUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const token = idToken || accessToken;
    
    if (token) {
      try {
        // Decode the JWT to get user info
        const decoded = jwt.decode(token) as any;
        
        if (!decoded || !decoded.email) {
          throw new Error('Invalid token: no email found');
        }
        
        // Try to authenticate with OpenMetadata using the token
        const loginResponse = await fetch(`${backendUrl}/api/v1/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: decoded.email,
            token: token
          }),
        });
        
        let userData;
        let omAccessToken = token;
        
        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          userData = loginData.user || loginData;
          omAccessToken = loginData.accessToken || token;
        } else {
          // If login fails, use the decoded token data
          userData = {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
          };
        }
        
        // Generate our JWT token for the session
        const sessionToken = jwt.sign(
          { 
            userId: userData.id || decoded.sub,
            email: decoded.email,
            role: userData.role || 'User',
            accessToken: omAccessToken
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '7d' }
        );
        
        // Set HTTP-only cookies
        // Only use secure flag if HTTPS is available (check protocol)
        const isSecure = req.url.startsWith('https://');
        
        cookieStore.set('auth-token', sessionToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 // 7 days
        });
        
        cookieStore.set('metadata-access-token', omAccessToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 // 7 days
        });
        
        // Clear the callback URL cookie
        cookieStore.delete('oauth-callback-url');
        
        // Redirect to the original callback URL using the configured frontend URL
        const frontendUrl = process.env.NEXTAUTH_URL || req.url;
        const redirectUrl = callbackUrl.startsWith('http') 
          ? callbackUrl 
          : `${frontendUrl}${callbackUrl.startsWith('/') ? '' : '/'}${callbackUrl}`;
        
        return NextResponse.redirect(redirectUrl);
        
      } catch (tokenError) {
        console.error('Token processing error:', tokenError);
        throw tokenError;
      }
    }
    
    throw new Error('No valid authentication token received');
    
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const cookieStore = await cookies();
    cookieStore.delete('oauth-callback-url');
    const frontendUrl = process.env.NEXTAUTH_URL || 'http://coming.live';
    return NextResponse.redirect(
      `${frontendUrl}/auth/signin?error=authentication_failed`
    );
  }
}

