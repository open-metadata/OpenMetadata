/**
 * Database Services API Client
 * Handles CRUD operations for data source connectors like Snowflake and DBT
 */

interface DatabaseService {
  id: string;
  name: string;
  serviceType: 'Snowflake' | 'DbtPipeline';
  fullyQualifiedName?: string;
  description?: string;
  connection?: {
    config: Record<string, any>;
  };
}

interface CreateServiceRequest {
  name: string;
  description?: string;
  serviceType: string;
  connection: {
    config: Record<string, any>;
  };
}

interface TestConnectionRequest {
  connection: {
    config: Record<string, any>;
  };
}

class DatabaseServiceError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'DatabaseServiceError';
  }
}

export class DatabasesClient {
  private getApiUrl(endpoint: string): string {
    return `/api/services/database${endpoint}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.getApiUrl(endpoint);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle token expiration - redirect to login
        if (response.status === 401 && errorData.code === 'TOKEN_EXPIRED') {
          // Clear any stored auth data
          document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          document.cookie = 'metadata-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          
          // Redirect to login
          window.location.href = '/auth/signin';
          return;
        }
        
        throw new DatabaseServiceError(
          errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof DatabaseServiceError) {
        throw error;
      }
      throw new DatabaseServiceError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all database services
   */
  async listServices(filters?: {
    include?: 'deleted' | 'non-deleted' | 'all';
    limit?: number;
  }): Promise<DatabaseService[]> {
    const params = new URLSearchParams();
    if (filters?.include) params.append('include', filters.include);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const endpoint = `${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<{ data: DatabaseService[] }>(endpoint);
    return response.data || [];
  }

  /**
   * Create a new database service
   */
  async createService(serviceData: CreateServiceRequest): Promise<DatabaseService> {
    const response = await this.request<DatabaseService>('', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
    return response;
  }

  /**
   * Get a specific database service by FQN or ID
   */
  async getService(serviceId: string): Promise<DatabaseService> {
    const response = await this.request<DatabaseService>(`/${encodeURIComponent(serviceId)}`);
    return response;
  }

  /**
   * Update a database service
   */
  async updateService(serviceId: string, updates: Partial<DatabaseService>): Promise<DatabaseService> {
    const response = await this.request<DatabaseService>(`/${encodeURIComponent(serviceId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response;
  }

  /**
   * Delete a database service
   */
  async deleteService(serviceId: string): Promise<void> {
    await this.request(`/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test database service connection
   */
  async testConnection(serviceType: string, connectionConfig: TestConnectionRequest): Promise<{ status: 'success' | 'failed'; message: string }> {
    const testPayload = {
      serviceType,
      ...connectionConfig,
    };

    try {
      const response = await fetch('/api/services/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          status: 'failed',
          message: errorData.message || 'Connection test failed',
        };
      }

      const data = await response.json();
      return {
        status: data.status,
        message: data.message,
      };
    } catch (error) {
      return {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Get ingestion pipelines for a service
   */
  async getIngestionPipelines(serviceId: string) {
    const response = await this.request(`/api/v1/services/${encodeURIComponent(serviceId)}/pipelines`);
    return response;
  }

  /**
   * Trigger ingestion pipeline
   */
  async triggerIngestion(pipelineId: string) {
    const response = await this.request(`/api/v1/pipelines/${encodeURIComponent(pipelineId)}/trigger`, {
      method: 'POST',
    });
    return response;
  }
}

export default DatabasesClient;
