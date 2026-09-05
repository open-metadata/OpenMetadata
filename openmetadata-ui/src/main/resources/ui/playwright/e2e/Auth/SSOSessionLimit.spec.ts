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
import { BrowserContext, Page } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { expect, test } from '../../support/fixtures/base';
import { withMaxActiveSessions } from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import { swapSecurityConfig } from '../../utils/ssoAuth';
import { loginViaSso, SSO_LOGIN_HOOK_TIMEOUT_MS } from '../../utils/ssoLogin';

// maxActiveSessionsPerUser is enforced server-side (SessionService.applySessionLimit)
// only when OpenMetadata mints its own session, i.e. a session-bound JWT carrying a
// sessionId claim. SAML and confidential OIDC do; the public Okta flow renews
// client-side and never mints one. So this rides @tokenRenewal — the lane that runs
// on the Keycloak leg and is excluded from the okta and -crosssite legs.
const SESSION_LIMIT_TAGS = ['@sso', '@Platform', '@tokenRenewal'];

// Cap the server allows for the suite. Two sessions survive; the (CAP+1)th login
// evicts the least-recently-used (oldest) one.
const MAX_ACTIVE_SESSIONS = 2;

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('SSO Session Limit', { tag: SESSION_LIMIT_TAGS }, () => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    !username || !password,
    `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`
  );

  let helper: ProviderHelper;
  let restoreSecurity: (() => Promise<void>) | undefined;
  const sessions: { context: BrowserContext; page: Page }[] = [];

  test.beforeAll(
    'Swap server to a low active-session cap',
    async ({ browser }) => {
      test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS);

      helper = getProviderHelper(providerType);
      restoreSecurity = await swapSecurityConfig(
        browser,
        withMaxActiveSessions(
          await helper.buildConfigPayload(),
          MAX_ACTIVE_SESSIONS
        )
      );
    }
  );

  test.afterAll('Restore original security configuration', async () => {
    for (const { page, context } of sessions) {
      await page.close();
      await context.close();
    }

    await restoreSecurity?.();
  });

  test('should evict the least-recently-used session once the cap is exceeded', async ({
    browser,
  }) => {
    test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS * (MAX_ACTIVE_SESSIONS + 1));

    // Log the same user in across CAP+1 isolated contexts. Each fresh context is
    // its own cookie jar, so each is a distinct server session and each forces a
    // full IdP login. Sequential, so login order is the LRU order.
    for (let i = 0; i < MAX_ACTIVE_SESSIONS + 1; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginViaSso(page, helper, { username, password });
      sessions.push({ context, page });
    }

    const evicted = sessions[0].page;
    const survivor = sessions[sessions.length - 1].page;

    // The oldest session was revoked server-side by the last login. Its next
    // authenticated request — a reload — is rejected with 401, bouncing it to the
    // sign-in page. Unlike an expired-token refresh, the revoked-session path does
    // not raise the "session has timed out" banner, so assert the logged-out state.
    await evicted.reload();
    await evicted.waitForURL('**/signin', { timeout: 30_000 });
    await expect(evicted.locator('button.signin-button')).toBeVisible();

    // The newest session is within the cap and stays authenticated.
    await survivor.reload();
    await expect(survivor.getByTestId('dropdown-profile')).toBeVisible();
    expect(survivor.url()).not.toContain('/signin');
  });
});
