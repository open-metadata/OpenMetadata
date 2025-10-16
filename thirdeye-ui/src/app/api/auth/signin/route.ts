import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { cookies } from 'next/headers';

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = signinSchema.parse(body);
    
    // Authenticate with OpenMetadata backend
    const encodedPassword = Buffer.from(validatedData.password, 'utf8').toString('base64');
    
    // For server-side calls, use absolute URL to the backend
    const backendUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const response = await fetch(`${backendUrl}/api/v1/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: validatedData.email,
        password: encodedPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    const authData = await response.json();
    
    // Generate JWT token for our frontend
    const token = jwt.sign(
      { 
        userId: authData.user?.id || authData.id, 
        email: validatedData.email,
        role: authData.user?.role || 'User',
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: validatedData.rememberMe ? '30d' : '7d' }
    );

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: validatedData.rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 // 30 days or 7 days
    });

    // Also store the OpenMetadata access token
    cookieStore.set('metadata-access-token', authData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return NextResponse.json({
      message: 'Sign in successful',
      user: {
        id: authData.user?.id || authData.id,
        email: validatedData.email,
        firstName: authData.user?.name?.split(' ')[0] || 'User',
        lastName: authData.user?.name?.split(' ')[1] || '',
        company: authData.user?.organization || 'ZeroHuman',
        role: authData.user?.role || 'User'
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      );
    }

    console.error('Signin error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
