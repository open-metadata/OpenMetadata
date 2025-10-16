'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Snowflake, RefreshCw, TestTube, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DatabasesClient } from '@/lib/connectorsClient';
import { DatabaseService } from '../page';

interface SnowflakeConnectorFormProps {
  onServiceCreated: () => void;
  editingService?: DatabaseService | null;
  onCancelEdit?: () => void;
}

interface SnowflakeConfig {
  account: string;
  username: string;
  password?: string;
  warehouse: string;
  database?: string;
  role?: string;
  queryTag?: string;
  accountUsageSchema?: string;
  privateKey?: string;
  snowflakePrivatekeyPassphrase?: string;
  includeTransientTables?: boolean;
  includeStreams?: boolean;
  clientSessionKeepAlive?: boolean;
  creditCost?: number;
}

interface ServiceFormData {
  name: string;
  description?: string;
  config: SnowflakeConfig;
}

export default function SnowflakeConnectorForm({ onServiceCreated, editingService, onCancelEdit }: SnowflakeConnectorFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    config: {
      account: '',
      username: '',
      password: '',
      warehouse: '',
      database: '',
      role: '',
      queryTag: '',
      accountUsageSchema: 'SNOWFLAKE.ACCOUNT_USAGE',
      privateKey: '',
      snowflakePrivatekeyPassphrase: '',
      includeTransientTables: true,
      includeStreams: false,
      clientSessionKeepAlive: false,
      creditCost: 3.3,
    },
  });
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Load editing service data
  useEffect(() => {
    if (editingService) {
      setFormData({
        name: editingService.name,
        description: editingService.description || '',
        config: {
          account: editingService.connection?.config?.account || '',
          username: editingService.connection?.config?.username || '',
          password: editingService.connection?.config?.password || '',
          warehouse: editingService.connection?.config?.warehouse || '',
          database: editingService.connection?.config?.database || '',
          role: editingService.connection?.config?.role || '',
          queryTag: editingService.connection?.config?.queryTag || '',
          accountUsageSchema: editingService.connection?.config?.accountUsageSchema || 'SNOWFLAKE.ACCOUNT_USAGE',
          privateKey: editingService.connection?.config?.privateKey || '',
          snowflakePrivatekeyPassphrase: editingService.connection?.config?.snowflakePrivatekeyPassphrase || '',
          includeTransientTables: editingService.connection?.config?.includeTransientTables ?? true,
          includeStreams: editingService.connection?.config?.includeStreams ?? false,
          clientSessionKeepAlive: editingService.connection?.config?.clientSessionKeepAlive ?? false,
          creditCost: editingService.connection?.config?.creditCost || 3.3,
        },
      });
      setStep(2); // Go directly to connection step when editing
    } else {
      // Reset form when not editing
      setFormData({
        name: '',
        description: '',
        config: {
          account: '',
          username: '',
          password: '',
          warehouse: '',
          database: '',
          role: '',
          queryTag: '',
          accountUsageSchema: 'SNOWFLAKE.ACCOUNT_USAGE',
          privateKey: '',
          snowflakePrivatekeyPassphrase: '',
          includeTransientTables: true,
          includeStreams: false,
          clientSessionKeepAlive: false,
          creditCost: 3.3,
        },
      });
      setStep(1);
    }
  }, [editingService]);

  const handleInputChange = (field: keyof ServiceFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConfigChange = (field: keyof SnowflakeConfig, value: string | boolean | number) => {
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
    
    if (!config.account.trim()) {
      toast.error('Account is required');
      return false;
    }
    
    if (!config.username.trim()) {
      toast.error('Username is required');
      return false;
    }
    
    if (!config.warehouse.trim()) {
      toast.error('Warehouse is required');
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
      
      await client.testConnection('Snowflake', testRequest);
      toast.success('✅ Connection test successful!');
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error('❌ Connection test failed. Please check your credentials.');
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
        serviceType: 'Snowflake',
        connection: {
          config: formData.config,
        },
      };
      
      if (editingService) {
        // Update existing service
        await client.updateService(editingService.id, servicePayload);
        toast.success('Snowflake service updated successfully!');
      } else {
        // Create new service
        await client.createService(servicePayload);
        toast.success('Snowflake service created successfully!');
      }
      
      onServiceCreated();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        config: {
          account: '',
          username: '',
          password: '',
          warehouse: '',
          database: '',
          role: '',
          queryTag: '',
          accountUsageSchema: 'SNOWFLAKE.ACCOUNT_USAGE',
          privateKey: '',
          snowflakePrivatekeyPassphrase: '',
          includeTransientTables: true,
          includeStreams: false,
          clientSessionKeepAlive: false,
          creditCost: 3.3,
        },
      });
      setStep(1);
      
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(`Failed to ${editingService ? 'update' : 'create'} Snowflake service`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Information</CardTitle>
                <CardDescription>
                  Basic information about your Snowflake service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Snowflake-Production"
                  />
                </div>
                <div>
                  <Label htmlFor="serviceDescription">Description</Label>
                  <Textarea
                    id="serviceDescription"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Optional description for your Snowflake service"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Snowflake Connection</CardTitle>
                <CardDescription>
                  Configure your Snowflake connection details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="account">Account *</Label>
                    <Input
                      id="account"
                      value={formData.config.account}
                      onChange={(e) => handleConfigChange('account', e.target.value)}
                      placeholder="xyz1234.us-east-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your Snowflake account identifier (without .snowflakecomputing.com)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.config.username}
                      onChange={(e) => handleConfigChange('username', e.target.value)}
                      placeholder="your-username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.config.password}
                      onChange={(e) => handleConfigChange('password', e.target.value)}
                      placeholder="your-password"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="warehouse">Warehouse *</Label>
                    <Input
                      id="warehouse"
                      value={formData.config.warehouse}
                      onChange={(e) => handleConfigChange('warehouse', e.target.value)}
                      placeholder="COMPUTE_WH"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="database">Database</Label>
                    <Input
                      id="database"
                      value={formData.config.database}
                      onChange={(e) => handleConfigChange('database', e.target.value)}
                      placeholder="Production"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Restrict metadata reading to a single database
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={formData.config.role}
                      onChange={(e) => handleConfigChange('role', e.target.value)}
                      placeholder="SYSADMIN"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Snowflake role to use for connection
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="queryTag">Query Tag</Label>
                    <Input
                      id="queryTag"
                      value={formData.config.queryTag}
                      onChange={(e) => handleConfigChange('queryTag', e.target.value)}
                      placeholder="openmetadata_ingestion"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Session query tag for monitoring usage
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="accountUsageSchema">Account Usage Schema</Label>
                    <Input
                      id="accountUsageSchema"
                      value={formData.config.accountUsageSchema}
                      onChange={(e) => handleConfigChange('accountUsageSchema', e.target.value)}
                      placeholder="SNOWFLAKE.ACCOUNT_USAGE"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Schema where account usage data is stored
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="creditCost">Credit Cost</Label>
                  <Input
                    id="creditCost"
                    type="number"
                    step="0.1"
                    value={formData.config.creditCost}
                    onChange={(e) => handleConfigChange('creditCost', parseFloat(e.target.value) || 3.3)}
                    placeholder="3.3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cost of credit for the Snowflake account
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Advanced Options</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTransientTables"
                      checked={formData.config.includeTransientTables}
                      onCheckedChange={(checked) => handleConfigChange('includeTransientTables', checked as boolean)}
                    />
                    <Label htmlFor="includeTransientTables" className="text-sm">
                      Include Transient Tables
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include TRANSIENT tables in metadata ingestion
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeStreams"
                      checked={formData.config.includeStreams}
                      onCheckedChange={(checked) => handleConfigChange('includeStreams', checked as boolean)}
                    />
                    <Label htmlFor="includeStreams" className="text-sm">
                      Include Streams
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include streams in metadata ingestion
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clientSessionKeepAlive"
                      checked={formData.config.clientSessionKeepAlive}
                      onCheckedChange={(checked) => handleConfigChange('clientSessionKeepAlive', checked as boolean)}
                    />
                    <Label htmlFor="clientSessionKeepAlive" className="text-sm">
                      Client Session Keep Alive
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Keep client session active for longer ingestion processes
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Private Key Authentication (Optional)</h4>
                  
                  <div>
                    <Label htmlFor="privateKey">Private Key</Label>
                    <Textarea
                      id="privateKey"
                      value={formData.config.privateKey}
                      onChange={(e) => handleConfigChange('privateKey', e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Private key for Snowflake authentication
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="snowflakePrivatekeyPassphrase">Private Key Passphrase</Label>
                    <Input
                      id="snowflakePrivatekeyPassphrase"
                      type="password"
                      value={formData.config.snowflakePrivatekeyPassphrase}
                      onChange={(e) => handleConfigChange('snowflakePrivatekeyPassphrase', e.target.value)}
                      placeholder="Passphrase for private key"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Passphrase for the private key
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    step >= stepNumber
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stepNumber}
                </div>
                <span className={`ml-2 text-sm ${
                  step >= stepNumber ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {stepNumber === 1 ? 'Service Info' : 'Connection'}
                </span>
                {stepNumber < 2 && (
                  <div className="w-8 h-px bg-muted mx-4" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {renderStep()}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <div className="flex space-x-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          
          {step > 1 && (
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
              Test Connection
            </Button>
          )}
        </div>

        <div className="flex space-x-2">
          {editingService && (
            <Button variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          )}
          
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Snowflake className="mr-2 h-4 w-4" />
              )}
              {editingService ? 'Update Service' : 'Create Service'}
            </Button>
          )}
        </div>
      </div>

      {/* Connection Tips */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Connection Tips:</strong> Make sure your Snowflake user has privileges to read metadata from the databases you want to connect. 
          The account name should not include '.snowflakecomputing.com'.
        </AlertDescription>
      </Alert>
    </div>
  );
}
