'use client';

import { useState } from 'react';
import { Database, Cpu, Search, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import BasicTable from '@/components/data/BasicTable';
import { cn } from '@/lib/utils';

interface InsightsProps {
  insights?: {
    storage?: any[];
    compute?: any[];
    query?: any[];
    other?: any[];
  };
  onViewReport?: (reportType: string) => void;
  className?: string;
}

export default function Insights({ 
  insights = {}, 
  onViewReport,
  className 
}: InsightsProps) {
  const [activeTab, setActiveTab] = useState('storage');

  const tabs = [
    { value: 'storage', label: 'Storage', icon: Database, color: 'text-purple-500' },
    { value: 'compute', label: 'Compute', icon: Cpu, color: 'text-cyan-500' },
    { value: 'query', label: 'Query', icon: Search, color: 'text-blue-500' },
    { value: 'other', label: 'Other', icon: Info, color: 'text-indigo-500' },
  ];

  const columns = [
    { key: 'TABLE_NAME', header: 'Table Name' },
    { key: 'DATABASE_NAME', header: 'Database' },
    { 
      key: 'SIZE_GB', 
      header: 'Size (GB)',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'monthly_cost_usd', 
      header: 'Monthly Cost',
      render: (value: number) => `$${value.toFixed(2)}`
    },
    { key: 'days_since_access', header: 'Days Since Access' },
  ];

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Insights</h2>
          <Button variant="outline" size="sm" onClick={() => onViewReport?.(activeTab)}>
            View Full Report
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className={cn('h-4 w-4', tab.color)} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Top {tab.label.toLowerCase()} insights for your data infrastructure
                </p>
                
                {insights[tab.value as keyof typeof insights]?.length ? (
                  <BasicTable 
                    data={insights[tab.value as keyof typeof insights] || []} 
                    columns={columns} 
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No {tab.label.toLowerCase()} insights available
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}

