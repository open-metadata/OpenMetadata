'use client';

import { useState } from 'react';
import { Plus, Bot, AlertTriangle, Send, Slack, Webhook, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Mock rules data
const rules = [
  {
    id: '1',
    name: 'Data Quality Alert',
    trigger: 'table_quality_failed',
    condition: 'quality_score < 0.8',
    action: 'slack_notification',
    status: 'active',
    lastTriggered: '2 hours ago',
    triggerCount: 5
  },
  {
    id: '2',
    name: 'Pipeline Failure',
    trigger: 'pipeline_failed',
    condition: 'status == "failed"',
    action: 'webhook_alert',
    status: 'active',
    lastTriggered: '1 day ago',
    triggerCount: 2
  },
  {
    id: '3',
    name: 'High Cost Alert',
    trigger: 'cost_threshold',
    condition: 'daily_cost > 100',
    action: 'email_notification',
    status: 'paused',
    lastTriggered: 'Never',
    triggerCount: 0
  }
];

const RuleForm = ({ rule, onClose }: { rule?: any; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    trigger: rule?.trigger || '',
    condition: rule?.condition || '',
    action: rule?.action || '',
    webhookUrl: '',
    slackChannel: '',
    status: rule?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    toast.success(rule ? 'Rule updated successfully!' : 'Rule created successfully!');
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="Data Quality Alert"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="trigger">Trigger Event</Label>
          <Select value={formData.trigger} onValueChange={(value) => setFormData({...formData, trigger: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table_quality_failed">Table Quality Failed</SelectItem>
              <SelectItem value="pipeline_failed">Pipeline Failed</SelectItem>
              <SelectItem value="cost_threshold">Cost Threshold</SelectItem>
              <SelectItem value="data_freshness">Data Freshness</SelectItem>
              <SelectItem value="anomaly_detected">Anomaly Detected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="condition">Condition</Label>
          <Input
            id="condition"
            value={formData.condition}
            onChange={(e) => setFormData({...formData, condition: e.target.value})}
            placeholder="quality_score < 0.8"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="action">Action</Label>
        <Select value={formData.action} onValueChange={(value) => setFormData({...formData, action: value})}>
          <SelectTrigger>
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slack_notification">Slack Notification</SelectItem>
            <SelectItem value="webhook_alert">Webhook Alert</SelectItem>
            <SelectItem value="email_notification">Email Notification</SelectItem>
            <SelectItem value="auto_pause">Auto Pause Pipeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.action === 'slack_notification' && (
        <div>
          <Label htmlFor="slackChannel">Slack Channel</Label>
          <Input
            id="slackChannel"
            value={formData.slackChannel}
            onChange={(e) => setFormData({...formData, slackChannel: e.target.value})}
            placeholder="#data-alerts"
          />
        </div>
      )}

      {formData.action === 'webhook_alert' && (
        <div>
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            value={formData.webhookUrl}
            onChange={(e) => setFormData({...formData, webhookUrl: e.target.value})}
            placeholder="https://hooks.slack.com/..."
          />
        </div>
      )}

      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {rule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </form>
  );
};

export default function RuleAgentPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'slack_notification': return <Slack className="h-4 w-4" />;
      case 'webhook_alert': return <Webhook className="h-4 w-4" />;
      case 'email_notification': return <Send className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rule Agent</h1>
          <p className="text-muted-foreground">
            Configure automated rules and alerting actions
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Rule</DialogTitle>
              <DialogDescription>
                Set up an automated rule with trigger conditions and actions
              </DialogDescription>
            </DialogHeader>
            
            <RuleForm onClose={() => setIsCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">{rule.name}</CardTitle>
                </div>
                <Badge className={getStatusColor(rule.status)}>
                  {rule.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Trigger:</strong> {rule.trigger}</p>
                <p><strong>Condition:</strong> {rule.condition}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getActionIcon(rule.action)}
                  <span className="text-sm font-medium">{rule.action.replace('_', ' ')}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Last Triggered:</span>
                    <p className="font-medium">{rule.lastTriggered}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trigger Count:</span>
                    <p className="font-medium">{rule.triggerCount}</p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
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

      {/* Edit Rule Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription>
              Modify the rule configuration
            </DialogDescription>
          </DialogHeader>
          
          <RuleForm rule={editingRule} onClose={() => setEditingRule(null)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
