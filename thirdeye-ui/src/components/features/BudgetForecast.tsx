'use client';

import { BarChart3, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BudgetForecastProps {
  budgetData?: {
    total_monthly_cost_usd?: number;
    monthly_savings_opportunity_usd?: number;
    roi?: number;
  };
  className?: string;
}

export default function BudgetForecast({ 
  budgetData = {}, 
  className 
}: BudgetForecastProps) {
  const {
    total_monthly_cost_usd = 300000,
    monthly_savings_opportunity_usd = 28000,
    roi = 15.2
  } = budgetData;

  // Calculate metrics
  const forecastedCost = total_monthly_cost_usd - monthly_savings_opportunity_usd;
  const savingsPercentage = ((monthly_savings_opportunity_usd / total_monthly_cost_usd) * 100).toFixed(1);
  const costReductionPercentage = ((forecastedCost / total_monthly_cost_usd) * 100).toFixed(0);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className={cn('p-6 hover:shadow-lg transition-shadow', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Budget & Forecast</h3>
        </div>
        
        {/* Top Row: Total Cost and ROI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold">{formatCurrency(total_monthly_cost_usd)}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-2xl font-bold text-green-600">N/A</p>
          </div>
        </div>

        {/* Forecast Section */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-medium">Forecast</span>
            </div>
            <span className="text-sm font-medium text-green-600">
              Save {formatCurrency(monthly_savings_opportunity_usd)} ({savingsPercentage}%)
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-8 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${costReductionPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-foreground/80">
                {costReductionPercentage}% of budget optimized
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

