/**
 * ThirdEye API Client
 * 
 * Client library for calling ThirdEye analytics service endpoints
 * Uses Next.js API proxy to avoid CORS issues
 */

// Use Next.js API proxy route instead of direct backend URL
const THIRDEYE_BASE_URL = process.env.NEXT_PUBLIC_THIRDEYE_API_URL || '/api/thirdeye';

interface DashboardData {
  ziScore: {
    score: number;
    breakdown: {
      compute: number;
      storage: number;
      query: number;
      others: number;
    };
  };
  budgetForecast: {
    total_monthly_cost_usd: number;
    monthly_savings_opportunity_usd: number;
    roi: number;
  };
  metadata: {
    total_tables: number;
    active_tables: number;
    inactive_percentage: number;
  };
}

interface ActionItemsResponse {
  actionItems: any[];
  totalItems: number;
  pendingItems: number;
  totalPotentialSavings: number;
}

interface InsightReport {
  tables: any[];
  totalCount: number;
  reportType: string;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
}

interface TechniquesResponse {
  success: boolean;
  data: any[];
  totalCount: number;
}

class ThirdEyeClient {
  private baseUrl: string;

  constructor(baseUrl: string = THIRDEYE_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`ThirdEye API error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Dashboard endpoints
  async getDashboardData(): Promise<DashboardData> {
    return this.fetch<DashboardData>('/dashboard/data');
  }

  async getHealthScoreHistory(days: number = 30): Promise<any[]> {
    return this.fetch<any[]>(`/dashboard/health-score-history?days=${days}`);
  }

  async getOpportunityCampaigns(status?: string, limit: number = 10): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    return this.fetch<any[]>(`/dashboard/opportunity-campaigns?${params}`);
  }

  // Action Items endpoints
  async getActionItems(): Promise<ActionItemsResponse> {
    return this.fetch<ActionItemsResponse>('/action-items');
  }

  async getActionItemsByCategory(
    category?: string,
    priority?: string,
    status?: string
  ): Promise<ActionItemsResponse> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (priority) params.append('priority', priority);
    if (status) params.append('status', status);
    return this.fetch<ActionItemsResponse>(`/action-items/by-category?${params}`);
  }

  async getActionItemById(id: string): Promise<any> {
    return this.fetch<any>(`/action-items/${id}`);
  }

  async getActionItemTables(
    actionItemId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    return this.fetch<any>(
      `/action-items/${actionItemId}/tables?limit=${limit}&offset=${offset}`
    );
  }

  // Insights endpoints
  async getInsightReport(
    reportType: 'storage' | 'compute' | 'query' | 'other',
    limit: number = 50,
    offset: number = 0
  ): Promise<InsightReport> {
    return this.fetch<InsightReport>(
      `/insights/report?report_type=${reportType}&limit=${limit}&offset=${offset}`
    );
  }

  async getInsightSummary(): Promise<any> {
    return this.fetch<any>('/insights/summary');
  }

  // Techniques endpoints
  async getTechniques(): Promise<TechniquesResponse> {
    return this.fetch<TechniquesResponse>('/techniques');
  }

  async getTechniqueById(id: string): Promise<any> {
    return this.fetch<any>(`/techniques/${id}`);
  }

  async getTechniquesByCategory(category: string): Promise<TechniquesResponse> {
    return this.fetch<TechniquesResponse>(`/techniques/by-category/${category}`);
  }

  async getTechniquesStats(): Promise<any> {
    return this.fetch<any>('/techniques/stats/overview');
  }

  // Health check (direct to backend, not proxied)
  async healthCheck(): Promise<any> {
    const backendUrl = process.env.NEXT_PUBLIC_THIRDEYE_BACKEND_URL || 'http://localhost:8586';
    const response = await fetch(`${backendUrl}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }
}

// Export singleton instance
export const thirdeyeClient = new ThirdEyeClient();

// Export class for custom instances
export { ThirdEyeClient };
export type { DashboardData, ActionItemsResponse, InsightReport, TechniquesResponse };

