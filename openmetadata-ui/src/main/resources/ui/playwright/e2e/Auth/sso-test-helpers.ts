/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Page } from '@playwright/test';

/**
 * SSO Test Helper Functions
 * Shared utilities for authentication testing
 */

export interface TokenInfo {
  token: string;
  expiresAt: number | null;
  isExpired: boolean;
  remainingTime: number | null;
}

/**
 * Retrieves token from Service Worker storage or localStorage
 */
export async function getTokenFromStorage(page: Page): Promise<string | null> {
  try {
    // Try Service Worker storage first
    const token = await page.evaluate(async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return new Promise<string | null>((resolve) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === 'GET_ITEM_RESPONSE') {
              try {
                const appState = JSON.parse(event.data.value || '{}');
                resolve(appState.primary || null);
              } catch {
                resolve(null);
              }
            }
          };
          navigator.serviceWorker.controller?.postMessage(
            { type: 'GET_ITEM', key: 'app_state' },
            [messageChannel.port2]
          );
          setTimeout(() => resolve(null), 5000);
        });
      }
      return null;
    });

    if (token) {
      return token;
    }

    // Fallback to localStorage
    return await page.evaluate(() => {
      const appState = localStorage.getItem('app_state');
      if (appState) {
        try {
          const parsed = JSON.parse(appState);
          return parsed.primary || null;
        } catch {
          return null;
        }
      }
      return null;
    });
  } catch (error) {
    console.error('Error getting token from storage:', error);
    return null;
  }
}

/**
 * Retrieves refresh token from storage
 */
export async function getRefreshTokenFromStorage(
  page: Page
): Promise<string | null> {
  try {
    const token = await page.evaluate(async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        return new Promise<string | null>((resolve) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === 'GET_ITEM_RESPONSE') {
              try {
                const appState = JSON.parse(event.data.value || '{}');
                resolve(appState.secondary || null);
              } catch {
                resolve(null);
              }
            }
          };
          navigator.serviceWorker.controller?.postMessage(
            { type: 'GET_ITEM', key: 'app_state' },
            [messageChannel.port2]
          );
          setTimeout(() => resolve(null), 5000);
        });
      }
      return null;
    });

    if (token) {
      return token;
    }

    return await page.evaluate(() => {
      const appState = localStorage.getItem('app_state');
      if (appState) {
        try {
          const parsed = JSON.parse(appState);
          return parsed.secondary || null;
        } catch {
          return null;
        }
      }
      return null;
    });
  } catch (error) {
    return null;
  }
}

/**
 * Clears all authentication tokens from storage
 */
export async function clearTokenFromStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Clear Service Worker storage
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      navigator.serviceWorker.controller?.postMessage(
        { type: 'REMOVE_ITEM', key: 'app_state' },
        [messageChannel.port2]
      );
    }

    // Clear localStorage
    localStorage.removeItem('app_state');
    localStorage.removeItem('oidc.user');
    localStorage.removeItem('oidc.refreshed');
    localStorage.removeItem('refreshInProgress');
    localStorage.clear();

    // Clear IndexedDB
    const databases = await indexedDB.databases();
    databases.forEach((db) => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  });
}

/**
 * Waits for token to be stored after login
 */
export async function waitForTokenInStorage(
  page: Page,
  timeout = 15000
): Promise<string> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const token = await getTokenFromStorage(page);
    if (token) {
      return token;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Token not found in storage within timeout');
}

/**
 * Decodes JWT token and extracts information
 */
export function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Gets JWT expiry timestamp
 */
export function getJWTExpiry(token: string): number | null {
  const payload = decodeJWT(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

/**
 * Gets comprehensive token information
 */
export function getTokenInfo(token: string): TokenInfo {
  const expiresAt = getJWTExpiry(token);
  const now = Date.now();
  const isExpired = expiresAt ? expiresAt < now : false;
  const remainingTime = expiresAt ? expiresAt - now : null;

  return {
    token,
    expiresAt,
    isExpired,
    remainingTime,
  };
}

/**
 * Checks if token will expire within specified milliseconds
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdMs: number
): boolean {
  const info = getTokenInfo(token);
  if (!info.remainingTime) {
    return false;
  }
  return info.remainingTime < thresholdMs;
}

/**
 * Validates token format
 */
export function isValidJWTFormat(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Waits for Service Worker to be ready
 */
export async function waitForServiceWorkerReady(
  page: Page,
  timeout = 10000
): Promise<boolean> {
  try {
    return await page.evaluate(
      async (timeoutMs) => {
        if (!('serviceWorker' in navigator)) {
          return false;
        }

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
          if (navigator.serviceWorker.controller) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return false;
      },
      timeout
    );
  } catch {
    return false;
  }
}

/**
 * Gets all localStorage keys related to auth
 */
export async function getAuthLocalStorageKeys(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes('oidc') ||
          key.includes('auth') ||
          key.includes('token') ||
          key === 'app_state')
      ) {
        keys.push(key);
      }
    }
    return keys;
  });
}

/**
 * Monitors storage events and returns when token changes
 */
export async function waitForStorageChange(
  page: Page,
  timeout = 10000
): Promise<boolean> {
  return await page.evaluate(
    (timeoutMs) => {
      return new Promise<boolean>((resolve) => {
        let resolved = false;

        const handler = (event: StorageEvent) => {
          if (
            event.key === 'app_state' ||
            event.key === 'oidc.refreshed' ||
            event.key === 'oidc.user'
          ) {
            if (!resolved) {
              resolved = true;
              resolve(true);
            }
          }
        };

        window.addEventListener('storage', handler);

        setTimeout(() => {
          window.removeEventListener('storage', handler);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }, timeoutMs);
      });
    },
    timeout
  );
}

/**
 * Verifies user is authenticated by checking UI elements
 */
export async function isUserAuthenticated(page: Page): Promise<boolean> {
  try {
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    const isVisible = await userMenu.isVisible({ timeout: 5000 });
    const hasToken = (await getTokenFromStorage(page)) !== null;
    return isVisible && hasToken;
  } catch {
    return false;
  }
}

/**
 * Performs logout action
 */
export async function performLogout(page: Page): Promise<void> {
  const userMenu = page.locator(
    '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
  );
  await userMenu.click();

  const logoutButton = page.getByRole('menuitem', { name: 'Logout' });
  await logoutButton.click();

  await page
    .locator('.ant-modal-body')
    .filter({ hasText: 'Are you sure you want' })
    .waitFor({ state: 'visible' });

  const waitLogout = page.waitForResponse(
    (response) =>
      response.url().includes('/logout') && response.request().method() === 'POST'
  );

  await page.getByTestId('confirm-logout').click();
  await waitLogout;
  await page.waitForURL('**/signin', { timeout: 10000 });
}

/**
 * Checks if current page is signin page
 */
export async function isOnSigninPage(page: Page): Promise<boolean> {
  return page.url().includes('/signin');
}

/**
 * Checks if current page is a protected route
 */
export async function isOnProtectedRoute(page: Page): Promise<boolean> {
  const url = page.url();
  const protectedRoutes = [
    '/my-data',
    '/explore',
    '/settings',
    '/glossary',
    '/data-quality',
  ];
  return protectedRoutes.some((route) => url.includes(route));
}

/**
 * Monitors API requests for auth headers
 */
export async function captureAuthHeaders(
  page: Page,
  durationMs = 5000
): Promise<string[]> {
  const authHeaders: string[] = [];

  const requestHandler = (request: any) => {
    if (request.url().includes('/api/v1/')) {
      const authHeader = request.headers()['authorization'];
      if (authHeader) {
        authHeaders.push(authHeader);
      }
    }
  };

  page.on('request', requestHandler);
  await page.waitForTimeout(durationMs);
  page.off('request', requestHandler);

  return authHeaders;
}

/**
 * Gets all API errors that occurred
 */
export async function captureAPIErrors(
  page: Page,
  durationMs = 5000
): Promise<Array<{ url: string; status: number; statusText: string }>> {
  const errors: Array<{ url: string; status: number; statusText: string }> = [];

  const responseHandler = (response: any) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      errors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  };

  page.on('response', responseHandler);
  await page.waitForTimeout(durationMs);
  page.off('response', responseHandler);

  return errors;
}

/**
 * Simulates token expiry by manipulating storage
 */
export async function simulateTokenExpiry(page: Page): Promise<void> {
  await page.evaluate(() => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.fake_signature';
    const appState = { primary: expiredToken };
    localStorage.setItem('app_state', JSON.stringify(appState));
  });
}

/**
 * Creates a fake JWT token with custom expiry
 */
export function createFakeJWT(expiryTimestamp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'test@example.com',
      exp: expiryTimestamp,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = 'fake_signature';
  return `${header}.${payload}.${signature}`;
}

/**
 * Injects a custom token into storage
 */
export async function injectToken(page: Page, token: string): Promise<void> {
  await page.evaluate((tokenValue) => {
    const appState = { primary: tokenValue };
    localStorage.setItem('app_state', JSON.stringify(appState));
  }, token);
}

/**
 * Gets user info from token
 */
export function getUserInfoFromToken(token: string): {
  email?: string;
  name?: string;
  sub?: string;
} | null {
  const payload = decodeJWT(token);
  if (!payload) {
    return null;
  }

  return {
    email: payload.email,
    name: payload.name,
    sub: payload.sub,
  };
}

/**
 * Validates token has required claims
 */
export function hasRequiredClaims(
  token: string,
  requiredClaims: string[]
): boolean {
  const payload = decodeJWT(token);
  if (!payload) {
    return false;
  }

  return requiredClaims.every((claim) => claim in payload);
}

/**
 * Checks if refresh is in progress
 */
export async function isRefreshInProgress(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return localStorage.getItem('refreshInProgress') === 'true';
  });
}

/**
 * Waits for token refresh to complete
 */
export async function waitForRefreshToComplete(
  page: Page,
  timeout = 30000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const inProgress = await isRefreshInProgress(page);
    if (!inProgress) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

/**
 * Extracts token issuer
 */
export function getTokenIssuer(token: string): string | null {
  const payload = decodeJWT(token);
  return payload?.iss || null;
}

/**
 * Checks if token is from specific provider
 */
export function isTokenFromProvider(
  token: string,
  provider: string
): boolean {
  const issuer = getTokenIssuer(token);
  if (!issuer) {
    return false;
  }

  const providerPatterns: Record<string, RegExp> = {
    google: /accounts\.google\.com/,
    okta: /okta\.com/,
    azure: /login\.microsoftonline\.com/,
    auth0: /auth0\.com/,
    cognito: /cognito/,
  };

  const pattern = providerPatterns[provider.toLowerCase()];
  return pattern ? pattern.test(issuer) : false;
}
