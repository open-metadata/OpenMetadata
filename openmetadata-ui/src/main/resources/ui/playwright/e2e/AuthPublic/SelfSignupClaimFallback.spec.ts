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
 * PUBLIC-client OIDC self-signup E2E test for issue #26591.
 *
 * Runs against an OM server configured as a PUBLIC custom-oidc client (backed
 * by the mock OIDC provider) AND jwtPrincipalClaimsMapping
 * [username:preferred_username, email:email]. Public client type is what makes
 * the frontend /signup page invoke getNameFromUserData (SignUpPage.tsx only
 * calls it when clientType === public).
 *
 * The mock 'fallback-user' account deliberately OMITS `preferred_username`.
 * Before the #26591 fix, mapping username:preferred_username against a token
 * without that claim produced an empty username, so the hidden required field
 * blocked submission and the Create button did nothing. After the fix,
 * getNameFromUserData falls back to a normalized name and self-signup completes.
 *
 * Prerequisites (see playwright.sso.public.config.ts / playwright-sso-tests.yml):
 *   - Mock OIDC provider running (docker compose --profile sso-test up -d mock-oidc-provider)
 *   - OM server running as PUBLIC custom-oidc with
 *     AUTHENTICATION_JWT_PRINCIPAL_CLAIMS_MAPPING=[username:preferred_username,email:email]
 *     and AUTHENTICATION_ENABLE_SELF_SIGNUP=true (see .env.sso-test-public)
 */

import { expect, Page, test } from '@playwright/test';
import { getApiContext } from '../../utils/common';
import {
  MOCK_OIDC_FALLBACK_ACCOUNT,
  resetMockOidc,
  setDefaultLoginAccount,
  waitForMockOidcReady,
} from '../../utils/mockOidc';

const completeOidcSelfSignup = async (page: Page): Promise<void> => {
  await page.goto('/');

  const ssoButton = page.locator('button.signin-button');
  await ssoButton.waitFor({ state: 'visible', timeout: 30000 });
  await ssoButton.click();

  await page.waitForURL(
    (url) =>
      url.pathname.endsWith('/signup') || url.pathname.endsWith('/my-data'),
    { timeout: 60000 }
  );

  if (page.url().includes('/signup')) {
    // The username field is hidden + required. Before the fix it stayed empty
    // (no preferred_username claim) and the Create button silently failed
    // validation; the fallback now populates it so submission proceeds. A
    // case-insensitive regex asserts both non-emptiness and the fallback value.
    const usernameInput = page.getByTestId('username-input');
    await expect(usernameInput).toHaveValue(
      new RegExp(MOCK_OIDC_FALLBACK_ACCOUNT.name, 'i')
    );

    const createButton = page.getByRole('button', { name: /create/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await page.waitForURL('**/my-data', { timeout: 60000 });
  }
};

test.describe('Public-client OIDC self-signup with missing username claim', () => {
  test.slow();

  test.beforeAll(async ({ request }) => {
    await waitForMockOidcReady(request);
    await resetMockOidc(request);
  });

  test.afterEach(async ({ request }) => {
    await resetMockOidc(request);
  });

  test('self-signup falls back to a normalized name when preferred_username is absent', async ({
    browser,
    request,
  }) => {
    await setDefaultLoginAccount(request, MOCK_OIDC_FALLBACK_ACCOUNT.sub);

    // Fresh context so the mock IdP performs a clean login as the steered
    // account rather than reusing a prior session cookie.
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await completeOidcSelfSignup(page);

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        const response = await apiContext.get('/api/v1/users/loggedInUser');

        expect(response.status()).toBe(200);

        const user = await response.json();

        // Username resolves via the normalized-name fallback (issue #26591)
        // because the token carries no preferred_username to map from.
        expect(user.name?.toLowerCase()).toBe(MOCK_OIDC_FALLBACK_ACCOUNT.name);
        expect(user.email?.toLowerCase()).toBe(
          MOCK_OIDC_FALLBACK_ACCOUNT.email
        );
      } finally {
        await afterAction();
      }
    } finally {
      await page.close();
      await context.close();
    }
  });
});
