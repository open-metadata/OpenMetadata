import { NextRequest, NextResponse } from 'next/server';
import { getMetadataAccessToken } from '@/lib/metadataClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const token = await getMetadataAccessToken();
    
    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { serviceId } = params;
    
    const openMetadataUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const apiUrl = `${openMetadataUrl}/api/v1/services/databaseServices/${encodeURIComponent(serviceId)}`;

    const response = await fetch(apiUrl, {
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
      
      throw new Error(`OpenMetadata API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching database service:', error);
    return NextResponse.json(
      { message: 'Failed to fetch database service' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const token = await getMetadataAccessToken();
    
    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { serviceId } = params;
    const body = await request.json();

    const openMetadataUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const apiUrl = `${openMetadataUrl}/api/v1/services/databaseServices/${encodeURIComponent(serviceId)}`;

    const response = await fetch(apiUrl, {
      method: 'PATCH',
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
    console.error('Error updating database service:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to update database service' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const token = await getMetadataAccessToken();
    
    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { serviceId } = params;

    const openMetadataUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
    const apiUrl = `${openMetadataUrl}/api/v1/services/databaseServices/${encodeURIComponent(serviceId)}`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
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
      
      throw new Error(`OpenMetadata API error: ${response.status}`);
    }

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting database service:', error);
    return NextResponse.json(
      { message: 'Failed to delete database service' },
      { status: 500 }
    );
  }
}
