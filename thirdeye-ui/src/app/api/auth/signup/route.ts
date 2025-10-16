import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  company: z.string().min(1, 'Company is required'),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = signupSchema.parse(body);
    
    // Register with OpenMetadata backend using proxy
    const encodedPassword = Buffer.from(validatedData.password, 'utf8').toString('base64');
    
    const response = await fetch(`${process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585'}/api/v1/users/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        password: validatedData.password
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Preserve backend error messages for better user experience
      const errorMessage = errorData.message || errorData.error?.details || 'Registration failed';
      console.error('OpenMetadata signup failed:', errorData);
      
      return NextResponse.json(
        { message: errorMessage, details: errorData.details },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    
    // Return successful response consistent with OpenMetadata registration
    return NextResponse.json({
      message: 'Account created successfully! Please check your email to verify your account.',
      user: {
        id: responseData.id || 'user-created',
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        company: validatedData.company,
        isEmailVerified: false // Will be verified by OpenMetadata email verification
      },
      backendDetails: {
        url: `${process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585'}/api/v1/users/signup`,
        status: 'success'
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Signup API error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}