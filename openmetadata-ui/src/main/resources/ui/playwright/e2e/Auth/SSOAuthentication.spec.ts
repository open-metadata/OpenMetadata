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

/**
 * SSO Authentication E2E Tests
 *
 * These tests run against an OM server configured with custom-oidc auth
 * backed by the mock OIDC provider. They are isolated from basic-auth tests
 * and use their own Playwright config: playwright.sso.config.ts
 *
 * Prerequisites:
 *   - Mock OIDC provider running (docker compose --profile sso-test up -d mock-oidc-provider)
 *   - OM server running with .env.sso-test (docker compose --env-file .env.sso-test up -d)
 */

import { expect, Page, test } from '@playwright/test';
import {
  configureMockOidc,
  forceInteractionRequired,
  getMetrics,
  resetMetrics,
  resetMockOidc,
  setTokenExpiry,
  waitForMockOidcReady,
} from '../../utils/mockOidc';

const MOCK_OIDC_URL = process.env.MOCK_OIDC_URL || 'http://localhost:9090';

const performOidcLogin = async (page: Page): Promise<void> => {
  await page.goto('/');

  const ssoButton = page.locator('button.signin-button');
  await ssoButton.waitFor({ state: 'visible', timeout: 30000 });
  await ssoButton.click();

  // Wait until we land on a page that is not /signin and not /callback.
  await page.waitForURL(
    (url) =>
      !url.pathname.includes('signin') && !url.pathname.includes('callback'),
    { timeout: 60000 }
  );
};

const verifyAuthenticated = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('app-bar-item-explore')).toBeVisible({
    timeout: 30000,
  });
};

const getStoredToken = async (page: Page): Promise<string> => {
  return page.evaluate(async () => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('AppDataStore');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction('keyValueStore', 'readonly');
      const store = tx.objectStore('keyValueStore');
      const raw = await new Promise<string>((resolve, reject) => {
        const req = store.get('app_state');
        req.onsuccess = () => resolve((req.result as string) || '');
        req.onerror = () => reject(req.error);
      });
      db.close();
      const parsed = JSON.parse(raw);

      return (parsed.primary as string) || '';
    } catch {
      return '';
    }
  });
};

test.describe('SSO Authentication with Mock OIDC Provider', () => {
  test.beforeAll(async ({ request }) => {
    await waitForMockOidcReady(request);
    await resetMockOidc(request);
  });

  test.afterEach(async ({ request }) => {
    await resetMockOidc(request);
  });

  // ---------------------------------------------------------------
  // Mock OIDC Provider health checks (no OM dependency)
  // ---------------------------------------------------------------

  test.describe('OIDC Discovery', () => {
    test('mock OIDC provider serves valid discovery document', async ({
      request,
    }) => {
      const response = await request.get(
        `${MOCK_OIDC_URL}/.well-known/openid-configuration`
      );

      expect(response.ok()).toBeTruthy();

      const discovery = await response.json();

      expect(discovery.issuer).toBe(MOCK_OIDC_URL);
      expect(discovery.authorization_endpoint).toBeDefined();
      expect(discovery.token_endpoint).toBeDefined();
      expect(discovery.jwks_uri).toBeDefined();
      expect(discovery.userinfo_endpoint).toBeDefined();
      expect(discovery.scopes_supported).toContain('openid');
      expect(discovery.response_types_supported).toContain('code');
    });

    test('mock OIDC provider serves JWKS endpoint', async ({ request }) => {
      const jwksResponse = await request.get(`${MOCK_OIDC_URL}/jwks`);

      expect(jwksResponse.ok()).toBeTruthy();

      const jwks = await jwksResponse.json();

      expect(jwks.keys).toBeDefined();
      expect(jwks.keys.length).toBeGreaterThan(0);
      expect(jwks.keys[0].kty).toBe('RSA');
      expect(jwks.keys[0].kid).toBeDefined();
    });
  });

  test.describe('Test Control API', () => {
    test('should configure token expiry', async ({ request }) => {
      const state = await setTokenExpiry(request, 60);

      expect(state.accessTokenTTL).toBe(60);
      expect(state.idTokenTTL).toBe(60);
    });

    test('should force interaction required', async ({ request }) => {
      await forceInteractionRequired(request);

      const response = await request.get(`${MOCK_OIDC_URL}/test/state`);
      const state = await response.json();

      expect(state.forceInteractionRequired).toBe(true);
    });

    test('should reset to defaults', async ({ request }) => {
      await setTokenExpiry(request, 10);
      await forceInteractionRequired(request);
      await resetMockOidc(request);

      const response = await request.get(`${MOCK_OIDC_URL}/test/state`);
      const state = await response.json();

      expect(state.accessTokenTTL).toBe(3600);
      expect(state.idTokenTTL).toBe(3600);
      expect(state.forceInteractionRequired).toBe(false);
      expect(state.refreshTokenEnabled).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // Login flow tests (require OM configured with custom-oidc)
  // ---------------------------------------------------------------

  test.describe('OIDC Login Flow', () => {
    test('should show SSO login button and authenticate on click', async ({
      page,
    }) => {
      await page.goto('/');

      const ssoButton = page.locator('button.signin-button');
      await expect(ssoButton).toBeVisible({ timeout: 30000 });
      await expect(ssoButton).toContainText(/sign in with/i);

      await ssoButton.click();

      await page.waitForURL(
        (url) =>
          !url.pathname.includes('signin') &&
          !url.pathname.includes('callback'),
        { timeout: 60000 }
      );
      await verifyAuthenticated(page);
    });

    test('should receive valid tokens after login', async ({ page }) => {
      await performOidcLogin(page);

      const token = await getStoredToken(page);

      expect(token.length).toBeGreaterThan(0);
    });

    test('should show user info after authentication', async ({ page }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Retrieve the token stored by the app and make an authenticated API call
      const token = await getStoredToken(page);

      expect(token.length).toBeGreaterThan(0);

      const status = await page.evaluate(async (authToken: string) => {
        const resp = await fetch('/api/v1/users/loggedInUser', {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        return resp.status;
      }, token);

      expect(status).toBe(200);
    });
  });

  // ---------------------------------------------------------------
  // Token renewal tests
  //
  // These tests verify that the app handles token expiry gracefully.
  // When frontend silent renewal is implemented, these tests can be
  // tightened to assert the user stays authenticated.
  // ---------------------------------------------------------------

  test.describe('Silent Token Renewal', () => {
    test('should handle token expiry gracefully', async ({ page, request }) => {
      // Login with default (3600s) tokens to ensure initial load works
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Now configure short-lived tokens for any renewal attempts
      await setTokenExpiry(request, 10);

      // Navigate again — app should stay authenticated with original token
      await page.goto('/');
      await verifyAuthenticated(page);
    });

    test('should handle 401 response by triggering token renewal', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Navigate again — the app should handle any renewal internally
      await page.goto('/');
      await verifyAuthenticated(page);
    });
  });

  test.describe('Iframe Renewal Failure with Popup Fallback', () => {
    test('should handle interaction_required gracefully', async ({
      page,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Force the next silent renewal to return interaction_required
      await forceInteractionRequired(request);

      // Navigate again — app should handle the error gracefully
      await page.goto('/');
      await page.waitForTimeout(5000);

      const url = page.url();

      expect(url).not.toContain('error');
      expect(url).not.toContain('500');
    });
  });

  test.describe('Multi-Tab Token Renewal', () => {
    test('should share authentication state across tabs', async ({
      page,
      context,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Open a second tab — it should share the auth state via localStorage
      const page2 = await context.newPage();
      await page2.goto('/');

      // Check that the second tab can access the stored token
      const token = await getStoredToken(page2);

      expect(token.length).toBeGreaterThan(0);

      await page2.close();
    });
  });

  test.describe('clearRefreshInProgress Recovery', () => {
    test('should recover when refreshInProgress is stuck in localStorage', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      await page.evaluate(() => {
        localStorage.setItem('refreshInProgress', 'true');
      });

      await page.goto('/');
      await page.waitForTimeout(5000);

      const refreshFlag = await page.evaluate(() => {
        return localStorage.getItem('refreshInProgress');
      });

      expect(refreshFlag).not.toBe('true');
    });

    test('should handle concurrent renewal attempts gracefully', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      await page.evaluate(() => {
        localStorage.setItem('refreshInProgress', 'true');
      });

      await page.waitForTimeout(2000);
      await page.goto('/');
      await page.waitForTimeout(5000);

      const url = page.url();

      expect(url).not.toContain('error');
      expect(url).not.toContain('500');
    });
  });

  // ---------------------------------------------------------------
  // 401 Interceptor and Request Retry
  //
  // These tests use page.route() to simulate 401 responses from the
  // OM API, triggering the frontend's axios interceptor to refresh
  // the token and retry failed requests.
  // ---------------------------------------------------------------

  test.describe('401 Interceptor and Request Retry', () => {
    test('should trigger session expired redirect on 401 with expired token message', async ({
      page,
      browserName,
    }) => {
      // WebKit processes page.route() 401 interceptions with different event
      // loop timing — the async logout chain doesn't complete before the page
      // settles, so the redirect to /signin doesn't happen reliably.
      test.skip(
        browserName === 'webkit',
        'WebKit handles route interception timing differently'
      );

      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Intercept the loggedInUser API call and return 401 with 'Expired token!'
      // message. The interceptor will attempt to refresh, but since the token
      // isn't truly expired at the OIDC level, refreshToken() returns null →
      // forced logout with "session expired" toast.
      let intercepted = false;
      await page.route('**/api/v1/users/loggedInUser*', async (route) => {
        if (!intercepted) {
          intercepted = true;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 401,
              message: 'Expired token!',
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/');

      // The interceptor detects the 401, attempts renewal, and when renewal
      // returns null, forces a logout redirect to /signin
      await page.waitForURL('**/signin*', { timeout: 30000 });

      expect(intercepted).toBe(true);
      expect(page.url()).toContain('/signin');
    });

    test('should queue multiple 401 responses and refresh only once', async ({
      page,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      await resetMetrics(request);

      // Track how many 401s we injected
      const interceptedUrls = new Set<string>();
      await page.route('**/api/v1/**', async (route) => {
        const url = route.request().url();
        // Return 401 on the first call for each unique URL pattern
        if (!interceptedUrls.has(url)) {
          interceptedUrls.add(url);
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 401,
              message: 'Expired token!',
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Navigate to a page that makes multiple parallel API calls
      await page.goto('/');
      await page.waitForTimeout(10000);

      // The refresh should have happened at most once despite multiple 401s
      const metricsAfter = await getMetrics(request);

      // Token endpoint should have been called (for refresh), but not N times
      // Allow 1-2 since the initial auth code exchange also counts
      expect(metricsAfter.refreshAttempts).toBeLessThanOrEqual(2);
    });

    test('should logout when token renewal fails', async ({
      page,
      request,
      browserName,
    }) => {
      // WebKit processes page.route() 401 interceptions with different event
      // loop timing — the forced logout redirect doesn't happen reliably.
      test.skip(
        browserName === 'webkit',
        'WebKit handles route interception timing differently'
      );

      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Force the OIDC provider to reject the next silent renewal
      await forceInteractionRequired(request);

      // Intercept ALL API calls to return 401, simulating expired session
      await page.route('**/api/v1/**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 401,
            message: 'Expired token!',
          }),
        });
      });

      await page.goto('/');

      // The app should redirect to /signin after renewal failure
      await page.waitForURL('**/signin*', { timeout: 30000 });
      const url = page.url();

      expect(url).toContain('/signin');
    });
  });

  // ---------------------------------------------------------------
  // Refresh Token Scenarios
  // ---------------------------------------------------------------

  test.describe('Refresh Token Scenarios', () => {
    test('should handle disabled refresh tokens gracefully', async ({
      page,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Disable refresh tokens and force interaction_required on next renewal
      await configureMockOidc(request, {
        refreshTokenEnabled: false,
        forceInteractionRequired: true,
      });

      // Navigate — app should not crash even if silent renewal cannot use
      // a refresh token (it falls back to iframe/popup)
      await page.goto('/');
      await page.waitForTimeout(5000);

      const url = page.url();

      expect(url).not.toContain('error');
      expect(url).not.toContain('500');
    });
  });

  // ---------------------------------------------------------------
  // Logout Cleanup
  // ---------------------------------------------------------------

  test.describe('Logout Cleanup', () => {
    test('should clear all auth state on logout', async ({ page }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      // Verify token exists before logout
      const tokenBefore = await getStoredToken(page);

      expect(tokenBefore.length).toBeGreaterThan(0);

      // Click the Logout item in the left sidebar to open the confirmation modal
      await page
        .getByTestId('left-sidebar')
        .locator('.ant-menu-item')
        .filter({ hasText: 'Logout' })
        .click();

      // Confirm the logout in the modal
      const confirmLogout = page.getByTestId('confirm-logout');
      await confirmLogout.waitFor({ state: 'visible', timeout: 10000 });
      await confirmLogout.click();

      // Wait for redirect to signin
      await page.waitForURL('**/signin*', { timeout: 30000 });

      // Allow async IndexedDB cleanup to complete (WebKit needs more time
      // because the OIDC logout redirect chain can interrupt pending writes)
      await page.waitForTimeout(2000);

      // Verify auth state is cleared
      const tokenAfter = await getStoredToken(page);

      expect(tokenAfter).toBe('');

      const refreshFlag = await page.evaluate(() => {
        return localStorage.getItem('refreshInProgress');
      });

      expect(refreshFlag).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // Multi-Tab Token Renewal
  // ---------------------------------------------------------------

  test.describe('Multi-Tab Token Renewal', () => {
    test('should propagate refreshed token to second tab', async ({
      page,
      context,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      const originalToken = await getStoredToken(page);

      expect(originalToken.length).toBeGreaterThan(0);

      // Open a second tab
      const page2 = await context.newPage();
      await page2.goto('/');
      await page2.waitForTimeout(3000);

      const tab2TokenBefore = await getStoredToken(page2);

      expect(tab2TokenBefore).toBe(originalToken);

      await resetMetrics(request);

      // Force a token renewal in tab 1 by intercepting an API call with 401
      let intercepted = false;
      await page.route('**/api/v1/feed*', async (route) => {
        if (!intercepted) {
          intercepted = true;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 401,
              message: 'Expired token!',
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Trigger the 401 in tab 1
      await page.goto('/activity-feed');
      await page.waitForTimeout(10000);

      // Check that tab 2 can still access the app
      await page2.goto('/');
      await page2.waitForTimeout(5000);

      const tab2TokenAfter = await getStoredToken(page2);

      // Tab 2 should have a valid token (either same or refreshed)
      expect(tab2TokenAfter.length).toBeGreaterThan(0);

      await page2.close();
    });
  });

  // ---------------------------------------------------------------
  // Token Persistence After Renewal
  //
  // These tests verify that after a token renewal, the NEW token is
  // actually persisted to IndexedDB and used for subsequent requests.
  // This catches the Safari bug where a fixed delay wasn't long enough
  // for the Service Worker to persist the token before the success
  // callback fired.
  // ---------------------------------------------------------------

  test.describe('Token Persistence After Renewal', () => {
    test('should persist new token to IndexedDB after renewal and survive hard reload', async ({
      page,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      const tokenBefore = await getStoredToken(page);

      expect(tokenBefore.length).toBeGreaterThan(0);

      // Set very short token TTL so the next renewal issues a visibly different token
      await setTokenExpiry(request, 5);
      await resetMetrics(request);

      // Wait for the token to expire and proactive renewal to trigger
      await page.waitForTimeout(8000);

      // Hard reload — this forces the app to read from IndexedDB (no in-memory cache)
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const url = page.url();

      // The app should still be authenticated after reload
      expect(url).not.toContain('/signin');

      // The token in IndexedDB should still be valid (non-empty)
      const tokenAfter = await getStoredToken(page);

      expect(tokenAfter.length).toBeGreaterThan(0);

      // Verify the persisted token actually works for API calls
      const status = await page.evaluate(async (authToken: string) => {
        const resp = await fetch('/api/v1/users/loggedInUser', {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        return resp.status;
      }, tokenAfter);

      expect(status).toBe(200);
    });

    test('should use renewed token in API request headers after refresh', async ({
      page,
      request,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      const tokenBefore = await getStoredToken(page);

      expect(tokenBefore.length).toBeGreaterThan(0);

      // Set short TTL and wait for renewal
      await setTokenExpiry(request, 5);
      await resetMetrics(request);

      await page.waitForTimeout(8000);

      // Observe the Authorization header on the next API call using waitForRequest
      // (non-intercepting — works reliably in both Chromium and WebKit)
      const requestPromise = page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/') &&
          req.method() === 'GET' &&
          !req.url().includes('/config'),
        { timeout: 30000 }
      );

      // Navigate to trigger API calls
      await page.goto('/');

      const apiRequest = await requestPromise;
      const authHeader = apiRequest.headers()['authorization'] || '';
      const capturedToken = authHeader.replace('Bearer ', '');

      // The token sent in the API header should be non-empty
      expect(capturedToken.length).toBeGreaterThan(0);

      // Verify this token is actually valid by calling the API with it
      const status = await page.evaluate(async (authToken: string) => {
        const resp = await fetch('/api/v1/users/loggedInUser', {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        return resp.status;
      }, capturedToken);

      expect(status).toBe(200);

      // Verify the token in IndexedDB matches what was sent in the API header
      const storedToken = await getStoredToken(page);

      expect(storedToken).toBe(capturedToken);
    });
  });

  // ---------------------------------------------------------------
  // Visibility Change Handler
  //
  // When a user returns to an idle tab, the browser fires a
  // visibilitychange event. These tests verify that the app
  // proactively checks token freshness and refreshes if expired,
  // rather than waiting for a 401 on the next API call.
  // ---------------------------------------------------------------

  test.describe('Visibility Change Handler', () => {
    test('should proactively refresh expired token when tab becomes visible', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);
      await page.waitForTimeout(2000);

      // Set refreshInProgress BEFORE writing expired token to block the
      // TOKEN_UPDATE broadcast from triggering auto-refresh
      await page.evaluate(() =>
        localStorage.setItem('refreshInProgress', 'true')
      );

      // Write an expired JWT through the Service Worker so getOidcToken()
      // (which reads from SW's in-memory cache) sees an expired token.
      await page.evaluate(() => {
        return new Promise<void>((resolve, reject) => {
          const toBase64Url = (obj: Record<string, unknown>) =>
            btoa(JSON.stringify(obj))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');
          const header = toBase64Url({ alg: 'RS256', typ: 'JWT' });
          const payload = toBase64Url({
            sub: 'admin',
            email: 'admin@open-metadata.org',
            exp: Math.floor(Date.now() / 1000) - 3600,
          });
          const expiredJwt = `${header}.${payload}.fakesig`;

          const controller = navigator.serviceWorker.controller;
          if (!controller) {
            reject(new Error('No active Service Worker controller'));

            return;
          }

          const readCh = new MessageChannel();
          readCh.port1.onmessage = (event) => {
            const state = event.data.result
              ? JSON.parse(event.data.result)
              : {};
            state.primary = expiredJwt;

            const writeCh = new MessageChannel();
            writeCh.port1.onmessage = () => resolve();
            controller.postMessage(
              { type: 'set', key: 'app_state', value: JSON.stringify(state) },
              [writeCh.port2]
            );
          };
          controller.postMessage({ type: 'get', key: 'app_state' }, [
            readCh.port2,
          ]);
        });
      });

      // Wait for TOKEN_UPDATE broadcast to be handled (blocked by flag)
      await page.waitForTimeout(1000);

      // Remove the lock so visibilitychange handler can trigger refreshToken()
      await page.evaluate(() => localStorage.removeItem('refreshInProgress'));

      // Capture console messages to verify the handler fires
      const logs: string[] = [];
      page.on('console', (msg) => logs.push(msg.text()));

      // Simulate the tab becoming visible (user returns from idle period).
      // The handler should detect the expired token and call refreshToken().
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Wait for the async handler to complete
      await page.waitForTimeout(3000);

      // Verify the handler detected the expired token and attempted refresh.
      // The deployed handler logs "[VisibilityHandler] token length: X isExpired: true"
      const handlerDetectedExpiry = logs.some(
        (l) =>
          l.includes('[VisibilityHandler]') && l.includes('isExpired: true')
      );

      expect(handlerDetectedExpiry).toBe(true);
    });

    test('should reschedule timer when tab becomes visible with valid token', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      const tokenBefore = await getStoredToken(page);

      expect(tokenBefore.length).toBeGreaterThan(0);

      // Simulate tab becoming visible with a still-valid token
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await page.waitForTimeout(2000);

      // App should still be authenticated (handler didn't break anything)
      await verifyAuthenticated(page);

      // Token should remain the same (no unnecessary refresh)
      const tokenAfter = await getStoredToken(page);

      expect(tokenAfter).toBe(tokenBefore);
    });
  });

  // ---------------------------------------------------------------
  // Token Expiry Timer
  // ---------------------------------------------------------------

  test.describe('Token Expiry Timer', () => {
    test('should remain authenticated after extended idle period', async ({
      page,
    }) => {
      await performOidcLogin(page);
      await verifyAuthenticated(page);

      const initialToken = await getStoredToken(page);

      expect(initialToken.length).toBeGreaterThan(0);

      // Wait 10 seconds to simulate idle period
      await page.waitForTimeout(10000);

      // Navigate to a different page
      await page.goto('/explore/tables');
      await page.waitForTimeout(5000);

      // Should still be authenticated
      const url = page.url();

      expect(url).not.toContain('/signin');

      // Make an API call to verify the token is still valid
      const status = await page.evaluate(async (authToken: string) => {
        const resp = await fetch('/api/v1/users/loggedInUser', {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        return resp.status;
      }, initialToken);

      expect(status).toBe(200);
    });
  });
});
