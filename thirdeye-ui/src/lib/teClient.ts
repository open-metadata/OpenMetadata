// Types
export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  teams: string[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  users: string[];
}

export interface Service {
  id: string;
  name: string;
  serviceType: string;
  description?: string;
  status: 'active' | 'inactive' | 'error';
}

export interface SearchResult {
  hits: {
    total: number;
    hits: Array<{
      _source: any;
      _score: number;
    }>;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
}

export interface Workload {
  id: string;
  name: string;
  type: string;
  status: string;
  lastRun: string;
  duration: number;
  cost: number;
}

// Core fetch function
export async function teFetch<T>(path: string, init: RequestInit = {}) {
  const { getConn } = await import('./cookies');
  const conn = getConn();
  if (!conn) throw new Error('Not connected');
  
  const res = await fetch(`${conn.baseUrl}${path}`, {
    ...init,
    headers: { 
      'Authorization': `Bearer ${conn.token}`, 
      'Content-Type': 'application/json', 
      ...(init.headers || {}) 
    },
    cache: 'no-store',
  });
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  
  return res.json() as Promise<T>;
}

// User management
export const listUsers = (limit = 100, offset = 0) => 
  teFetch<{ data: User[] }>(`/api/v1/users?limit=${limit}&offset=${offset}`);
export const getUser = (id: string) => teFetch<User>(`/api/v1/users/${id}`);

// Team management
export const listTeams = (limit = 100, offset = 0) => 
  teFetch<{ data: Team[] }>(`/api/v1/teams?limit=${limit}&offset=${offset}`);
export const getTeam = (id: string) => teFetch<Team>(`/api/v1/teams/${id}`);

// Service management
export const listServices = (limit = 100, offset = 0) => 
  teFetch<{ data: Service[] }>(`/api/v1/services?limit=${limit}&offset=${offset}`);
export const getService = (id: string) => teFetch<Service>(`/api/v1/services/${id}`);

// Search
export const search = (query: string, filters?: any, limit = 20) => 
  teFetch<SearchResult>('/api/v1/search/query', {
    method: 'POST',
    body: JSON.stringify({ query, filters, limit })
  });

// Health and system
export const getHealth = () => teFetch<HealthStatus>('/api/v1/health');
export const getSystemInfo = () => teFetch<any>('/api/v1/system');

// Workloads and pipelines
export const listWorkloads = (limit = 100, offset = 0) => 
  teFetch<{ data: Workload[] }>(`/api/v1/workloads?limit=${limit}&offset=${offset}`);

// Data insights
export const getDataInsights = (timeRange = '7d') => 
  teFetch<any>(`/api/v1/insights?timeRange=${timeRange}`);

// Error handling utility
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
