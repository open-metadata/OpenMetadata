/**
 * Development server utilities
 * Provides backend health checks and connectivity info similar to OpenMetadata dev setup
 */

import { getBackendUrl, isDevelopmentMode } from './proxy-config';

interface BackendHealth {
  isConnected: boolean;
  backendUrl: string;
  status: 'ok' | 'error' | 'unknown';
  latencyMs?: number;
  lastChecked: Date;
}

export class DevelopmentServer {
  private static instance: DevelopmentServer;
  private healthCache: BackendHealth | null = null;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  static getInstance(): DevelopmentServer {
    if (!DevelopmentServer.instance) {
      DevelopmentServer.instance = new DevelopmentServer();
    }
    return DevelopmentServer.instance;
  }

  /**
   * Check if the backend OpenMetadata server is accessible
   */
  async checkBackendHealth(): Promise<BackendHealth> {
    const now = Date.now();
    
    // Return cached result if recent
    if (
      this.healthCache && 
      (now - this.lastHealthCheck) < this.HEALTH_CHECK_INTERVAL &&
      this.healthCache.status !== 'unknown'
    ) {
      return this.healthCache;
    }

    const backendUrl = getBackendUrl();
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${backendUrl}/api/v1/system/version`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 5000
      });

      const latencyMs = Date.now() - startTime;

      this.healthCache = {
        isConnected: response.ok,
        backendUrl,
        status: response.ok ? 'ok' : 'error',
        latencyMs,
        lastChecked: new Date()
      };

      this.lastHealthCheck = now;
      return this.healthCache;

    } catch (error) {
      console.warn('🗂️ Backend health check failed:', error);
      
      this.healthCache = {
        isConnected: false,
        backendUrl,
        status: 'error',
        lastChecked: new Date()
      };

      this.lastHealthCheck = now;
      return this.healthCache;
    }
  }

  /**
   * Get backend connection info for development debugging
   */
  getBackendConnectionInfo() {
    return {
      backendUrl: getBackendUrl(),
      isDevelopmentMode: isDevelopmentMode(),
      healthCache: this.healthCache,
      env: {
        DEV_SERVER_TARGET: process.env.DEV_SERVER_TARGET,
        OPENMETADATA_BASE_URL: process.env.OPENMETADATA_BASE_URL
      }
    };
  }

  /**
   * Log development server startup info
   */
  logDevelopmentInfo() {
    console.log('🚀 ThirdEye Development Server Starting...');
    console.log(`📡 Backend Target: ${getBackendUrl()}`);
    console.log(`🔄 Proxy configured for /api/v1/*`);
    console.log('🔗 Routes:');
    console.log('   localhost:3000/api/v1/* → Backend OpenMetadata API');
    console.log('   localhost:3000/health   → Backend Health Check');
    console.log('');
    
    if (isDevelopmentMode()) {
      console.log('💡 Tips for Development:');
      console.log('   - Ensure OpenMetadata backend is running on ' + getBackendUrl());
      console.log('   - Check backend connectivity with npm run dev:health');
      console.log('');
    }
  }
}
