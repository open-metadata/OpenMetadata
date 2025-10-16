'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, TestTube, AlertCircle, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { DatabasesClient } from '@/lib/connectorsClient';

interface DbtConnectorFormProps {
  onServiceCreated: () => void;
}

interface DbtConfig {
  dbtCatalogFilePath: string;
  dbtManifestFilePath: string;
  dbtRunResultsFilePath?: string;
  dbtPrefixPath?: string;
  schemaName?: string;
}

interface ServiceFormData {
  name: string;
  description?: string;
  config: DbtConfig;
}

export default function DbtConnectorForm({ onServiceCreated }: DbtConnectorFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    config: {
      dbtCatalogFilePath: '',
      dbtManifestFilePath: '',
      dbtRunResultsFilePath: '',
      dbtPrefixPath: '',
      schemaName: '',
    },
  });
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const handleInputChange = (field: keyof ServiceFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConfigChange = (field: keyof DbtConfig, value: string) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value,
      },
    }));
  };

  const validateForm = () => {
    const { name, config } = formData;
    
    if (!name.trim()) {
      toast.error('Service name is required');
      return false;
    }
    
    if (!config.dbtCatalogFilePath.trim()) {
      toast.error('DBT Catalog file path is required');
      return false;
    }
    
    if (!config.dbtManifestFilePath.trim()) {
      toast.error('DBT Manifest file path is required');
      return false;
    }
    
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;
    
    setTestLoading(true);
    try {
      const client = new DatabasesClient();
      const testRequest = {
        connection: {
          config: formData.config
        }
      };
      
      await client.testConnection('DbtPipeline', testRequest);
      toast.success('✅ DBT configuration test successful!');
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('❌ DBT configuration test failed. Please check your file paths.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const client = new DatabasesClient();
      
      const servicePayload = {
        name: formData.name,
        description: formData.description,
        serviceType: 'DbtPipeline',
        connection: {
          config: formData.config,
        },
      };
      
      await client.createService(servicePayload);
      
      toast.success('DBT service created successfully!');
      onServiceCreated();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        config: {
          dbtCatalogFilePath: '',
          dbtManifestFilePath: '',
          dbtRunResultsFilePath: '',
          dbtPrefixPath: '',
          schemaName: '',
        },
      });
      
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('Failed to create DBT service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Workflow className="mr-2 h-5 w-5" />
            DBT Pipeline Configuration
          </CardTitle>
          <CardDescription>
            Configure your DBT transformation pipeline connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="dbtServiceName">Service Name *</Label>
              <Input
                id="dbtServiceName"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., DBT-Production-Pipeline"
              />
            </div>
            
            <div>
              <Label htmlFor="dbtServiceDescription">Description</Label>
              <Textarea
                id="dbtServiceDescription"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional description for your DBT service"
                rows={3}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-4">DBT File Configurations</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="catalogPath">DBT Catalog File Path *</Label>
                <Input
                  id="catalogPath"
                  value={formData.config.dbtCatalogFilePath}
                  onChange={(e) => handleConfigChange('dbtCatalogFilePath', e.target.value)}
                  placeholder="path/to/catalog.json"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Path to your DBT catalog.json file
                </p>
              </div>
              
              <div>
                <Label htmlFor="manifestPath">DBT Manifest File Path *</Label>
                <Input
                  id="manifestPath"
                  value={formData.config.dbtManifestFilePath}
                  onChange={(e) => handleConfigChange('dbtManifestFilePath', e.target.value)}
                  placeholder="path/to/manifest.json"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Path to your DBT manifest.json file
                </p>
              </div>
              
              <div>
                <Label htmlFor="runResultsPath">DBT Run Results File Path</Label>
                <Input
                  id="runResultsPath"
                  value={formData.config.dbtRunResultsFilePath}
                  onChange={(e) => handleConfigChange('dbtRunResultsFilePath', e.target.value)}
                  placeholder="path/to/run_results.json"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Path to run_results.json for lineage information
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prefixPath">DBT Prefix Path</Label>
                  <Input
                    id="prefixPath"
                    value={formData.config.dbtPrefixPath}
                    onChange={(e) => handleConfigChange('dbtPrefixPath', e.target.value)}
                    placeholder="path/to/dbt"
                  />
                </div>
                
                <div>
                  <Label htmlFor="schemaName">Schema Name</Label>
                  <Input
                    id="schemaName"
                    value={formData.config.schemaName}
                    onChange={(e) => handleConfigChange('schemaName', e.target.value)}
                    placeholder="dbt_schema"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={testLoading}
        >
          {testLoading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="mr-2 h-4 w-4" />
          )}
          Test Configuration
        </Button>

        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Workflow className="mr-2 h-4 w-4" />
          )}
          Create DBT Service
        </Button>
      </div>

      {/* Connection Tips */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>DBT Setup:</strong> Make sure your DBT catalog.json and manifest.json files are 
          accessible and correctly formatted. The run_results.json file is optional but recommended 
          for complete lineage tracking.
        </AlertDescription>
      </Alert>
    </div>
  );
}
