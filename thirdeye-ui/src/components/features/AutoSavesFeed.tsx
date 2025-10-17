'use client';

import { Zap, Activity, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AutoSavesFeedProps {
  feedData?: {
    status?: string;
    totalSavings?: number;
    monthlySavings?: number;
    automatedActions?: number;
    pendingReviews?: number;
  };
  className?: string;
}

export default function AutoSavesFeed({ 
  feedData = {}, 
  className 
}: AutoSavesFeedProps) {
  const {
    status = 'Active',
    totalSavings = 43000,
    monthlySavings = 43000,
    automatedActions = 12,
    pendingReviews = 5
  } = feedData;

  const isActive = status === 'Active';

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Automation</h3>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'} className="flex items-center gap-1">
            <div className={cn(
              'w-2 h-2 rounded-full',
              isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            )} />
            {status}
          </Badge>
        </div>

        {/* Savings Display */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Monthly Savings</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(monthlySavings)}</p>
          </div>
          <DollarSign className="h-8 w-8 text-green-600/20" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Automated Actions</p>
            </div>
            <p className="text-lg font-semibold">{automatedActions}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Pending Reviews</p>
            </div>
            <p className="text-lg font-semibold">{pendingReviews}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

