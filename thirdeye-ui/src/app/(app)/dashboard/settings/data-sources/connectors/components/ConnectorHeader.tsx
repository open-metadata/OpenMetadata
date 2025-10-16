'use client';

import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConnectorHeaderProps {
  connectorType: 'snowflake' | 'dbt' | '';
}

const ConnectorHeader = ({ connectorType }: ConnectorHeaderProps) => {
  const getConnectorInfo = (type: string) => {
    switch (type) {
      case 'snowflake':
        return {
          title: 'Snowflake Connector',
          description: 'Configure your Snowflake data warehouse connection',
          icon: '⚡',
        };
      case 'dbt':
        return {
          title: 'DBT Connector', 
          description: 'Set up DBT for data transformations',
          icon: '🔄',
        };
      default:
        return {
          title: 'Data Source Connectors',
          description: 'Connect to your data sources',
          icon: '🔗',
        };
    }
  };

  const { title, description, icon } = getConnectorInfo(connectorType);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/settings/data-sources">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Data Sources
          </Button>
        </Link>
        
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {connectorType && (
        <Card className="w-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href={`/dashboard/settings/data-sources/connectors?type=${connectorType}`}>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Configure New
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConnectorHeader;
