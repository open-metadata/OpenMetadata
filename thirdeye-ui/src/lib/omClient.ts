import { cookies } from 'next/headers';

export interface MetadataUser {
  id: string;
  name: string;
  email: string;
  organization?: string;
  role?: string;
  isAdmin?: boolean;
}

export interface MetadataAuthResponse {
  accessToken: string;
  refreshToken?: string;
  user?: MetadataUser;
  id?: string;
  message?: string;
}

export interface MetadataSearchResponse {
  hits: {
    total: {
      value: number;
    };
    hits: Array<{
      _source: any;
      _id: string;
    }>;
  };
}

// Get OpenMetadata access token from cookies
export async function getMetadataAccessToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('metadata-access-token')?.value || null;
  } catch (error) {
    console.error('Error getting metadata access token:', error);
    return null;
  }
}

// Make authenticated request to OpenMetadata backend
export async function metadataFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getMetadataAccessToken();
  
  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenMetadata API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// OpenMetadata API functions
export async function getCurrentMetadataUser(): Promise<MetadataUser> {
  return metadataFetch<MetadataUser>('/api/v1/users/profile');
}

export async function searchMetadataEntities(query: string, filters?: any): Promise<MetadataSearchResponse> {
  return metadataFetch<MetadataSearchResponse>('/api/v1/search/query', {
    method: 'POST',
    body: JSON.stringify({
      query: {
        bool: {
          must: [
            {
              query_string: {
                query: `*${query}*`,
                fields: ['name^2', 'description', 'displayName']
              }
            }
          ],
          ...(filters && { filter: filters })
        }
      },
      size: 20
    })
  });
}

export async function getMetadataDatabases(): Promise<any[]> {
  return metadataFetch<any[]>('/api/v1/databases');
}

export async function getMetadataServices(): Promise<any[]> {
  return metadataFetch<any[]>('/api/v1/services');
}

export async function getMetadataTeams(): Promise<any[]> {
  return metadataFetch<any[]>('/api/v1/teams');
}

export async function getMetadataUsers(): Promise<any[]> {
  return metadataFetch<any[]>('/api/v1/users');
}

export async function getMetadataHealth(): Promise<any> {
  return metadataFetch<any>('/api/v1/system/version');
}
