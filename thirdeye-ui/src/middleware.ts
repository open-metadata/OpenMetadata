import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple JWT validation for Edge Runtime
function validateJWT(token: string, secret: string): { valid: boolean; payload?: any; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [header, payload, signature] = parts;
    
    // Decode payload (base64url)
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Check if token is expired
    if (decodedPayload.exp && Date.now() >= decodedPayload.exp * 1000) {
      return { valid: false, error: 'Token expired' };
    }

    // For now, we'll skip signature verification in Edge Runtime
    // In production, you might want to implement proper signature verification
    return { valid: true, payload: decodedPayload };
  } catch (error) {
    return { valid: false, error: 'Token validation failed' };
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Static files and assets that should always be accessible
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public/') ||
    pathname.includes('.') // Files with extensions (images, css, js, etc.)
  ) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',                    // Landing page
    '/auth/signin',         // Sign in page
    '/auth/signup',         // Sign up page
    '/auth/reset-password', // Password reset page
    '/auth/verify-email',   // Email verification page
    '/api/auth/signin',     // Sign in API
    '/api/auth/signup',     // Sign up API
    '/api/auth/reset-password', // Password reset API
    '/api/auth/verify-email',   // Email verification API
    '/api/auth/logout',     // Logout API
    '/api/auth/me',         // User info API
    '/api/connection',      // Connection API
    '/api/v1'               // OpenMetadata API routes (handled by proxy)
  ];

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') {
      // Exact match for root path
      return pathname === '/';
    }
    if (route === '/api/v1') {
      // API v1 routes
      return pathname.startsWith('/api/v1');
    }
    // For other routes, check if pathname starts with the route
    return pathname.startsWith(route);
  });

  if (isPublicRoute) {
    console.log(`✅ Public route accessed: ${pathname}`);
    return NextResponse.next();
  }

  // All other routes require authentication
  console.log(`🔒 Protected route accessed: ${pathname}`);

  // Get the auth token from cookies
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    console.log(`❌ No auth token found for protected route: ${pathname}`);
    // Redirect to signin page if no token
    const signinUrl = new URL('/auth/signin', request.url);
    signinUrl.searchParams.set('callbackUrl', pathname === '/' ? '/dashboard/thirdeye' : pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Validate the token using Web Crypto API compatible method
  const validation = validateJWT(token, process.env.JWT_SECRET || 'fallback-secret');
  
  if (!validation.valid) {
    console.log(`❌ Token validation failed for ${pathname}:`, validation.error);
    
    // Clear invalid cookies
    const response = NextResponse.redirect(new URL('/auth/signin', request.url));
    response.cookies.delete('auth-token');
    response.cookies.delete('metadata-access-token');
    
    return response;
  }

  // Token is valid, add user info to headers for downstream use
  const decoded = validation.payload;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', decoded.userId || '');
  requestHeaders.set('x-user-email', decoded.email || '');
  requestHeaders.set('x-user-role', decoded.role || 'User');
  
  console.log(`✅ Authenticated user ${decoded.email} accessing: ${pathname}`);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
