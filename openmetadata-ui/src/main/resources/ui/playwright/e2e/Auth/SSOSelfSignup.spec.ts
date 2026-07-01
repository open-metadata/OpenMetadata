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
 * OIDC self-signup E2E test for issue #29189.
 *
 * Runs against an OM server configured with custom-oidc auth (backed by the
 * mock OIDC provider) AND jwtPrincipalClaimsMapping [username:sub, email:email].
 * The mock issues a token for an account whose `sub` ('claim-user') differs
 * from the email local-part ('claim.user.mapped'). A first-time login must
 * self-signup a user with name=<sub> and email=<mapped email claim> — never
 * <sub>@<email-domain>.
 *
 * Prerequisites (see playwright.sso.config.ts / playwright-sso-tests.yml):
 *   - Mock OIDC provider running (docker compose --profile sso-test up -d mock-oidc-provider)
 *   - OM server running with AUTHENTICATION_JWT_PRINCIPAL_CLAIMS_MAPPING=[username:sub,email:email]
 *     and AUTHENTICATION_ENABLE_SELF_SIGNUP=true
 */

import { expect, Page, test } from '@playwright/test';
import { getApiContext } from '../../utils/common';
import {
  MOCK_OIDC_MAPPED_CLAIM_ACCOUNT,
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
    const createButton = page.getByRole('button', { name: /create/i });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await page.waitForURL('**/my-data', { timeout: 60000 });
  }
};

test.describe('OIDC self-signup with mapped principal claims', () => {
  test.slow();

  test.beforeAll(async ({ request }) => {
    await waitForMockOidcReady(request);
    await resetMockOidc(request);
  });

  test.afterEach(async ({ request }) => {
    await resetMockOidc(request);
  });

  test('persists the mapped email claim instead of deriving sub@domain', async ({
    browser,
    request,
  }) => {
    await setDefaultLoginAccount(request, MOCK_OIDC_MAPPED_CLAIM_ACCOUNT.sub);

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

        // Username resolves from the `sub` claim. Fails loudly if the
        // username:sub / email:email mapping is not configured on the server.
        expect(user.name?.toLowerCase()).toBe(
          MOCK_OIDC_MAPPED_CLAIM_ACCOUNT.sub
        );
        // The created user's email must be the resolved mapped claim, never
        // <sub>@<email-domain> (the issue #29189 regression).
        expect(user.email?.toLowerCase()).toBe(
          MOCK_OIDC_MAPPED_CLAIM_ACCOUNT.email
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
