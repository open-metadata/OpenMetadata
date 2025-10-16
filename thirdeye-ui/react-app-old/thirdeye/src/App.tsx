import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ZIScoreGauge from './components/features/ZIScoreGauge';
import BudgetForecast from './components/features/BudgetForecast';
import AutoSavesFeed from './components/features/AutoSavesFeed';
import ActionItems from './components/features/ActionItems';
import Login from './components/features/Login';
import TechniquesShowcase from './components/features/TechniquesShowcase';
import Help from './components/features/Help';
import Insights from './components/features/Insights';
import BackgroundEffects from './components/ui/BackgroundEffects';
import Signup from './pages/signup';
import VerifyEmail from './pages/verify-email';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import SettingsPage from './pages/settings';
import { trpc } from './lib/trpc-client';
import { useAuth, useAuthActions } from './state/auth';
import { setupTokenRefresh } from './lib/trpc-client';
import './styles/globals.css';

// Define page types
type PageType = 'dashboard' | 'techniques' | 'help' | 'insights' | 'settings';

const Dashboard: React.FC<{ onLogout: () => void; onNavigate: (page: PageType) => void; isAuthenticated: boolean }> = ({ onLogout, onNavigate, isAuthenticated }) => {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = trpc.dashboard.getDashboardData.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Convert string values to numbers for chart rendering
  // Note: tRPC with superjson wraps data in a 'json' property when serializing
  const rawData = dashboardData as any;
  const processedData = rawData ? {
    ziScore: {
      score: Math.round(parseFloat(rawData.ziScore?.score || '0')),
      breakdown: {
        compute: parseFloat(rawData.ziScore?.breakdown?.compute || '0'),
        storage: parseFloat(rawData.ziScore?.breakdown?.storage || '0'),
        query: parseFloat(rawData.ziScore?.breakdown?.query || '0'),
        others: parseFloat(rawData.ziScore?.breakdown?.others || '0')
      }
    },
    budgetForecast: {
      total_monthly_cost_usd: parseFloat(rawData.budgetForecast?.total_monthly_cost_usd || '0'),
      monthly_savings_opportunity_usd: parseFloat(rawData.budgetForecast?.monthly_savings_opportunity_usd || '0'),
      roi: parseFloat(rawData.budgetForecast?.roi || '0')
    },
    metadata: rawData.metadata
  } : null;
  
  // Debug logging
  console.log('Dashboard Data:', { dashboardData, dashboardLoading, dashboardError });
  console.log('Processed Data:', processedData);
  console.log('ZI Score (processed):', processedData?.ziScore);
  
  // Use only tRPC loading and error states
  const loading = dashboardLoading;
  const error = dashboardError?.message;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex">
      <BackgroundEffects />
      
      <Sidebar onLogout={onLogout} onNavigate={onNavigate} currentPage="dashboard" />
      
      <div className="flex-1 flex flex-col">
        <TopBar title="" />
        
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Main Dashboard Content */}
          <div className="grid grid-cols-10 gap-6">
            {/* ZI Score Gauge - 70% width */}
            <div className="col-span-7">
              <ZIScoreGauge 
                score={processedData?.ziScore?.score || 0} 
                breakdown={processedData?.ziScore?.breakdown || {}}
                onNavigate={onNavigate}
              />
            </div>

            {/* Side Tiles - 30% width */}
            <div className="col-span-3 flex flex-col justify-center space-y-6">
              <BudgetForecast budgetData={processedData?.budgetForecast || {}} />
              <AutoSavesFeed />
            </div>
          </div>

          {/* Action Items Section */}
          <div className="w-full max-w-full overflow-hidden">
            <ActionItems />
          </div>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { isAuthenticated, isLoading, isRefreshing } = useAuth();
  const { clearAuth, setAuth } = useAuthActions();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const handleLogin = (loginData: {
    user: any;
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn?: number;
  }) => {
    setAuth(loginData.user, loginData.accessToken, loginData.refreshToken, loginData.expiresIn || 3600);
  };

  const handleLogout = (reason?: string) => {
    clearAuth();
    if (reason) setGlobalError(reason);
  };

  const handleNavigate = (page: PageType) => {
    navigate(`/${page}`);
  };

  // Setup token refresh on mount
  useEffect(() => {
    const cleanup = setupTokenRefresh();
    setIsAuthChecked(true);
    
    return cleanup;
  }, []);

  // Global tRPC error handler for 401/UNAUTHORIZED
  React.useEffect(() => {
    const origConsoleError = window.console.error;
    window.console.error = function (...args) {
      if (args && args.length > 0 && typeof args[0] === 'string') {
        const msg = args[0];
        if (msg.includes('UNAUTHORIZED') || msg.includes('401')) {
          handleLogout('Your session has expired or you are not authorized. Please log in again.');
        }
      }
      origConsoleError.apply(window.console, args);
    };
    return () => {
      window.console.error = origConsoleError;
    };
  }, []);

  // Show loading screen while checking authentication
  if (!isAuthChecked || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">{isRefreshing ? 'Refreshing session...' : 'Loading...'}</div>
      </div>
    );
  }

  // Show auth pages if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        {globalError && (
          <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-50">{globalError}</div>
        )}
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  // Render authenticated routes
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard onLogout={handleLogout} onNavigate={handleNavigate} isAuthenticated={isAuthenticated} />} />
      <Route path="/techniques" element={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex">
          <BackgroundEffects />
          <Sidebar onLogout={handleLogout} onNavigate={handleNavigate} currentPage="techniques" />
          <div className="flex-1">
            <TechniquesShowcase />
          </div>
        </div>
      } />
      <Route path="/help" element={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex">
          <BackgroundEffects />
          <Sidebar onLogout={handleLogout} onNavigate={handleNavigate} currentPage="help" />
          <div className="flex-1">
            <Help />
          </div>
        </div>
      } />
      <Route path="/insights" element={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex">
          <BackgroundEffects />
          <Sidebar onLogout={handleLogout} onNavigate={handleNavigate} currentPage="insights" />
          <div className="flex-1">
            <Insights />
          </div>
        </div>
      } />
      <Route path="/settings" element={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden flex">
          <BackgroundEffects />
          <Sidebar onLogout={handleLogout} onNavigate={handleNavigate} currentPage="settings" />
          <div className="flex-1">
            <SettingsPage />
          </div>
        </div>
      } />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;