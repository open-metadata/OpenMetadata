'use client';

import Link from 'next/link';
import { DatabaseIcon, SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DataSourcesPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
          <p className="text-muted-foreground">
            Configure connectors for your data sources
          </p>
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Snowflake Connector */}
        <Card className="relative">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <DatabaseIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">Snowflake</CardTitle>
                <CardDescription>
                  Cloud data warehouse connector
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Database</Badge>
              <Badge variant="outline">Analytics</Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Services</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <Link href="/dashboard/settings/data-sources/connectors?type=snowflake">
                <Button className="w-full">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Configure Snowflake
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* DBT Connector */}
        <Card className="relative">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <DatabaseIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">DBT</CardTitle>
                <CardDescription>
                  Data transformation connector
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Pipeline</Badge>
              <Badge variant="outline">Transformation</Badge>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Services</span>
                <span className="text-sm font-medium">0</span>
              </div>
              <Link href="/dashboard/settings/data-sources/connectors?type=dbt">
                <Button className="w-full">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Configure DBT
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service List Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Existing Services</h2>
        {/* This will be populated with actual services */}
        <div className="rounded-lg border border-dashed p-8 text-center">
          <DatabaseIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No connectors configured yet. Create your first data source connection.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataSourcesPage;
