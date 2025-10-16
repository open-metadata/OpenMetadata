import { NextRequest, NextResponse } from 'next/server';
import { getMetadataAccessToken } from '@/lib/metadataClient';

export async function GET(request: NextRequest) {
  try {
    const token = await getMetadataAccessToken();
    
    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include') || 'non-deleted';
    const limit = searchParams.get('limit') || '100';

    const openMetadataUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const apiUrl = new URL(`${openMetadataUrl}/api/v1/services/databaseServices`);
    
    // Add query parameters
    apiUrl.searchParams.set('include', include);
    apiUrl.searchParams.set('limit', limit);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle expired/invalid token
      if (response.status === 401 || errorData.message?.includes('Expired token') || errorData.message?.includes('Invalid token')) {
        return NextResponse.json(
          { message: 'Authentication expired. Please sign in again.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
      
      console.error('OpenMetadata API error:', response.status, errorData);
      return NextResponse.json(
        { message: errorData.message || `OpenMetadata API error: ${response.status}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching database services:', error);
    return NextResponse.json(
      { message: 'Failed to fetch database services' },
      { status: 500 }
    );
  }
}

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
    const apiUrl = `${openMetadataUrl}/api/v1/services/databaseServices`;

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
          { message: 'Authentication expired. Please sign in again.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating database service:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create database service' },
      { status: 500 }
    );
  }
}
