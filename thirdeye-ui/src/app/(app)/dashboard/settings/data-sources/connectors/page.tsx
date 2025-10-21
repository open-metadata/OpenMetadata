'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/Skeleton';
import { DatabasesClient } from '@/lib/connectorsClient';
import SnowflakeConnectorForm from './components/SnowflakeConnectorForm';
import DbtConnectorForm from './components/DbtConnectorForm';
import ServiceList from './components/ServiceList';
import ConnectorHeader from './components/ConnectorHeader';

export interface DatabaseService {
  id: string;
  name: string;
  serviceType: 'Snowflake' | 'DbtPipeline';
  fullyQualifiedName?: string;
  description?: string;
  connection?: {
    config: Record<string, any>;
  };
}

export type ConnectorType = 'snowflake' | 'dbt' | '';

const ConnectorsPageContent = () => {
  const searchParams = useSearchParams();
  const connectorType = searchParams.get('type') as ConnectorType || '';
  
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<DatabaseService[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingService, setEditingService] = useState<DatabaseService | null>(null);

  const loadServices = async () => {
    try {
      setLoading(true);
      const client = new DatabasesClient();
      const serviceList = await client.listServices();
      
      const filteredServices = connectorType === 'snowflake' 
        ? serviceList.filter(s => s.serviceType === 'Snowflake')
        : connectorType === 'dbt' 
        ? serviceList.filter(s => s.serviceType === 'DbtPipeline')
        : serviceList;
      
      setServices(filteredServices);
    } catch (error) {
      console.error('Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [connectorType, refreshTrigger]);

  const handleServiceCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setEditingService(null);
  };

  const handleServiceEdit = (service: DatabaseService) => {
    setEditingService(service);
  };

  const handleCancelEdit = () => {
    setEditingService(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const renderConnectorForm = () => {
    switch (connectorType) {
      case 'snowflake':
        return (
          <SnowflakeConnectorForm 
            onServiceCreated={handleServiceCreated}
            editingService={editingService}
            onCancelEdit={handleCancelEdit}
          />
        );
      case 'dbt':
        return (
          <DbtConnectorForm 
            onServiceCreated={handleServiceCreated}
            editingService={editingService}
            onCancelEdit={handleCancelEdit}
          />
        );
      default:
        return <div>Select a connector type to configure.</div>;
    }
  };

  return (
    <div className="space-y-6">
      <ConnectorHeader 
        connectorType={connectorType}
      />
      
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {connectorType && renderConnectorForm()}
          
          {!connectorType && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Select a connector type from the data sources page to get started.
              </p>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-4">
          <ServiceList 
            services={services}
            loading={loading}
            connectorType={connectorType}
            onServiceDeleted={() => handleServiceCreated()}
            onServiceEdit={handleServiceEdit}
          />
        </div>
      </div>
    </div>
  );
};

const ConnectorsPage = () => {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    }>
      <ConnectorsPageContent />
    </Suspense>
  );
};

export default ConnectorsPage;
