import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Mock database - replace with your actual database
const users: any[] = [
  {
    id: '1',
    email: 'admin@thirdeye.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeVX5jzYl9c6vF8K.',
    firstName: 'Admin',
    lastName: 'User',
    company: 'ThirdEye',
    role: 'Admin',
    emailVerified: true,
    createdAt: new Date().toISOString()
  }
];

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = verifyEmailSchema.parse(body);
    
    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(validatedData.token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return NextResponse.json(
        { message: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Find user
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Update user email verification status
    users[userIndex].emailVerified = true;
    users[userIndex].updatedAt = new Date().toISOString();

    return NextResponse.json({
      message: 'Email verified successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }

    console.error('Email verification error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { message: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      return NextResponse.json(
        { message: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Find user
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    if (userIndex === -1) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    // Update user email verification status
    users[userIndex].emailVerified = true;
    users[userIndex].updatedAt = new Date().toISOString();

    // Redirect to signin page with success message
    return NextResponse.redirect(new URL('/auth/signin?message=Email verified successfully! You can now sign in.', req.url));

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/auth/signin?message=Email verification failed. Please try again.', req.url));
  }
}
