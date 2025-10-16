'use client';

import { useState } from 'react';
import { Plus, Database, Settings, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Mock connectors data
const connectors = [
  {
    id: '1',
    name: 'Production Snowflake',
    type: 'Snowflake',
    status: 'active',
    lastRun: '2 min ago',
    nextRun: 'in 58 min',
    databases: 5,
    tables: 1247,
    description: 'Main production data warehouse'
  },
  {
    id: '2',
    name: 'Analytics PostgreSQL',
    type: 'PostgreSQL',
    status: 'active',
    lastRun: '5 min ago',
    nextRun: 'in 55 min',
    databases: 3,
    tables: 89,
    description: 'Analytics and reporting database'
  },
  {
    id: '3',
    name: 'Marketing MySQL',
    type: 'MySQL',
    status: 'paused',
    lastRun: '2 hours ago',
    nextRun: 'paused',
    databases: 2,
    tables: 45,
    description: 'Marketing campaign data'
  }
];

const SnowflakeForm = ({ onClose }: { onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    account: '',
    username: '',
    password: '',
    warehouse: '',
    role: '',
    database: '',
    schema: '',
    schedule: '0 */6 * * *',
    includeTables: '',
    excludeTables: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    toast.success('Snowflake connector created successfully!');
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Connector Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Production Snowflake"
            required
          />
        </div>
        <div>
          <Label htmlFor="account">Account</Label>
          <Input
            id="account"
            value={formData.account}
            onChange={(e) => setFormData({...formData, account: e.target.value})}
            placeholder="your-account.snowflakecomputing.com"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            placeholder="snowflake_user"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            placeholder="••••••••"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="warehouse">Warehouse</Label>
          <Input
            id="warehouse"
            value={formData.warehouse}
            onChange={(e) => setFormData({...formData, warehouse: e.target.value})}
            placeholder="COMPUTE_WH"
            required
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            placeholder="PUBLIC"
            required
          />
        </div>
        <div>
          <Label htmlFor="database">Database</Label>
          <Input
            id="database"
            value={formData.database}
            onChange={(e) => setFormData({...formData, database: e.target.value})}
            placeholder="PROD_DB"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="schema">Schema</Label>
        <Input
          id="schema"
          value={formData.schema}
          onChange={(e) => setFormData({...formData, schema: e.target.value})}
          placeholder="PUBLIC"
          required
        />
      </div>

      <div>
        <Label htmlFor="schedule">Schedule (Cron)</Label>
        <Input
          id="schedule"
          value={formData.schedule}
          onChange={(e) => setFormData({...formData, schedule: e.target.value})}
          placeholder="0 */6 * * *"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="includeTables">Include Tables (regex)</Label>
          <Input
            id="includeTables"
            value={formData.includeTables}
            onChange={(e) => setFormData({...formData, includeTables: e.target.value})}
            placeholder=".*"
          />
        </div>
        <div>
          <Label htmlFor="excludeTables">Exclude Tables (regex)</Label>
          <Input
            id="excludeTables"
            value={formData.excludeTables}
            onChange={(e) => setFormData({...formData, excludeTables: e.target.value})}
            placeholder="temp_.*"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Create Connector</Button>
      </div>
    </form>
  );
};

export default function ConnectorsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connectors</h1>
          <p className="text-muted-foreground">
            Manage data source connections and ingestion pipelines
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Connector</DialogTitle>
              <DialogDescription>
                Set up a new data source connection
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Connector Type</Label>
                <Select defaultValue="snowflake">
                  <SelectTrigger>
                    <SelectValue placeholder="Select connector type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snowflake">Snowflake</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="dbt">dbt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <SnowflakeForm onClose={() => setIsCreateDialogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connectors Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {connectors.map((connector) => (
          <Card key={connector.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{connector.name}</CardTitle>
                </div>
                <Badge className={getStatusColor(connector.status)}>
                  {connector.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {connector.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{connector.type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Run:</span>
                    <p className="font-medium">{connector.lastRun}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Databases:</span>
                    <p className="font-medium">{connector.databases}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tables:</span>
                    <p className="font-medium">{connector.tables}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Configure
                  </Button>
                  <Button variant="outline" size="sm">
                    {connector.status === 'active' ? (
                      <Pause className="h-4 w-4 mr-1" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    {connector.status === 'active' ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
