'use client';

import { useState, useEffect } from 'react';
import { thirdeyeClient } from '@/lib/thirdeyeClient';
import ZIScoreGauge from '@/components/features/ZIScoreGauge';
import BudgetForecast from '@/components/features/BudgetForecast';
import ActionItems from '@/components/features/ActionItems';
import Insights from '@/components/features/Insights';
import TechniquesShowcase from '@/components/features/TechniquesShowcase';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function ThirdEyeDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [techniques, setTechniques] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all data in parallel
      const [dashboard, items, techs, storageInsights] = await Promise.all([
        thirdeyeClient.getDashboardData().catch(err => {
          console.error('Dashboard data error:', err);
          return null;
        }),
        thirdeyeClient.getActionItems().catch(err => {
          console.error('Action items error:', err);
          return { actionItems: [] };
        }),
        thirdeyeClient.getTechniques().catch(err => {
          console.error('Techniques error:', err);
          return { data: [] };
        }),
        thirdeyeClient.getInsightReport('storage', 5, 0).catch(err => {
          console.error('Storage insights error:', err);
          return { tables: [] };
        }),
      ]);

      setDashboardData(dashboard);
      setActionItems(items.actionItems || []);
      setTechniques(techs.data || []);
      setInsights({
        storage: storageInsights.tables || []
      });

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data. Please check if the ThirdEye service is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearnMore = () => {
    console.log('Learn more clicked');
    // Navigate to help page or show modal
  };

  const handleActionItemDetails = (item: any) => {
    console.log('Action item details:', item);
    // Show details modal or navigate to details page
  };

  const handleViewReport = (reportType: string) => {
    console.log('View report:', reportType);
    // Navigate to full report page
  };

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ThirdEye Analytics</h1>
        <p className="text-muted-foreground">
          Data infrastructure health and cost optimization insights
        </p>
      </div>

      {/* Top Row: ZI Score and Budget Forecast */}
      <div className="grid gap-6 md:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
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
          </>
        )}
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
          isLoading={isLoading}
        />
      )}

      {/* Metadata Summary */}
      {dashboardData?.metadata && (
        <div className="grid gap-4 md:grid-cols-3">
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
        </div>
      )}
    </div>
  );
}

