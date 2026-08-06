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
import { BrowserContext, expect, Page, Response, test } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import {
  AUTH_REFRESH_PATH,
  clearServerSessionCookie,
  decodeJwtExp,
  SHORT_ACCESS_TTL_SECONDS,
  waitForAccessTokenExpiry,
  withShortOidcTokenValidity,
} from '../../utils/sessionRenewal';
import { ProviderHelper } from '../../utils/sso-providers';
import { keycloakOidcConfidentialProviderHelper } from '../../utils/sso-providers/keycloak-oidc';
import {
  OKTA_CONFIDENTIAL,
  oktaConfidentialProviderHelper,
} from '../../utils/sso-providers/okta';
import {
  swapSecurityConfig,
} from '../../utils/ssoAuth';
import { loginViaSso } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

// Confidential-client OIDC renewal — the flow most self-hosted deployments run,
// and the one with no CI coverage at all before this suite. The Java ITs carry
// confidential backends but nothing sets jpw.auth, and the mock-oidc Playwright
// suite is referenced by no workflow, so AuthenticationCodeFlowHandler
// (handleLogin, handleCallback, handleRefresh) is otherwise exercised only by
// mocked unit tests. Reaching the first assertion here walks the whole
// server-side code flow: authorize, callback, code exchange, session, refresh.
//
// clientType: 'confidential' is what makes AuthProvider mount
// GenericAuthenticator, moving renewal onto GET /api/v1/auth/refresh — the same
// transport SSORenewal.spec.ts asserts for SAML, reached through a different
// handler. So the assertions match that suite; only the IdP differs.
//
// Two scenarios, because the tags have to differ and each lands on exactly the
// leg that can serve it:
//
//   Keycloak  @tokenRenewal  runs today. The fixture is the tenant, so its client
//                            secret is a committed throwaway and no external app
//                            registration is needed. The okta and -crosssite legs
//                            both exclude this tag.
//   Okta      @okta          skips until a Web app registration and
//                            OKTA_CLIENT_SECRET exist. The keycloak legs exclude
//                            this tag.
const CONFIDENTIAL_SCENARIOS: {
  title: string;
  tag: string;
  helper: ProviderHelper;
  hasCredentials: boolean;
  skipReason: string;
}[] = [
  {
    title: 'Keycloak',
    tag: '@tokenRenewal',
    helper: keycloakOidcConfidentialProviderHelper,
    hasCredentials: Boolean(username && password),
    skipReason: `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`,
  },
  {
    title: 'Okta',
    tag: '@okta',
    helper: oktaConfidentialProviderHelper,
    hasCredentials: Boolean(
      username &&
        password &&
        OKTA_CONFIDENTIAL.clientId &&
        OKTA_CONFIDENTIAL.clientSecret
    ),
    skipReason: `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD} plus ${SSO_ENV.OKTA_CONFIDENTIAL_CLIENT_ID}/${SSO_ENV.OKTA_CLIENT_SECRET} for a confidential Okta Web app`,
  },
];

test.describe.configure({ mode: 'serial' });

for (const scenario of CONFIDENTIAL_SCENARIOS) {
  test.describe(
    `Confidential OIDC Session Renewal — ${scenario.title}`,
    { tag: ['@sso', '@Platform', scenario.tag] },
    () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(!scenario.hasCredentials, scenario.skipReason);

  const helper = scenario.helper;
  let restoreSecurity: (() => Promise<void>) | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap server to confidential OIDC with a short JWT TTL and sign in',
    async ({ browser }) => {
      restoreSecurity = await swapSecurityConfig(
        browser,
        withShortOidcTokenValidity(await helper.buildConfigPayload())
      );

      userContext = await browser.newContext();
      userPage = await userContext.newPage();
      await loginViaSso(userPage, helper, { username, password });
    }
  );

  test.afterAll('Restore original security configuration', async () => {
    await userPage?.close();
    await userContext?.close();
    await restoreSecurity?.();
  });

  test('should silently refresh the OpenMetadata token after expiry', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const initialAccessToken = await getToken(page);
    const initialExp = decodeJwtExp(initialAccessToken);

    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    // 200 specifically: handleRefresh answers a concurrent refresh with 503 +
    // Retry-After, which must not satisfy the wait.
    const refreshResponsePromise = page.waitForResponse(
      (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
      { timeout: 15_000 }
    );

    await page.getByTestId('app-bar-item-explore').click();

    const refreshResponse = await refreshResponsePromise;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const newAccessToken = await getToken(page);

    expect(refreshResponse.status()).toBe(200);
    expect(newAccessToken).not.toBe(initialAccessToken);
    expect(decodeJwtExp(newAccessToken)).toBeGreaterThan(initialExp);
    expect(page.url()).not.toContain('/signin');
  });

  test('should queue concurrent 401s behind a single refresh call', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    await page.getByTestId('app-bar-item-my-data').click();
    await page.waitForURL('**/my-data');

    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    const refreshCalls: string[] = [];
    const trackRefresh = (response: Response): void => {
      if (response.url().includes(AUTH_REFRESH_PATH)) {
        refreshCalls.push(response.url());
      }
    };

    page.on('response', trackRefresh);

    try {
      const refreshResponsePromise = page.waitForResponse(
        (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
        { timeout: 15_000 }
      );

      await page.getByTestId('app-bar-item-explore').click();
      await refreshResponsePromise;
      await expect(page.getByTestId('dropdown-profile')).toBeVisible();
    } finally {
      page.off('response', trackRefresh);
    }

    expect(refreshCalls).toHaveLength(1);
    expect(page.url()).not.toContain('/signin');
  });

  test('should force re-login when the OpenMetadata session is gone', async () => {
    const page = userPage!;

    // Without OM_SESSION, acquireRefreshLease finds nothing and handleRefresh
    // answers 401 {"error":"No active session"} — the confidential-client
    // equivalent of the IdP refusing a silent renewal.
    await clearServerSessionCookie(userContext!);
    await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

    await page.reload();

    await page.waitForURL('**/signin', { timeout: 30_000 });
    await expect(page.getByText(/session has timed out/i)).toBeVisible();
    await expect(page.locator('button.signin-button')).toBeVisible();
  });
    }
  );
}
