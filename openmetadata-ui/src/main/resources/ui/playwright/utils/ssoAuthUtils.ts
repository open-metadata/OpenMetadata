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
 * SSO Authentication Utilities
 * Helper functions for SSO authentication testing
 */

/**
 * Retrieves authentication token from Service Worker storage or localStorage fallback
 */
export async function getTokenFromStorage(page: Page): Promise<string | null> {
  try {
    // Try Service Worker storage first
    const token = await page.evaluate(async () => {
      // Check if Service Worker is available
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
          // Timeout after 5 seconds
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
 * Clears all authentication state from storage
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

    // Clear localStorage as fallback
    localStorage.removeItem('app_state');
    localStorage.removeItem('oidc.user');
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
 * Decodes JWT token and extracts expiry timestamp
 */
export function getJWTExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

/**
 * Waits for authentication token to be stored after login
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
 * SSO Provider-specific login implementations
 */
export const ssoProviderLogins = {
  async google(page: Page, username: string, password: string) {
    // Wait for Google login page
    await page.waitForURL('**/accounts.google.com/**', { timeout: 10000 });

    // Fill email
    const emailInput = page
      .getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'));
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(username);
    await page.getByRole('button', { name: /next/i }).click();

    // Fill password
    const passwordInput = page.getByRole('textbox', {
      name: 'Enter your password',
    });
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);
    await page.getByRole('button', { name: /next/i }).click();
  },

  async okta(page: Page, username: string, password: string) {
    // Wait for Okta login page
    await page.waitForURL('**/*okta.com/**', { timeout: 10000 });

    // Fill username
    const usernameInput = page
      .getByLabel(/username/i)
      .or(page.locator('input[name="username"]'));
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(username);

    // Fill password
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[name="password"]'));
    await passwordInput.fill(password);

    // Click sign in
    await page
      .getByRole('button', { name: /sign in/i })
      .or(page.locator('input[type="submit"], button[type="submit"]'))
      .click();
  },

  async azure(page: Page, username: string, password: string) {
    // Wait for Azure AD login page
    await page.waitForURL('**/login.microsoftonline.com/**', {
      timeout: 10000,
    });

    // Fill email
    const emailInput = page
      .getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'));
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(username);
    await page
      .getByRole('button', { name: /next/i })
      .or(page.locator('input[type="submit"]'))
      .click();

    // Fill password
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[type="password"]'));
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);
    await page
      .getByRole('button', { name: /sign in/i })
      .or(page.locator('input[type="submit"]'))
      .click();

    // Handle "Stay signed in?" prompt
    try {
      const staySignedInButton = page.getByRole('button', { name: /yes/i });
      await staySignedInButton.waitFor({ state: 'visible', timeout: 3000 });
      await staySignedInButton.click();
    } catch {
      // Prompt may not appear, continue
    }
  },

  async auth0(page: Page, username: string, password: string) {
    // Wait for Auth0 login page
    await page.waitForURL('**/*.auth0.com/**', { timeout: 10000 });

    // Fill email
    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"], input[name="email"]'));
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(username);

    // Fill password
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[type="password"], input[name="password"]'));
    await passwordInput.fill(password);

    // Click submit
    await page
      .getByRole('button', { name: /continue|log in|sign in/i })
      .or(page.locator('button[type="submit"]'))
      .click();
  },

  async saml(page: Page, username: string, password: string) {
    // Generic SAML login - adapt based on your IDP
    // Wait for SAML IDP page (URL pattern varies by provider)
    await page.waitForLoadState('networkidle');

    // Fill username (selector varies by IDP)
    const usernameInput = page
      .locator('input[name="username"], input[name="user"], input[type="text"]')
      .first();
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(username);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    // Click submit
    const submitButton = page
      .locator('button[type="submit"], input[type="submit"]')
      .first();
    await submitButton.click();
  },

  async cognito(page: Page, username: string, password: string) {
    // Wait for AWS Cognito login page
    await page.waitForURL('**/amazoncognito.com/**', { timeout: 10000 });

    // Fill username
    const usernameInput = page
      .getByLabel(/username/i)
      .or(page.locator('input[name="username"]'));
    await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
    await usernameInput.fill(username);

    // Fill password
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[name="password"]'));
    await passwordInput.fill(password);

    // Click sign in
    await page
      .getByRole('button', { name: /sign in/i })
      .or(page.locator('button[name="signInSubmitButton"]'))
      .click();
  },
};

/**
 * Gets the SSO login button using semantic selectors
 */
export function getSSOLoginButton(page: Page) {
  // Try to find SSO button by common text patterns
  // Returns the first matching button for SSO login
  return page.getByRole('button', {
    name: /sign in with sso|continue with google|continue with azure|continue with okta|continue with auth0|continue with saml/i,
  });
}

/**
 * Performs complete SSO login flow using semantic selectors
 */
export async function performSSOLogin(
  page: Page,
  providerType: string,
  username: string,
  password: string
) {
  await page.goto('/');
  await page.waitForURL('**/signin', { timeout: 10000 });

  // Use semantic selector for SSO login button
  const ssoLoginButton = getSSOLoginButton(page);
  await ssoLoginButton.waitFor({ state: 'visible', timeout: 10000 });
  await ssoLoginButton.click();

  const loginFunction =
    ssoProviderLogins[providerType as keyof typeof ssoProviderLogins];
  if (loginFunction) {
    await loginFunction(page, username, password);
  } else {
    throw new Error(`Unsupported SSO provider: ${providerType}`);
  }

  await page.waitForURL('**/my-data', { timeout: 50000 });
}
