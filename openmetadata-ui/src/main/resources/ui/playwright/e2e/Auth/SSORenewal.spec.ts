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
import { BrowserContext, Page, Response } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { expect, test } from '../../support/fixtures/base';
import {
  AUTH_REFRESH_PATH,
  clearServerSessionCookie,
  decodeJwtExp,
  SHORT_ACCESS_TTL_SECONDS,
  waitForAccessTokenExpiry,
  withShortOidcTokenValidity,
  withShortSamlTokenValidity,
} from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import { keycloakOidcConfidentialProviderHelper } from '../../utils/sso-providers/keycloak-oidc';
import {
  ProviderConfigOverride,
  swapSecurityConfig,
} from '../../utils/ssoAuth';
import { loginViaSso, SSO_LOGIN_HOOK_TIMEOUT_MS } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

// Renewal over GET /api/v1/auth/refresh. SAML and confidential OIDC reach it
// through different handlers — SamlAuthServletHandler and
// AuthenticationCodeFlowHandler — but the contract is identical, so both run the
// same assertions against their own short token TTL.
//
// The Keycloak fixture backs both, and being the tenant is what makes the
// confidential leg possible at all: its client secret is a committed throwaway.
// A confidential Okta app is blocked by the tenant's Okta Verify enrollment
// policy. @tokenRenewal keeps this off the okta and -crosssite legs.
const RENEWAL_TAGS = ['@sso', '@Platform', '@tokenRenewal'];

const SCENARIOS: {
  title: string;
  resolveHelper: () => ProviderHelper;
  withShortTtl: (base: ProviderConfigOverride) => ProviderConfigOverride;
}[] = [
  {
    title: 'SAML',
    resolveHelper: () => getProviderHelper(providerType),
    withShortTtl: withShortSamlTokenValidity,
  },
  {
    title: 'confidential OIDC',
    resolveHelper: () => keycloakOidcConfidentialProviderHelper,
    withShortTtl: withShortOidcTokenValidity,
  },
];

test.describe.configure({ mode: 'serial' });

for (const scenario of SCENARIOS) {
  test.describe(
    `SSO Session Renewal — ${scenario.title}`,
    { tag: RENEWAL_TAGS },
    () => {
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        !username || !password,
        `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`
      );

      let helper: ProviderHelper;
      let restoreSecurity: (() => Promise<void>) | undefined;
      let userContext: BrowserContext | undefined;
      let userPage: Page | undefined;

      test.beforeAll(
        'Swap server to a short JWT TTL and establish a user session',
        async ({ browser }) => {
          test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS);

          helper = scenario.resolveHelper();
          restoreSecurity = await swapSecurityConfig(
            browser,
            scenario.withShortTtl(await helper.buildConfigPayload())
          );

          userContext = await browser.newContext();
          userPage = await userContext.newPage();
          await loginViaSso(userPage, helper, { username, password });
        }
      );

      test.afterAll('Restore original security configuration', async () => {
        test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS);

        await userPage?.close();
        await userContext?.close();

        await restoreSecurity?.();
      });

      test('should silently refresh the access token after expiry', async () => {
        test.slow();
        const page = userPage!;

        await expect(page.getByTestId('dropdown-profile')).toBeVisible();

        const initialAccessToken = await getToken(page);
        const initialExp = decodeJwtExp(initialAccessToken);

        await waitForAccessTokenExpiry(SHORT_ACCESS_TTL_SECONDS);

        // 200 only: a concurrent refresh answers 503 + Retry-After.
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
        test.slow();
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

      test('should force re-login when the session is gone', async () => {
        test.slow();
        const page = userPage!;

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
