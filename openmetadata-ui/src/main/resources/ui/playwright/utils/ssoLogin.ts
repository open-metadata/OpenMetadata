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
import { expect, Page } from '@playwright/test';
import { ProviderHelper } from './sso-providers';
import { ProviderCredentials } from './ssoAuth';

// A beforeAll gets the plain 60s test timeout and is not tripled by test.slow(),
// but the waits below can add up to 165s. Callers must raise it or the hook
// expires first and hides what the login was stuck on.
export const SSO_LOGIN_HOOK_TIMEOUT_MS = 240_000;

/** Signs in through the IdP, completing self-signup on first login. */
export const loginViaSso = async (
  page: Page,
  helper: ProviderHelper,
  credentials: ProviderCredentials
): Promise<void> => {
  await page.goto('/signin');

  const signInButton = page.locator('button.signin-button');

  await expect(signInButton).toBeVisible();
  await signInButton.click();
  await page.waitForURL(helper.loginUrlPattern, { timeout: 45_000 });
  await helper.performProviderLogin(page, credentials);
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith('/signup') ||
      url.pathname.endsWith('/my-data') ||
      url.pathname === '/',
    { timeout: 60_000 }
  );

  if (page.url().includes('/signup')) {
    const createButton = page.getByRole('button', { name: /create/i });

    await expect(createButton).toBeEnabled();
    await createButton.click();
    await page.waitForURL(/\/(my-data)?$/, { timeout: 60_000 });
  }

  await expect(page.getByTestId('dropdown-profile')).toBeVisible({
    timeout: 60_000,
  });
};
