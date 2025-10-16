'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Settings, Trash2, Eye, RefreshCw, Snowflake, Workflow } from 'lucide-react';
import { DatabaseService, ConnectorType } from '../page';
import { toast } from 'sonner';
import { DatabasesClient } from '@/lib/connectorsClient';

interface ServiceListProps {
  services: DatabaseService[];
  loading: boolean;
  connectorType: ConnectorType;
  onServiceDeleted: () => void;
  onServiceEdit?: (service: DatabaseService) => void;
}

const ServiceList = ({ services, loading, connectorType, onServiceDeleted, onServiceEdit }: ServiceListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteService = async (serviceId: string) => {
    setDeletingId(serviceId);
    try {
      const client = new DatabasesClient();
      await client.deleteService(serviceId);
      toast.success('Service deleted successfully');
      onServiceDeleted();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    } finally {
      setDeletingId(null);
    }
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'Snowflake':
        return <Snowflake className="h-4 w-4 text-blue-600" />;
      case 'DbtPipeline':
        return <Workflow className="h-4 w-4 text-orange-600" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getServiceBadgeColor = (serviceType: string) => {
    switch (serviceType) {
      case 'Snowflake':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DbtPipeline':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (service: DatabaseService) => {
    // This would be expanded based on actual service status
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
        Active
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Existing Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" />
          Existing Services
        </CardTitle>
        <CardDescription>
          {connectorType === 'snowflake' 
            ? 'Manage your Snowflake connections'
            : connectorType === 'dbt'
            ? 'Manage your DBT pipelines'
            : 'Manage your data source connections'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No {connectorType === 'snowflake' ? 'Snowflake' : connectorType === 'dbt' ? 'DBT' : ''} services configured yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first connection to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getServiceIcon(service.serviceType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="font-medium truncate">
                        {service.name}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getServiceBadgeColor(service.serviceType)}`}
                      >
                        {service.serviceType}
                      </Badge>
                      {getStatusBadge(service)}
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onServiceEdit?.(service)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={deletingId === service.id}
                      >
                        {deletingId === service.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Service</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the service "{service.name}"? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteService(service.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ServiceList;
