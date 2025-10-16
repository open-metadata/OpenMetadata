'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionSetupProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function ConnectionSetup({ onConnectionChange }: ConnectionSetupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const testConnection = async () => {
    if (!baseUrl || !token) {
      toast.error('Please enter both Base URL and Token');
      return;
    }

    setIsLoading(true);
    try {
      // Save connection to cookie
      const response = await fetch('/api/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, token }),
      });

      if (!response.ok) throw new Error('Failed to save connection');

      // Test the connection
      const testResponse = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (testResponse.ok) {
        setIsConnected(true);
        toast.success('Connected successfully!');
        onConnectionChange?.(true);
        setIsOpen(false);
      } else {
        throw new Error(`Connection failed: ${testResponse.status}`);
      }
    } catch (error) {
      setIsConnected(false);
      toast.error(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onConnectionChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          {isConnected ? 'Connected' : 'Setup Connection'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ThirdEye Connection</DialogTitle>
          <DialogDescription>
            Connect to your ThirdEye API instance
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://api.thirdeye.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">API Token</label>
            <Input
              type="password"
              placeholder="Enter your API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Button 
              onClick={testConnection} 
              disabled={isLoading}
              className="flex-1 mr-2"
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
            
            {isConnected && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span className="text-sm">Connected</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
