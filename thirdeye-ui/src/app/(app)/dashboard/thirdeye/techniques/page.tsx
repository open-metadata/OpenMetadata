'use client';

import { 
  Trash2, Clock, Eye, DollarSign, Ghost, 
  RefreshCw, HardDrive, CalendarX, Cpu, AlertCircle 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mockTechniques, mockActionItems } from '@/lib/mockData';

export default function TechniquesPage() {
  
  const getIcon = (iconName: string) => {
    const iconProps = { size: 24, className: "text-primary" };
    
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

  const getPriorityVariant = (priority: string) => {
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

  // Get all action items as techniques with more details
  const allTechniques = mockActionItems.filter(item => item.category === 'table');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            ZeroAct
          </span> Strategies
        </h1>
        <p className="text-muted-foreground">
          Autonomous execution framework for intelligent cost optimization
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Techniques</p>
          <p className="text-2xl font-bold">{allTechniques.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Active strategies</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">High Priority</p>
          <p className="text-2xl font-bold text-red-600">
            {allTechniques.filter(t => t.priority === 'high').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Immediate action</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Medium Priority</p>
          <p className="text-2xl font-bold text-yellow-600">
            {allTechniques.filter(t => t.priority === 'medium').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Planned optimization</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Savings</p>
          <p className="text-2xl font-bold text-green-600">
            ${allTechniques.reduce((sum, t) => sum + t.cost, 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Monthly potential</p>
        </Card>
      </div>

      {/* Techniques Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Techniques</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allTechniques.map((technique) => (
            <Card key={technique.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon(technique.icon)}
                    <div>
                      <h3 className="font-semibold">{technique.title}</h3>
                      <p className="text-xs text-muted-foreground">{technique.subtitle}</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active" />
                </div>
                
                {/* Description */}
                <p className="text-sm text-muted-foreground">{technique.description}</p>
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Affected Tables</p>
                    <p className="text-lg font-bold">{technique.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Cost</p>
                    <p className="text-lg font-bold text-green-600">
                      ${(technique.cost / 1000).toFixed(1)}k
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getPriorityVariant(technique.priority)}>
                    {technique.priority}
                  </Badge>
                  <Badge variant="outline">
                    {technique.action}
                  </Badge>
                  <Badge variant="secondary">
                    {technique.category}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    Configure
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Best Practices Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Implementation Best Practices</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <span className="text-green-600 font-bold">1</span>
              </div>
              Start with High Priority
            </h3>
            <p className="text-sm text-muted-foreground">
              Focus on high-priority techniques with the greatest impact on cost savings and performance.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              Test Before Deployment
            </h3>
            <p className="text-sm text-muted-foreground">
              Always test optimization techniques in a staging environment before applying to production.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              Monitor & Adjust
            </h3>
            <p className="text-sm text-muted-foreground">
              Continuously monitor the impact of applied techniques and adjust strategies as needed.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

