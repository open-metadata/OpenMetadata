'use client';

import { useState } from 'react';
import { 
  AlertCircle, Trash2, Clock, Eye, DollarSign, Ghost, 
  RefreshCw, HardDrive, CalendarX, Cpu, TrendingDown 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  subtitle: string;
  icon: string;
  color: string;
  cost: number;
  count: number;
  category: string;
  priority: 'high' | 'medium' | 'low' | 'info';
  action: string;
  status: string;
}

interface ActionItemsProps {
  actionItems?: ActionItem[];
  isLoading?: boolean;
  onDetailsClick?: (item: ActionItem) => void;
  className?: string;
}

export default function ActionItems({ 
  actionItems = [], 
  isLoading = false, 
  onDetailsClick,
  className 
}: ActionItemsProps) {
  
  const getIcon = (iconName: string) => {
    const iconProps = { size: 18, className: "text-primary" };
    
    switch (iconName) {
      case 'trash-2':
        return <Trash2 {...iconProps} />;
      case 'clock':
        return <Clock {...iconProps} />;
      case 'eye':
        return <Eye {...iconProps} />;
      case 'dollar-sign':
        return <DollarSign {...iconProps} />;
      case 'ghost':
        return <Ghost {...iconProps} />;
      case 'refresh-cw':
        return <RefreshCw {...iconProps} />;
      case 'hard-drive':
        return <HardDrive {...iconProps} />;
      case 'calendar-x':
        return <CalendarX {...iconProps} />;
      case 'cpu':
        return <Cpu {...iconProps} />;
      case 'trending-down':
        return <TrendingDown {...iconProps} />;
      default:
        return <AlertCircle {...iconProps} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Actions</h2>
        </div>
        <div className="text-center text-muted-foreground py-8">Loading action items...</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            ZeroAct
          </span> Actions
        </h2>
      </div>

      {/* Action Items Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actionItems.map((item) => (
          <Card key={item.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(item.icon)}
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <div className={cn('w-2 h-2 rounded-full', getPriorityColor(item.priority))} />
              </div>
              
              {/* Description */}
              <p className="text-sm text-muted-foreground">{item.description}</p>
              
              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-600">
                    ${item.cost ? item.cost.toLocaleString() : '0'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.count ? `${parseInt(String(item.count)).toLocaleString()} tables` : 'No data'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">• {item.subtitle}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {(item.action === 'DELETE' || item.action === 'CONVERT_TRANSIENT') && (
                  <Button size="sm" className="flex-1">
                    {item.action === 'DELETE' ? 'Purge' : 'Convert'}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => onDetailsClick?.(item)}
                >
                  Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {actionItems.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No action items available at the moment.
        </div>
      )}
    </div>
  );
}

