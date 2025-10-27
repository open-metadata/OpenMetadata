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

interface ZIScoreBreakdown {
  storage: number;
  compute: number;
  query: number;
  others: number;
}

interface ZIScoreMetadata {
  totalTables: number;
  activeTables: number;
  inactiveTables: number;
  totalStorageTB: number;
  wasteStorageTB: number;
  wastePercentage: number;
  monthlyCostUSD: number;
  monthlySavingsOpportunityUSD: number;
  annualSavingsOpportunityUSD: number;
  zombieTables: number;
  zombiePercentage: number;
  staleTables: number;
  stalePercentage: number;
  calculatedAt?: string;
}

interface ZIScore {
  overall: number;
  status: string;
  trend: string;
  breakdown: ZIScoreBreakdown;
  storageScore: number;
  computeScore: number;
  queryScore: number;
  metadata: ZIScoreMetadata;
}

interface ZIScoreSummary {
  score: number;
  status: string;
  breakdown: ZIScoreBreakdown;
  trend: string;
  savings: {
    monthly: number;
    annual: number;
  };
  alerts: {
    zombie_tables: number;
    zombie_percentage: number;
    waste_storage_tb: number;
    waste_percentage: number;
  };
}

interface PurgeCandidate {
  fqn: string;
  database_name: string;
  db_schema: string;
  table_name: string;
  table_type: string;
  size_gb: number;
  days_since_access: number | null;
  query_count_30d: number;
  user_count_30d: number;
  monthly_cost_usd: number;
  purge_score: number;
  recommendation: string;
  annual_savings_usd: number;
}

interface PurgeCandidatesResponse {
  data: PurgeCandidate[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
  filters: {
    min_score: number | null;
    recommendation: string | null;
  };
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

  // ZI Score endpoints
  /**
   * Get full ZI Score with all metadata
   */
  async getZIScore(): Promise<ZIScore> {
    return this.fetch<ZIScore>('/zi-score');
  }

  /**
   * Get ZI Score summary optimized for gauge display
   */
  async getZIScoreSummary(): Promise<ZIScoreSummary> {
    return this.fetch<ZIScoreSummary>('/zi-score/summary');
  }

  /**
   * Get raw health metrics from database view
   */
  async getHealthMetrics(): Promise<any> {
    return this.fetch<any>('/zi-score/health-metrics');
  }

  /**
   * Get purge candidates (tables recommended for deletion/archival)
   * @param limit Maximum number of results (1-1000)
   * @param offset Pagination offset
   * @param minScore Filter by minimum purge score (0-10)
   * @param recommendation Filter by recommendation category
   */
  async getPurgeCandidates(
    limit: number = 100,
    offset: number = 0,
    minScore?: number,
    recommendation?: 'EXCELLENT_CANDIDATE' | 'GOOD_CANDIDATE' | 'REVIEW_REQUIRED' | 'KEEP'
  ): Promise<PurgeCandidatesResponse> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (minScore !== undefined) params.append('min_score', minScore.toString());
    if (recommendation) params.append('recommendation', recommendation);
    
    return this.fetch<PurgeCandidatesResponse>(`/zi-score/purge-candidates?${params}`);
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

// Export types
export type { 
  DashboardData, 
  ActionItemsResponse, 
  InsightReport, 
  TechniquesResponse,
  ZIScore,
  ZIScoreSummary,
  ZIScoreBreakdown,
  ZIScoreMetadata,
  PurgeCandidate,
  PurgeCandidatesResponse
};

