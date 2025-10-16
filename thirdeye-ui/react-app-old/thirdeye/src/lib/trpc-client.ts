import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/routers/_app';
// Removed unused import
import { getAccessToken, getRefreshToken, useAuthStore } from '../state/auth';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In the browser, always use port 3002 for backend
    return 'http://localhost:3002';
  }
  // On the server (SSR), use VERCEL_URL if available, else fallback to localhost
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3002';
};

// Function to attempt token refresh
async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const { setRefreshing } = useAuthStore.getState();
  setRefreshing(true);

  try {
    const response = await fetch(`${getBaseUrl()}/trpc/auth.refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    
    if (data.result?.data?.success) {
      const { user, accessToken, refreshToken: newRefreshToken, expiresIn } = data.result.data;
      
      // Update auth state with new tokens
      useAuthStore.getState().setAuth(user, accessToken, newRefreshToken, expiresIn);
      return true;
    } else {
      throw new Error('Invalid refresh response');
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  } finally {
    setRefreshing(false);
  }
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      maxURLLength: 2000,
      async headers() {
        if (typeof window !== 'undefined') {
          const accessToken = getAccessToken();
          if (accessToken) {
            return {
              Authorization: `Bearer ${accessToken}`,
            };
          }
        }
        return {};
      },
    }),
  ],
});

// Auto-refresh token before expiry
let refreshTimer: NodeJS.Timeout | null = null;

export function setupTokenRefresh(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const scheduleRefresh = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    const { expiresAt } = useAuthStore.getState();
    if (!expiresAt) return;

    // Refresh 5 minutes before expiry
    const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      refreshTimer = setTimeout(async () => {
        const success = await attemptTokenRefresh();
        if (success) {
          scheduleRefresh(); // Schedule next refresh
        }
      }, refreshTime);
    }
  };

  // Schedule initial refresh
  scheduleRefresh();

  // Listen for auth state changes to reschedule
  const unsubscribe = useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.expiresAt) {
      scheduleRefresh();
    } else {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    }
  });

  return () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    unsubscribe();
  };
}