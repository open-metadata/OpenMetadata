import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Only use secure flag if HTTPS is available
    const isSecure = req.url.startsWith('https://');
    
    // Clear the auth token cookie
    cookieStore.set('auth-token', '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expire immediately
    });

    // Clear the OpenMetadata access token cookie
    cookieStore.set('metadata-access-token', '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // Expire immediately
    });

    return NextResponse.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
