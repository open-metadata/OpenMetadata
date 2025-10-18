'use client';

import { 
  Trash2, Clock, Eye, DollarSign, Ghost, 
  RefreshCw, HardDrive, CalendarX, Cpu, AlertCircle 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Technique {
  id: string;
  title: string;
  description: string;
  subtitle: string;
  icon: string;
  color: string;
  priority: string;
  action: string;
  category: string;
  enabled: boolean;
  isActive: boolean;
}

interface TechniquesShowcaseProps {
  techniques?: Technique[];
  isLoading?: boolean;
  className?: string;
}

export default function TechniquesShowcase({ 
  techniques = [], 
  isLoading = false,
  className 
}: TechniquesShowcaseProps) {
  
  const getIcon = (iconName: string) => {
    const iconProps = { size: 20, className: "text-primary" };
    
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
      default:
        return <AlertCircle {...iconProps} />;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-muted-foreground py-8">Loading techniques...</div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            ZeroAct
          </span> Strategies
        </h2>
        <p className="text-muted-foreground mt-1">
          Autonomous execution framework with intelligent optimization strategies
        </p>
      </div>

      {/* Techniques Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {techniques.map((technique) => (
          <Card key={technique.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(technique.icon)}
                  <h3 className="font-semibold text-sm">{technique.title}</h3>
                </div>
                {technique.isActive && (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>
              
              {/* Description */}
              <p className="text-sm text-muted-foreground">{technique.description}</p>
              
              {/* Metadata */}
              <div className="flex items-center gap-2">
                <Badge variant={getPriorityBadgeVariant(technique.priority)} className="text-xs">
                  {technique.priority}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {technique.action}
                </Badge>
              </div>

              {/* Footer */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {technique.subtitle}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {techniques.length === 0 && (
        <Card className="p-6">
          <div className="text-center text-muted-foreground py-8">
            No techniques available at the moment.
          </div>
        </Card>
      )}
    </div>
  );
}

