import React, { useState } from 'react';
import { trpc } from '../../lib/trpc-client';
import { useAuthStore } from '../../state/auth';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedButton } from '../../components/ui/AnimatedButton';

interface LinkedProvider {
  provider: string;
  email: string;
  connectedAt: string;
  isPrimary: boolean;
}

export function AccountsSettings() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mock data - replace with actual API calls
  const [linkedProviders] = useState<LinkedProvider[]>([
    {
      provider: 'google',
      email: user?.email || '',
      connectedAt: '2024-01-15T10:30:00Z',
      isPrimary: true
    }
  ]);

  const linkProviderMutation = trpc.oauth.link.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Account linked successfully!' });
        // Redirect to OAuth provider or handle the response
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });

  const unlinkProviderMutation = trpc.oauth.unlink.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Account unlinked successfully!' });
        // Refresh the providers list
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message });
    },
    onSettled: () => {
      setIsLoading(null);
    }
  });

  const handleLinkProvider = (provider: string) => {
    setIsLoading(provider);
    setMessage(null);
    linkProviderMutation.mutate({ provider: provider as any });
  };

  const handleUnlinkProvider = (provider: string) => {
    if (linkedProviders.length === 1 && linkedProviders[0].isPrimary) {
      setMessage({ type: 'error', text: 'Cannot unlink the last remaining account. Please add another account first.' });
      return;
    }

    setIsLoading(provider);
    setMessage(null);
    unlinkProviderMutation.mutate({ provider: provider as any });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        );
      case 'snowflake':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#29B5E8">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        );
      default:
        return (
          <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">{provider.charAt(0).toUpperCase()}</span>
          </div>
        );
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'Google';
      case 'snowflake':
        return 'Snowflake';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  };

  const availableProviders = [
    { id: 'google', name: 'Google', description: 'Sign in with your Google account' },
    { id: 'snowflake', name: 'Snowflake', description: 'Connect your Snowflake account' }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Connected Accounts</h1>
        <p className="text-gray-300">Manage your connected third-party accounts</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-900/50 border border-green-600 text-green-400' 
            : 'bg-red-900/50 border border-red-600 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Linked Accounts */}
      <GlassCard className="p-8 mb-8">
        <h2 className="text-xl font-semibold text-white mb-6">Linked Accounts</h2>
        <div className="space-y-4">
          {linkedProviders.map((provider) => (
            <div key={provider.provider} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-4">
                {getProviderIcon(provider.provider)}
                <div>
                  <h3 className="text-white font-medium">{getProviderName(provider.provider)}</h3>
                  <p className="text-gray-400 text-sm">{provider.email}</p>
                  {provider.isPrimary && (
                    <span className="inline-block px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full mt-1">
                      Primary
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-sm">
                  Connected {new Date(provider.connectedAt).toLocaleDateString()}
                </span>
                {!provider.isPrimary && (
                  <AnimatedButton
                    onClick={() => handleUnlinkProvider(provider.provider)}
                    disabled={isLoading === provider.provider}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isLoading === provider.provider ? 'Unlinking...' : 'Unlink'}
                  </AnimatedButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Available Providers */}
      <GlassCard className="p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Connect New Account</h2>
        <div className="space-y-4">
          {availableProviders.map((provider) => {
            const isLinked = linkedProviders.some(p => p.provider === provider.id);
            const isCurrentlyLoading = isLoading === provider.id;
            
            return (
              <div key={provider.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center space-x-4">
                  {getProviderIcon(provider.id)}
                  <div>
                    <h3 className="text-white font-medium">{provider.name}</h3>
                    <p className="text-gray-400 text-sm">{provider.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {isLinked ? (
                    <span className="text-green-400 text-sm font-medium">Connected</span>
                  ) : (
                    <AnimatedButton
                      onClick={() => handleLinkProvider(provider.id)}
                      disabled={isCurrentlyLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isCurrentlyLoading ? 'Connecting...' : 'Connect'}
                    </AnimatedButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Security Notice */}
      <GlassCard className="p-6 mt-8 bg-amber-900/20 border-amber-600/50">
        <div className="flex items-start space-x-3">
          <svg className="w-6 h-6 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h4 className="text-amber-400 font-medium">Security Notice</h4>
            <p className="text-amber-300 text-sm mt-1">
              You must always have at least one connected account. If you want to unlink your primary account, 
              please connect another account first to avoid being locked out.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
