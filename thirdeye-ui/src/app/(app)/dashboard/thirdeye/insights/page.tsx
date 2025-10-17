'use client';

import { useState } from 'react';
import { Database, Cpu, Search, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BasicTable from '@/components/data/BasicTable';
import { mockInsightsData } from '@/lib/mockData';

export default function InsightsPage() {
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
    { key: 'DB_SCHEMA', header: 'Schema' },
    { 
      key: 'SIZE_GB', 
      header: 'Size (GB)',
      render: (value: number) => value.toFixed(2)
    },
    { 
      key: 'monthly_cost_usd', 
      header: 'Monthly Cost',
      render: (value: number) => `$${value.toLocaleString()}`
    },
    { 
      key: 'purge_score', 
      header: 'Purge Score',
      render: (value: number) => value.toFixed(1)
    },
    { key: 'days_since_access', header: 'Days Since Access' },
  ];

  const getTabData = (tabValue: string) => {
    return mockInsightsData[tabValue as keyof typeof mockInsightsData] || [];
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights & Analytics</h1>
        <p className="text-muted-foreground">
          Detailed reports and analytics for your data infrastructure
        </p>
      </div>

      {/* Insights Content */}
      <Card className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className={`h-4 w-4 ${tab.color}`} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {tab.label} Analytics
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getTabData(tab.value).length} records
                  </p>
                </div>
                
                {getTabData(tab.value).length > 0 ? (
                  <BasicTable 
                    data={getTabData(tab.value)} 
                    columns={columns} 
                  />
                ) : (
                  <div className="text-center py-12 border rounded-lg bg-muted/50">
                    <tab.icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No {tab.label.toLowerCase()} insights available
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Data will appear here once analysis is complete
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {tabs.map((tab) => {
          const data = getTabData(tab.value);
          const totalCost = data.reduce((sum, item) => sum + (item.monthly_cost_usd || 0), 0);
          const avgScore = data.length > 0 
            ? data.reduce((sum, item) => sum + (item.purge_score || 0), 0) / data.length 
            : 0;

          return (
            <Card key={tab.value} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <tab.icon className={`h-5 w-5 ${tab.color}`} />
                <h4 className="font-semibold">{tab.label}</h4>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{data.length}</p>
                <p className="text-xs text-muted-foreground">tables</p>
                {totalCost > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    ${totalCost.toLocaleString()}/mo
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

