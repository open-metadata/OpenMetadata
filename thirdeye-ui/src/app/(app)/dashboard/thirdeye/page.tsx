'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ZIScoreGauge from '@/components/features/ZIScoreGauge';
import BudgetForecast from '@/components/features/BudgetForecast';
import ActionItems from '@/components/features/ActionItems';
import Insights from '@/components/features/Insights';
import TechniquesShowcase from '@/components/features/TechniquesShowcase';
import AutoSavesFeed from '@/components/features/AutoSavesFeed';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { thirdeyeClient } from '@/lib/thirdeyeClient';
import { 
  mockDashboardData, 
  mockActionItems, 
  mockTechniques, 
  mockInsightsData,
  mockAutoSavesData 
} from '@/lib/mockData';

export default function ThirdEyeDashboardPage() {
  const router = useRouter();
  
  // State management
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [techniques, setTechniques] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>({});
  const [autoSavesData, setAutoSavesData] = useState<any>(mockAutoSavesData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to load real data from backend
      const [dashboard, items, techs, storageInsights] = await Promise.all([
        thirdeyeClient.getDashboardData().catch(err => {
          console.error('Dashboard data error:', err);
          return null;
        }),
        thirdeyeClient.getActionItems().catch(err => {
          console.error('Action items error:', err);
          return null;
        }),
        thirdeyeClient.getTechniques().catch(err => {
          console.error('Techniques error:', err);
          return null;
        }),
        thirdeyeClient.getInsightReport('storage', 3, 0).catch(err => {
          console.error('Storage insights error:', err);
          return null;
        }),
      ]);

      // Check if we got real data or should use mock
      if (!dashboard || !items || !techs) {
        console.log('Backend not available, using mock data');
        setUseMockData(true);
        setDashboardData(mockDashboardData);
        setActionItems(mockActionItems);
        setTechniques(mockTechniques);
        setInsights(mockInsightsData);
        setError('Using mock data - Backend service not available');
      } else {
        console.log('Real data loaded successfully');
        setUseMockData(false);
        setDashboardData(dashboard);
        setActionItems(items.actionItems || []);
        setTechniques(techs.data || []);
        setInsights({
          storage: storageInsights?.tables || []
        });
      }

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load data. Using mock data instead.');
      setUseMockData(true);
      // Fallback to mock data
      setDashboardData(mockDashboardData);
      setActionItems(mockActionItems);
      setTechniques(mockTechniques);
      setInsights(mockInsightsData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearnMore = () => {
    router.push('/dashboard/thirdeye/help');
  };

  const handleActionItemDetails = (item: any) => {
    console.log('Action item details:', item);
    // TODO: Show details modal or navigate to details page
  };

  const handleViewReport = (reportType: string) => {
    console.log('View report:', reportType);
    router.push('/dashboard/thirdeye/insights');
  };

  const handleRetry = () => {
    loadDashboardData();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              ZeroInsight
            </span> Analytics
          </h1>
          <p className="text-muted-foreground">
            Autonomous intelligence for data infrastructure health and cost optimization
          </p>
        </div>
        <div className="flex items-center gap-2">
          {useMockData && (
            <Alert className="w-auto inline-flex items-center gap-2 py-2 px-4">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Using Mock Data</span>
            </Alert>
          )}
          <Button onClick={handleRetry} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && !useMockData && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Top Row: ZI Score, Budget Forecast, and Automation */}
      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[350px]" />
            <Skeleton className="h-[350px]" />
            <Skeleton className="h-[350px]" />
          </>
        ) : (
          <>
            <ZIScoreGauge
              score={dashboardData?.ziScore?.score}
              breakdown={dashboardData?.ziScore?.breakdown}
              onLearnMore={handleLearnMore}
            />
            <BudgetForecast
              budgetData={dashboardData?.budgetForecast}
            />
            <AutoSavesFeed
              feedData={autoSavesData}
            />
          </>
        )}
      </div>

      {/* Metadata Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
          </>
        ) : dashboardData?.metadata ? (
          <>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Tables</p>
              <p className="text-2xl font-bold">{dashboardData.metadata.total_tables.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Active Tables</p>
              <p className="text-2xl font-bold">{dashboardData.metadata.active_tables.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Inactive %</p>
              <p className="text-2xl font-bold">{dashboardData.metadata.inactive_percentage.toFixed(1)}%</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Action Items */}
      <ActionItems
        actionItems={actionItems}
        isLoading={isLoading}
        onDetailsClick={handleActionItemDetails}
      />

      {/* Insights */}
      {!isLoading && insights.storage?.length > 0 && (
        <Insights
          insights={insights}
          onViewReport={handleViewReport}
        />
      )}

      {/* Techniques Showcase */}
      {!isLoading && techniques.length > 0 && (
        <TechniquesShowcase
          techniques={techniques}
          isLoading={false}
        />
      )}
    </div>
  );
}

