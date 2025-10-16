import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentMetadataUser } from '@/lib/metadataClient';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Try to get fresh user data from OpenMetadata
    try {
      const metadataUser = await getCurrentMetadataUser();
      return NextResponse.json({
        user: {
          id: metadataUser.id,
          email: metadataUser.email,
          firstName: metadataUser.name?.split(' ')[0] || 'User',
          lastName: metadataUser.name?.split(' ')[1] || '',
          company: metadataUser.organization || 'OpenMetadata',
          role: metadataUser.role || 'User'
        }
      });
    } catch (metadataError) {
      // Fallback to JWT user data if Metadata API fails
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          company: user.company,
          role: user.role
        }
      });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
