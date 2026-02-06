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

import { expect, test } from '@playwright/test';
import { JWT_EXPIRY_TIME_MAP } from '../../constant/login';
import { getApiContext } from '../../utils/common';
import { updateJWTTokenExpiryTime } from '../../utils/login';
import {
  clearTokenFromStorage,
  getJWTExpiry,
  getTokenFromStorage,
  ssoProviderLogins,
  waitForTokenInStorage,
} from '../../utils/ssoAuthUtils';

/**
 * SSO Authentication E2E Test Suite
 *
 * This test suite covers comprehensive authentication scenarios for SSO providers.
 *
 * SETUP INSTRUCTIONS:
 * 1. Set environment variables for your SSO provider:
 *    - For OIDC/Google/Cognito/Okta:
 *      - SSO_USERNAME=your-sso-username@domain.com
 *      - SSO_PASSWORD=your-sso-password
 *
 *    - For Azure AD:
 *      - AZURE_SSO_USERNAME=your-azure-username@domain.com
 *      - AZURE_SSO_PASSWORD=your-azure-password
 *
 *    - For Auth0:
 *      - AUTH0_USERNAME=your-auth0-username@domain.com
 *      - AUTH0_PASSWORD=your-auth0-password
 *
 *    - For SAML:
 *      - SAML_USERNAME=your-saml-username
 *      - SAML_PASSWORD=your-saml-password
 *
 * 2. Configure OpenMetadata backend with your SSO provider settings
 *
 * 3. Run tests:
 *    yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
 */

// Test configuration
const SSO_CONFIG = {
  username: process.env.SSO_USERNAME || '',
  password: process.env.SSO_PASSWORD || '',
  providerType: process.env.SSO_PROVIDER_TYPE || 'google', // google, okta, azure, auth0, saml, cognito
};

test.describe('SSO Authentication - Core Flows', () => {
  test.beforeEach(async () => {
    // Validate SSO credentials are provided
    if (!SSO_CONFIG.username || !SSO_CONFIG.password) {
      test.skip(
        true,
        'SSO credentials not provided. Set SSO_USERNAME and SSO_PASSWORD environment variables.'
      );
    }
  });

  test('SSO-001: Successful SSO login flow', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to application
    await page.goto('/');

    // Should redirect to signin page
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Click SSO login button (adapt selector based on your UI)
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with Google"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.waitFor({ state: 'visible', timeout: 10000 });
    await ssoLoginButton.click();

    // Execute provider-specific login
    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    } else {
      throw new Error(`Unsupported SSO provider: ${SSO_CONFIG.providerType}`);
    }

    // Wait for redirect back to application
    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Verify token is stored
    const token = await waitForTokenInStorage(page);
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(0);

    // Verify user is logged in - check for user menu
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await expect(userMenu).toBeVisible({ timeout: 10000 });

    // Verify API calls include auth token
    const apiResponse = await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/') && response.status() === 200,
      { timeout: 10000 }
    );
    const authHeader = apiResponse.request().headers()['authorization'];
    expect(authHeader).toBeDefined();
    expect(authHeader).toContain('Bearer');
  });

  test('SSO-002: Logout flow clears authentication state', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // First, login
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });
    const tokenBeforeLogout = await waitForTokenInStorage(page);
    expect(tokenBeforeLogout).toBeTruthy();

    // Open user menu
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await userMenu.click();

    // Click logout
    const logoutButton = page.getByRole('menuitem', { name: 'Logout' });
    await logoutButton.click();

    // Confirm logout in modal
    await page
      .locator('.ant-modal-body')
      .filter({ hasText: 'Are you sure you want' })
      .waitFor({ state: 'visible' });

    const logoutResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/logout') && response.status() === 200
    );

    await page.getByTestId('confirm-logout').click();
    await logoutResponse;

    // Wait for redirect to signin
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Verify token is cleared
    const tokenAfterLogout = await getTokenFromStorage(page);
    expect(tokenAfterLogout).toBeNull();

    // Verify localStorage is cleared
    const localStorageCleared = await page.evaluate(() => {
      const hasOidcUser = localStorage.getItem('oidc.user');
      const hasAppState = localStorage.getItem('app_state');
      return !hasOidcUser && !hasAppState;
    });
    expect(localStorageCleared).toBeTruthy();

    // Try to access protected route - should redirect to signin
    await page.goto('/my-data');
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Verify no auth token in requests
    let hasAuthToken = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) {
        const authHeader = request.headers()['authorization'];
        if (authHeader && authHeader !== 'Bearer null') {
          hasAuthToken = true;
        }
      }
    });

    await page.waitForTimeout(2000);
    expect(hasAuthToken).toBeFalsy();
  });

  test('SSO-003: Cannot access protected routes after logout', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Login first
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Logout
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await userMenu.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page
      .locator('.ant-modal-body')
      .filter({ hasText: 'Are you sure you want' })
      .waitFor({ state: 'visible' });
    await page.getByTestId('confirm-logout').click();
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Try to access various protected routes
    const protectedRoutes = [
      '/my-data',
      '/explore/tables',
      '/settings/members/users',
      '/glossary',
      '/data-quality',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('**/signin', { timeout: 10000 });
      expect(page.url()).toContain('/signin');
    }
  });

  test('SSO-004: Direct URL access without auth redirects to signin', async ({
    page,
  }) => {
    test.setTimeout(30000);

    // Ensure no auth state
    await clearTokenFromStorage(page);

    // Try to access protected route directly
    await page.goto('/my-data');

    // Should redirect to signin
    await page.waitForURL('**/signin', { timeout: 10000 });
    expect(page.url()).toContain('/signin');

    // Verify signin page is displayed
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await expect(ssoLoginButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('SSO Authentication - Token Refresh & Expiry', () => {
  test.beforeEach(async () => {
    if (!SSO_CONFIG.username || !SSO_CONFIG.password) {
      test.skip(
        true,
        'SSO credentials not provided. Set SSO_USERNAME and SSO_PASSWORD environment variables.'
      );
    }
  });

  test('SSO-005: Token refresh before expiry', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    // Login with admin to configure short token expiry
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Login with SSO
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Set JWT expiry to 2 minutes for testing
    const { apiContext, afterAction } = await getApiContext(page);
    await updateJWTTokenExpiryTime(
      apiContext,
      JWT_EXPIRY_TIME_MAP['2 minutes']
    );
    await afterAction();

    // Get initial token
    const initialToken = await waitForTokenInStorage(page);
    expect(initialToken).toBeTruthy();

    // Monitor for token refresh
    let refreshDetected = false;
    let newToken: string | null = null;

    // Listen for refresh token API calls
    page.on('response', async (response) => {
      if (
        response.url().includes('/refresh') ||
        response.url().includes('/auth/refresh')
      ) {
        if (response.status() === 200) {
          refreshDetected = true;
          // Wait a bit for token to be stored
          await page.waitForTimeout(1000);
          newToken = await getTokenFromStorage(page);
        }
      }
    });

    // Wait for token refresh (should happen ~1 minute before expiry)
    // With 2-minute expiry, refresh should happen around 1 minute
    await page.waitForTimeout(70000); // Wait 70 seconds

    // Verify refresh happened
    expect(refreshDetected).toBeTruthy();
    expect(newToken).toBeTruthy();
    expect(newToken).not.toEqual(initialToken);

    // Verify new token is valid and user still authenticated
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await expect(userMenu).toBeVisible();

    // Make an API call to verify new token works
    await page.goto('/explore/tables');
    await page.waitForLoadState('networkidle');
    const currentToken = await getTokenFromStorage(page);
    expect(currentToken).toEqual(newToken);
  });

  test('SSO-006: Expired token forces re-authentication', async ({ page }) => {
    test.setTimeout(60000);

    // Login first
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Manually expire the token by replacing it with an expired one
    // Create a fake expired JWT token (you can use a real expired token from your SSO)
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.fake_signature';

    await page.evaluate((token) => {
      const appState = { primary: token };
      localStorage.setItem('app_state', JSON.stringify(appState));
    }, expiredToken);

    // Make a request that should fail with 401
    let received401 = false;
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() === 401) {
        received401 = true;
      }
    });

    // Navigate to trigger API calls
    await page.goto('/explore/tables');

    // Wait for 401 and redirect to signin
    await page.waitForURL('**/signin', { timeout: 15000 });
    expect(received401).toBeTruthy();

    // Verify user is logged out
    const ssoLoginButtonVisible = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await expect(ssoLoginButtonVisible).toBeVisible();
  });

  test('SSO-007: Token persists across page reloads', async ({ page }) => {
    test.setTimeout(60000);

    // Login
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Get token
    const tokenBeforeReload = await waitForTokenInStorage(page);
    expect(tokenBeforeReload).toBeTruthy();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify still on my-data page (not redirected to signin)
    expect(page.url()).toContain('/my-data');

    // Verify token is still present
    const tokenAfterReload = await getTokenFromStorage(page);
    expect(tokenAfterReload).toBeTruthy();
    expect(tokenAfterReload).toEqual(tokenBeforeReload);

    // Verify user is still authenticated
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await expect(userMenu).toBeVisible();
  });
});

test.describe('SSO Authentication - Multi-Tab Scenarios', () => {
  test.beforeEach(async () => {
    if (!SSO_CONFIG.username || !SSO_CONFIG.password) {
      test.skip(
        true,
        'SSO credentials not provided. Set SSO_USERNAME and SSO_PASSWORD environment variables.'
      );
    }
  });

  test('SSO-008: Login in one tab reflects in other tabs', async ({
    context,
  }) => {
    test.setTimeout(90000);

    // Create two tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Tab 1: Navigate to signin
      await page1.goto('/');
      await page1.waitForURL('**/signin', { timeout: 10000 });

      // Tab 2: Also navigate to signin
      await page2.goto('/');
      await page2.waitForURL('**/signin', { timeout: 10000 });

      // Tab 1: Login via SSO
      const ssoLoginButton = page1
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButton.click();

      const loginFunction =
        ssoProviderLogins[
          SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
        ];
      if (loginFunction) {
        await loginFunction(page1, SSO_CONFIG.username, SSO_CONFIG.password);
      }

      await page1.waitForURL('**/my-data', { timeout: 15000 });

      // Verify Tab 1 is logged in
      const token1 = await waitForTokenInStorage(page1);
      expect(token1).toBeTruthy();

      // Tab 2: Should now be able to access protected route
      await page2.goto('/my-data');
      await page2.waitForURL('**/my-data', { timeout: 15000 });

      // Verify Tab 2 has the same token
      const token2 = await getTokenFromStorage(page2);
      expect(token2).toBeTruthy();
      expect(token2).toEqual(token1);

      // Verify both tabs show authenticated state
      const userMenu1 = page1.locator(
        '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
      );
      const userMenu2 = page2.locator(
        '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
      );
      await expect(userMenu1).toBeVisible();
      await expect(userMenu2).toBeVisible();
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('SSO-009: Logout in one tab logs out all tabs', async ({ context }) => {
    test.setTimeout(90000);

    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();

    try {
      // Login in Tab 1
      await page1.goto('/');
      await page1.waitForURL('**/signin', { timeout: 10000 });
      const ssoLoginButton = page1
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButton.click();

      const loginFunction =
        ssoProviderLogins[
          SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
        ];
      if (loginFunction) {
        await loginFunction(page1, SSO_CONFIG.username, SSO_CONFIG.password);
      }

      await page1.waitForURL('**/my-data', { timeout: 15000 });

      // Open protected routes in Tab 2 and Tab 3
      await page2.goto('/explore/tables');
      await page2.waitForLoadState('networkidle');
      await page3.goto('/glossary');
      await page3.waitForLoadState('networkidle');

      // Verify all tabs are authenticated
      const token1 = await getTokenFromStorage(page1);
      const token2 = await getTokenFromStorage(page2);
      const token3 = await getTokenFromStorage(page3);
      expect(token1).toBeTruthy();
      expect(token2).toEqual(token1);
      expect(token3).toEqual(token1);

      // Logout in Tab 2
      const userMenu2 = page2.locator(
        '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
      );
      await userMenu2.click();
      await page2.getByRole('menuitem', { name: 'Logout' }).click();
      await page2
        .locator('.ant-modal-body')
        .filter({ hasText: 'Are you sure you want' })
        .waitFor({ state: 'visible' });
      await page2.getByTestId('confirm-logout').click();
      await page2.waitForURL('**/signin', { timeout: 10000 });

      // Wait for storage event to propagate
      await page1.waitForTimeout(2000);

      // Verify tokens are cleared in all tabs
      const tokenAfter1 = await getTokenFromStorage(page1);
      const tokenAfter2 = await getTokenFromStorage(page2);
      const tokenAfter3 = await getTokenFromStorage(page3);
      expect(tokenAfter1).toBeNull();
      expect(tokenAfter2).toBeNull();
      expect(tokenAfter3).toBeNull();

      // Try to navigate in Tab 1 and Tab 3 - should redirect to signin
      await page1.goto('/my-data');
      await page1.waitForURL('**/signin', { timeout: 10000 });

      await page3.goto('/explore/tables');
      await page3.waitForURL('**/signin', { timeout: 10000 });

      // Verify all tabs show signin page
      expect(page1.url()).toContain('/signin');
      expect(page2.url()).toContain('/signin');
      expect(page3.url()).toContain('/signin');
    } finally {
      await page1.close();
      await page2.close();
      await page3.close();
    }
  });

  test('SSO-010: Token refresh in one tab updates all tabs', async ({
    context,
  }) => {
    test.setTimeout(180000); // 3 minutes

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Login in Tab 1
      await page1.goto('/');
      await page1.waitForURL('**/signin', { timeout: 10000 });
      const ssoLoginButton = page1
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButton.click();

      const loginFunction =
        ssoProviderLogins[
          SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
        ];
      if (loginFunction) {
        await loginFunction(page1, SSO_CONFIG.username, SSO_CONFIG.password);
      }

      await page1.waitForURL('**/my-data', { timeout: 15000 });

      // Configure short token expiry
      const { apiContext, afterAction } = await getApiContext(page1);
      await updateJWTTokenExpiryTime(
        apiContext,
        JWT_EXPIRY_TIME_MAP['2 minutes']
      );
      await afterAction();

      // Open Tab 2
      await page2.goto('/explore/tables');
      await page2.waitForLoadState('networkidle');

      // Get initial tokens
      const initialToken1 = await getTokenFromStorage(page1);
      const initialToken2 = await getTokenFromStorage(page2);
      expect(initialToken1).toEqual(initialToken2);

      // Monitor Tab 2 for token changes via storage event
      await page2.evaluate(() => {
        window.addEventListener('storage', (event) => {
          if (event.key === 'oidc.refreshed' || event.key === 'app_state') {
            (window as Window & { tokenUpdated?: boolean }).tokenUpdated = true;
          }
        });
      });

      // Wait for token refresh to happen in Tab 1 (~70 seconds)
      await page1.waitForTimeout(70000);

      // Get new token from Tab 1
      const newToken1 = await getTokenFromStorage(page1);
      expect(newToken1).not.toEqual(initialToken1);

      // Wait for Tab 2 to detect the change
      await page2.waitForTimeout(2000);

      // Verify Tab 2 also has the new token
      const newToken2 = await getTokenFromStorage(page2);
      expect(newToken2).toEqual(newToken1);

      // Verify both tabs still work with new token
      await page1.goto('/glossary');
      await page1.waitForLoadState('networkidle');
      await page2.goto('/data-quality');
      await page2.waitForLoadState('networkidle');

      const userMenu1 = page1.locator(
        '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
      );
      const userMenu2 = page2.locator(
        '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
      );
      await expect(userMenu1).toBeVisible();
      await expect(userMenu2).toBeVisible();
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('SSO-011: Multiple tabs operate independently without conflicts', async ({
    context,
  }) => {
    test.setTimeout(90000);

    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();

    try {
      // Login in Tab 1
      await page1.goto('/');
      await page1.waitForURL('**/signin', { timeout: 10000 });
      const ssoLoginButton = page1
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButton.click();

      const loginFunction =
        ssoProviderLogins[
          SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
        ];
      if (loginFunction) {
        await loginFunction(page1, SSO_CONFIG.username, SSO_CONFIG.password);
      }

      await page1.waitForURL('**/my-data', { timeout: 15000 });

      // Perform concurrent operations in all tabs
      await Promise.all([
        page1
          .goto('/explore/tables')
          .then(() => page1.waitForLoadState('networkidle')),
        page2
          .goto('/glossary')
          .then(() => page2.waitForLoadState('networkidle')),
        page3
          .goto('/data-quality')
          .then(() => page3.waitForLoadState('networkidle')),
      ]);

      // Verify all tabs loaded successfully
      expect(page1.url()).toContain('/explore/tables');
      expect(page2.url()).toContain('/glossary');
      expect(page3.url()).toContain('/data-quality');

      // Verify all tabs have auth tokens
      const token1 = await getTokenFromStorage(page1);
      const token2 = await getTokenFromStorage(page2);
      const token3 = await getTokenFromStorage(page3);
      expect(token1).toBeTruthy();
      expect(token2).toEqual(token1);
      expect(token3).toEqual(token1);

      // Verify all tabs show authenticated UI
      const userMenus = await Promise.all([
        page1
          .locator(
            '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
          )
          .isVisible(),
        page2
          .locator(
            '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
          )
          .isVisible(),
        page3
          .locator(
            '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
          )
          .isVisible(),
      ]);
      expect(userMenus.every((visible) => visible === true)).toBeTruthy();

      // Perform concurrent navigation in all tabs
      await Promise.all([
        page1
          .goto('/settings/members/users')
          .then(() => page1.waitForLoadState('networkidle')),
        page2
          .goto('/explore/dashboards')
          .then(() => page2.waitForLoadState('networkidle')),
        page3
          .goto('/my-data')
          .then(() => page3.waitForLoadState('networkidle')),
      ]);

      // Verify no errors occurred and all tabs navigated correctly
      expect(page1.url()).toContain('/settings/members/users');
      expect(page2.url()).toContain('/explore/dashboards');
      expect(page3.url()).toContain('/my-data');
    } finally {
      await page1.close();
      await page2.close();
      await page3.close();
    }
  });
});

test.describe('SSO Authentication - Edge Cases', () => {
  test.beforeEach(async () => {
    if (!SSO_CONFIG.username || !SSO_CONFIG.password) {
      test.skip(
        true,
        'SSO credentials not provided. Set SSO_USERNAME and SSO_PASSWORD environment variables.'
      );
    }
  });

  test('SSO-012: Login -> Logout -> Login flow works correctly', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // First login
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    let ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });
    const firstToken = await waitForTokenInStorage(page);
    expect(firstToken).toBeTruthy();

    // Logout
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await userMenu.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page
      .locator('.ant-modal-body')
      .filter({ hasText: 'Are you sure you want' })
      .waitFor({ state: 'visible' });
    await page.getByTestId('confirm-logout').click();
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Verify logged out
    const tokenAfterLogout = await getTokenFromStorage(page);
    expect(tokenAfterLogout).toBeNull();

    // Second login
    ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });
    const secondToken = await waitForTokenInStorage(page);
    expect(secondToken).toBeTruthy();

    // Verify new token is different (new session)
    expect(secondToken).not.toEqual(firstToken);

    // Verify user is authenticated
    const userMenuAfterRelogin = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await expect(userMenuAfterRelogin).toBeVisible();
  });

  test('SSO-013: Browser refresh during login flow', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    // Wait for SSO provider page to start loading
    await page.waitForTimeout(2000);

    // Refresh the page
    await page.reload();

    // Should still be able to complete login flow
    // Depending on provider, might need to click SSO button again or continue from where we left off
    const currentUrl = page.url();

    if (currentUrl.includes('signin')) {
      // Redirected back to signin, need to start over
      const ssoLoginButtonRetry = page
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButtonRetry.click();
    }

    // Complete login
    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });
    const token = await waitForTokenInStorage(page);
    expect(token).toBeTruthy();
  });

  test('SSO-014: Simultaneous login attempts from multiple tabs', async ({
    context,
  }) => {
    test.setTimeout(120000);

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Start login flow in both tabs simultaneously
      await Promise.all([
        page1
          .goto('/')
          .then(() => page1.waitForURL('**/signin', { timeout: 10000 })),
        page2
          .goto('/')
          .then(() => page2.waitForURL('**/signin', { timeout: 10000 })),
      ]);

      // Click SSO login in Tab 1
      const ssoLoginButton1 = page1
        .locator(
          'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
        )
        .first();
      await ssoLoginButton1.click();

      // Complete login in Tab 1
      const loginFunction =
        ssoProviderLogins[
          SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
        ];
      if (loginFunction) {
        await loginFunction(page1, SSO_CONFIG.username, SSO_CONFIG.password);
      }

      await page1.waitForURL('**/my-data', { timeout: 15000 });

      // Tab 2 should now also have access
      await page2.goto('/my-data');
      await page2.waitForURL('**/my-data', { timeout: 15000 });

      // Verify both tabs have tokens
      const token1 = await getTokenFromStorage(page1);
      const token2 = await getTokenFromStorage(page2);
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).toEqual(token2);
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('SSO-015: Callback page handles errors gracefully', async ({ page }) => {
    test.setTimeout(60000);

    // Navigate to callback with invalid state parameter
    await page.goto('/callback?error=access_denied');

    // Should redirect to signin or show error
    await page.waitForTimeout(3000);

    // Verify user is not authenticated
    const currentUrl = page.url();
    const isOnSignin = currentUrl.includes('/signin');
    const hasErrorMessage = await page
      .locator('text=/error|denied|failed/i')
      .isVisible()
      .catch(() => false);

    expect(isOnSignin || hasErrorMessage).toBeTruthy();

    // Token should not be present
    const token = await getTokenFromStorage(page);
    expect(token).toBeNull();
  });

  test('SSO-016: Stale authentication state is cleaned up', async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Set up stale state in storage
    await page.goto('/signin');
    await page.evaluate(() => {
      // Add old OIDC state
      localStorage.setItem(
        'oidc.user',
        JSON.stringify({
          id_token: 'old_token',
          access_token: 'old_access_token',
          expires_at: Date.now() / 1000 - 3600, // Expired 1 hour ago
        })
      );

      // Add stale app state
      const staleAppState = {
        primary:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.fake',
        secondary: 'stale_refresh_token',
      };
      localStorage.setItem('app_state', JSON.stringify(staleAppState));
    });

    // Try to access protected route
    await page.goto('/my-data');

    // Should detect stale state and redirect to signin
    await page.waitForURL('**/signin', { timeout: 10000 });

    // Perform fresh login
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Verify fresh token is stored
    const token = await waitForTokenInStorage(page);
    expect(token).toBeTruthy();
    expect(token).not.toContain('fake');

    // Verify token is valid
    const expiry = getJWTExpiry(token);
    expect(expiry).toBeGreaterThan(Date.now());
  });

  test('SSO-017: Network interruption during logout', async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // Login first
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();
    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Simulate network failure during logout
    await page.route('**/api/v1/**/logout', (route) => {
      route.abort('failed');
    });

    // Attempt logout
    const userMenu = page.locator(
      '[data-testid="dropdown-profile"], [data-testid="user-menu"]'
    );
    await userMenu.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await page
      .locator('.ant-modal-body')
      .filter({ hasText: 'Are you sure you want' })
      .waitFor({ state: 'visible' });
    await page.getByTestId('confirm-logout').click();

    // Wait for error handling
    await page.waitForTimeout(3000);

    // Even with network failure, tokens should be cleared locally
    const token = await getTokenFromStorage(page);
    expect(token).toBeNull();

    // Should still redirect to signin
    const currentUrl = page.url();
    expect(currentUrl).toContain('/signin');
  });

  test('SSO-018: Cross-domain callback handling', async ({ page }) => {
    test.setTimeout(60000);

    // Login flow
    await page.goto('/');
    await page.waitForURL('**/signin', { timeout: 10000 });
    const ssoLoginButton = page
      .locator(
        'button:has-text("Sign in with SSO"), button:has-text("Continue with Google"), button:has-text("Continue with Azure"), button:has-text("Continue with Okta")'
      )
      .first();

    // Monitor for cross-domain redirects
    const redirects: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 300 && response.status() < 400) {
        redirects.push(response.url());
      }
    });

    await ssoLoginButton.click();

    const loginFunction =
      ssoProviderLogins[
        SSO_CONFIG.providerType as keyof typeof ssoProviderLogins
      ];
    if (loginFunction) {
      await loginFunction(page, SSO_CONFIG.username, SSO_CONFIG.password);
    }

    await page.waitForURL('**/my-data', { timeout: 15000 });

    // Verify callback was handled correctly
    const token = await waitForTokenInStorage(page);
    expect(token).toBeTruthy();

    // Verify no infinite redirect loops occurred
    const uniqueRedirects = new Set(redirects);
    expect(uniqueRedirects.size).toBeLessThan(10); // Reasonable number of redirects
  });
});
