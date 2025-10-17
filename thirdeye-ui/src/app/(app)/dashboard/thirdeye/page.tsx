'use client';

import { useRouter } from 'next/navigation';
import ZIScoreGauge from '@/components/features/ZIScoreGauge';
import BudgetForecast from '@/components/features/BudgetForecast';
import ActionItems from '@/components/features/ActionItems';
import Insights from '@/components/features/Insights';
import TechniquesShowcase from '@/components/features/TechniquesShowcase';
import AutoSavesFeed from '@/components/features/AutoSavesFeed';
import { 
  mockDashboardData, 
  mockActionItems, 
  mockTechniques, 
  mockInsightsData,
  mockAutoSavesData 
} from '@/lib/mockData';

export default function ThirdEyeDashboardPage() {
  const router = useRouter();

  // Using mock data - no backend required
  const dashboardData = mockDashboardData;
  const actionItems = mockActionItems;
  const techniques = mockTechniques;
  const insights = mockInsightsData;
  const autoSavesData = mockAutoSavesData;

  const handleLearnMore = () => {
    router.push('/dashboard/thirdeye/help');
  };

  const handleActionItemDetails = (item: any) => {
    console.log('Action item details:', item);
    // TODO: Show details modal or navigate to details page
  };

  const handleViewReport = (reportType: string) => {
    console.log('View report:', reportType);
    // TODO: Navigate to full report page
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ThirdEye Analytics</h1>
        <p className="text-muted-foreground">
          Data infrastructure health and cost optimization insights
        </p>
      </div>

      {/* Top Row: ZI Score, Budget Forecast, and Automation */}
      <div className="grid gap-6 md:grid-cols-3">
        <ZIScoreGauge
          score={dashboardData.ziScore.score}
          breakdown={dashboardData.ziScore.breakdown}
          onLearnMore={handleLearnMore}
        />
        <BudgetForecast
          budgetData={dashboardData.budgetForecast}
        />
        <AutoSavesFeed
          feedData={autoSavesData}
        />
      </div>

      {/* Metadata Summary */}
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

      {/* Action Items */}
      <ActionItems
        actionItems={actionItems}
        onDetailsClick={handleActionItemDetails}
      />

      {/* Insights */}
      {insights.storage?.length > 0 && (
        <Insights
          insights={insights}
          onViewReport={handleViewReport}
        />
      )}

      {/* Techniques Showcase */}
      {techniques.length > 0 && (
        <TechniquesShowcase
          techniques={techniques}
        />
      )}
    </div>
  );
}

