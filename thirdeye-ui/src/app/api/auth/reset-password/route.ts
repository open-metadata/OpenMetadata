import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const resetRequestSchema = z.object({
  email: z.string().email('Invalid email address')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Check if this is a password reset request or password reset confirmation
    if ('email' in body) {
      // Password reset request
      const validatedData = resetRequestSchema.parse(body);
      
      const response = await fetch(`${process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585'}/api/v1/users/generatePasswordResetLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: validatedData.email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { message: errorData.message || 'Failed to generate reset link' },
          { status: response.status }
        );
      }

      return NextResponse.json({
        message: 'Password reset link sent to your email address.'
      });
      
    } else {
      // Password reset confirmation
      const validatedData = resetPasswordSchema.parse(body);
      
      // OpenMetadata expects password in base64 format
      const encodedPassword = Buffer.from(validatedData.newPassword, 'utf8').toString('base64');
      
      const response = await fetch(`${process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585'}/api/v1/users/password/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: validatedData.token,
          password: encodedPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { message: errorData.message || 'Failed to reset password' },
          { status: response.status }
        );
      }

      return NextResponse.json({
        message: 'Password reset successfully. You can now sign in with your new password.'
      });
    }
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Password reset error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}