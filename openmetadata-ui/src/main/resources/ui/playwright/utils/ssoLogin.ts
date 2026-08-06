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

/**
 * Hook budget for a suite whose beforeAll calls loginViaSso.
 *
 * A beforeAll gets the plain test timeout (60s) and, unlike a test body, is not
 * tripled by test.slow(). loginViaSso alone can legitimately spend 45s reaching
 * the IdP plus 60s returning plus 60s on self-signup, so the hook expires before
 * its own waits do and the failure surfaces as a bare "hook timeout exceeded"
 * that hides whatever the login was actually stuck on. Suites that log in during
 * beforeAll must raise it explicitly.
 */
export const SSO_LOGIN_HOOK_TIMEOUT_MS = 240_000;

/**
 * Drives a full interactive SSO sign-in: OpenMetadata's /signin -> the IdP ->
 * back to OpenMetadata, completing self-signup when the IdP user has no
 * OpenMetadata account yet.
 *
 * SSOLogin.spec.ts keeps its own step-by-step version on purpose — there the
 * individual steps *are* the assertions. Suites that only need an authenticated
 * page to test something else use this helper.
 */
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
      url.pathname.endsWith('/signup') || url.pathname.endsWith('/my-data'),
    { timeout: 60_000 }
  );

  if (page.url().includes('/signup')) {
    const createButton = page.getByRole('button', { name: /create/i });

    await expect(createButton).toBeEnabled();
    await createButton.click();
    await page.waitForURL('**/my-data', { timeout: 60_000 });
  }

  await expect(page.getByTestId('dropdown-profile')).toBeVisible({
    timeout: 60_000,
  });
};
