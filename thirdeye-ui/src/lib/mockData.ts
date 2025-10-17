/**
 * Mock Data for ThirdEye UI Components
 * Use this for development and testing without backend connection
 */

export const mockDashboardData = {
  ziScore: {
    score: 74,
    breakdown: {
      compute: 20,
      storage: 35,
      query: 15,
      others: 4
    }
  },
  budgetForecast: {
    total_monthly_cost_usd: 328000,
    monthly_savings_opportunity_usd: 43000,
    roi: 15.2
  },
  metadata: {
    total_tables: 2847,
    active_tables: 1623,
    inactive_percentage: 43.0
  }
};

export const mockActionItems = [
  {
    id: 'safe_to_purge',
    title: 'Safe to Purge',
    description: 'Tables Ready for Deletion',
    subtitle: 'Risk Level: Low',
    icon: 'trash-2',
    color: 'green',
    cost: 12500,
    count: 145,
    savings: null,
    category: 'table',
    priority: 'high',
    action: 'DELETE',
    status: 'pending'
  },
  {
    id: 'convert_to_transient',
    title: 'Convert to Transient',
    description: 'Snowflake Transient Tables',
    subtitle: 'Risk Level: Medium',
    icon: 'clock',
    color: 'yellow',
    cost: 8900,
    count: 89,
    savings: null,
    category: 'table',
    priority: 'medium',
    action: 'CONVERT_TRANSIENT',
    status: 'pending'
  },
  {
    id: 'review_required',
    title: 'Review Required',
    description: 'Manual Review Needed',
    subtitle: 'Risk Level: Medium',
    icon: 'eye',
    color: 'orange',
    cost: 6700,
    count: 67,
    savings: null,
    category: 'table',
    priority: 'medium',
    action: 'REVIEW',
    status: 'pending'
  },
  {
    id: 'most_expensive',
    title: 'Most Expensive Tables',
    description: 'Top 10 by Storage Cost',
    subtitle: 'Highest Impact Optimization',
    icon: 'dollar-sign',
    color: 'red',
    cost: 45200,
    count: 10,
    savings: null,
    category: 'table',
    priority: 'high',
    action: 'OPTIMIZE',
    status: 'pending'
  },
  {
    id: 'zombie_tables',
    title: 'Zombie Tables',
    description: 'Zero Activity Tables',
    subtitle: 'No Queries or Users',
    icon: 'ghost',
    color: 'purple',
    cost: 15600,
    count: 234,
    savings: null,
    category: 'table',
    priority: 'high',
    action: 'INVESTIGATE',
    status: 'pending'
  },
  {
    id: 'refresh_waste',
    title: 'Refresh Waste',
    description: 'Unnecessary ETL Jobs',
    subtitle: 'Refreshed but Unused',
    icon: 'refresh-cw',
    color: 'blue',
    cost: 7800,
    count: 123,
    savings: null,
    category: 'table',
    priority: 'medium',
    action: 'STOP_REFRESH',
    status: 'pending'
  },
  {
    id: 'large_unused',
    title: 'Large Unused Tables',
    description: 'High Storage, Low Usage',
    subtitle: 'Size > 100GB, Rarely Used',
    icon: 'hard-drive',
    color: 'indigo',
    cost: 18900,
    count: 56,
    savings: null,
    category: 'table',
    priority: 'high',
    action: 'ARCHIVE',
    status: 'pending'
  },
  {
    id: 'stale_tables',
    title: 'Stale Tables',
    description: 'Not Accessed Recently',
    subtitle: '90+ Days Since Access',
    icon: 'calendar-x',
    color: 'gray',
    cost: 9400,
    count: 312,
    savings: null,
    category: 'table',
    priority: 'low',
    action: 'REVIEW_ACCESS',
    status: 'pending'
  },
  {
    id: 'automated_queries',
    title: 'Automated Queries',
    description: 'High Queries, Few Users',
    subtitle: 'Potential ETL Optimization',
    icon: 'cpu',
    color: 'cyan',
    cost: 5600,
    count: 78,
    savings: null,
    category: 'table',
    priority: 'medium',
    action: 'OPTIMIZE_ETL',
    status: 'pending'
  },
  {
    id: 'cost_savings_summary',
    title: 'Potential Savings',
    description: 'Monthly Cost Reduction',
    subtitle: 'Total Optimization Impact',
    icon: 'trending-down',
    color: 'emerald',
    cost: 43000,
    count: 0,
    savings: 43000,
    category: 'summary',
    priority: 'info',
    action: 'CALCULATE_SAVINGS',
    status: 'pending'
  }
];

export const mockTechniques = [
  {
    id: 'safe_to_purge',
    title: 'Safe to Purge',
    description: 'Automated table deletion for unused data',
    subtitle: 'Risk Level: Low - High confidence deletion',
    icon: 'trash-2',
    color: 'green',
    priority: 'high',
    action: 'DELETE',
    category: 'table',
    enabled: true,
    isActive: true
  },
  {
    id: 'convert_to_transient',
    title: 'Convert to Transient',
    description: 'Snowflake transient table conversion',
    subtitle: 'Risk Level: Medium - Cost optimization',
    icon: 'clock',
    color: 'yellow',
    priority: 'medium',
    action: 'CONVERT_TRANSIENT',
    category: 'table',
    enabled: true,
    isActive: true
  },
  {
    id: 'zombie_detection',
    title: 'Zombie Table Detection',
    description: 'Identify tables with zero activity',
    subtitle: 'Automated monitoring for inactive tables',
    icon: 'ghost',
    color: 'purple',
    priority: 'high',
    action: 'INVESTIGATE',
    category: 'table',
    enabled: true,
    isActive: true
  },
  {
    id: 'cost_analysis',
    title: 'Cost Analysis',
    description: 'Identify most expensive tables',
    subtitle: 'Focus on high-impact optimizations',
    icon: 'dollar-sign',
    color: 'red',
    priority: 'high',
    action: 'OPTIMIZE',
    category: 'table',
    enabled: true,
    isActive: true
  }
];

export const mockInsightsData = {
  storage: [
    {
      FQN: 'prod.analytics.user_events_archive',
      DATABASE_NAME: 'prod',
      DB_SCHEMA: 'analytics',
      TABLE_NAME: 'user_events_archive',
      SIZE_GB: 1250.5,
      days_since_access: 125,
      ROLL_30D_TBL_QC: 3,
      ROLL_30D_TBL_UC: 1,
      purge_score: 8.5,
      monthly_cost_usd: 3125.75,
      LAST_ACCESSED_DATE: '2024-06-15T10:30:00Z',
      LAST_REFRESHED_DATE: '2024-10-10T02:00:00Z'
    },
    {
      FQN: 'prod.analytics.historical_logs',
      DATABASE_NAME: 'prod',
      DB_SCHEMA: 'analytics',
      TABLE_NAME: 'historical_logs',
      SIZE_GB: 980.2,
      days_since_access: 95,
      ROLL_30D_TBL_QC: 8,
      ROLL_30D_TBL_UC: 2,
      purge_score: 7.2,
      monthly_cost_usd: 2450.50,
      LAST_ACCESSED_DATE: '2024-07-18T14:20:00Z',
      LAST_REFRESHED_DATE: '2024-10-12T03:00:00Z'
    },
    {
      FQN: 'prod.staging.temp_data_2023',
      DATABASE_NAME: 'prod',
      DB_SCHEMA: 'staging',
      TABLE_NAME: 'temp_data_2023',
      SIZE_GB: 750.8,
      days_since_access: 200,
      ROLL_30D_TBL_QC: 0,
      ROLL_30D_TBL_UC: 0,
      purge_score: 9.5,
      monthly_cost_usd: 1877.00,
      LAST_ACCESSED_DATE: '2024-03-25T08:15:00Z',
      LAST_REFRESHED_DATE: '2024-03-26T01:00:00Z'
    }
  ],
  compute: [
    {
      FQN: 'prod.analytics.daily_aggregates',
      DATABASE_NAME: 'prod',
      DB_SCHEMA: 'analytics',
      TABLE_NAME: 'daily_aggregates',
      SIZE_GB: 45.2,
      days_since_access: 1,
      ROLL_30D_TBL_QC: 25000,
      ROLL_30D_TBL_UC: 2,
      purge_score: 2.1,
      monthly_cost_usd: 450.20,
      LAST_ACCESSED_DATE: '2024-10-16T23:45:00Z',
      LAST_REFRESHED_DATE: '2024-10-16T00:00:00Z'
    }
  ],
  query: [],
  other: []
};

export const mockHealthScoreHistory = [
  { id: 1, snapshot_date: '2024-10-10T00:00:00Z', score: 72, meta: null },
  { id: 2, snapshot_date: '2024-10-11T00:00:00Z', score: 73, meta: null },
  { id: 3, snapshot_date: '2024-10-12T00:00:00Z', score: 71, meta: null },
  { id: 4, snapshot_date: '2024-10-13T00:00:00Z', score: 74, meta: null },
  { id: 5, snapshot_date: '2024-10-14T00:00:00Z', score: 73, meta: null },
  { id: 6, snapshot_date: '2024-10-15T00:00:00Z', score: 75, meta: null },
  { id: 7, snapshot_date: '2024-10-16T00:00:00Z', score: 74, meta: null }
];

export const mockAutoSavesData = {
  status: 'Active',
  totalSavings: 43000,
  monthlySavings: 43000,
  lastRun: '2024-10-16T22:00:00Z',
  nextRun: '2024-10-17T02:00:00Z',
  automatedActions: 12,
  pendingReviews: 5
};

