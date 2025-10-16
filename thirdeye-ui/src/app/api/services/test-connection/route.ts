import { NextRequest, NextResponse } from 'next/server';
import { getMetadataAccessToken } from '@/lib/metadataClient';

export async function POST(request: NextRequest) {
  try {
    const token = await getMetadataAccessToken();
    
    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const openMetadataUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const apiUrl = `${openMetadataUrl}/api/v1/services/databaseServices/testConnection`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle expired/invalid token
      if (response.status === 401 || errorData.message?.includes('Expired token') || errorData.message?.includes('Invalid token')) {
        return NextResponse.json(
          { 
            status: 'failed', 
            message: 'Authentication expired. Please sign in again.',
            code: 'TOKEN_EXPIRED'
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          status: 'failed', 
          message: errorData.message || 'Connection test failed',
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      status: 'success',
      message: 'Connection test successful',
      data
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { 
        status: 'failed',
        message: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    );
  }
}
