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
import { performAdminLogin } from '../../utils/admin';
import { getAuthContext } from '../../utils/common';
import {
  AUTH_REFRESH_PATH,
  clearServerSessionCookie,
  decodeJwtExp,
  SHORT_ACCESS_TTL_SECONDS,
  waitForAccessTokenExpiry,
  withShortOidcTokenValidity,
} from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import { buildOktaConfidentialConfigPayload } from '../../utils/sso-providers/okta';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from '../../utils/ssoAuth';
import { loginViaSso } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

// The confidential counterpart to OktaPublicSessionRenewal.spec.ts, and the
// shape most self-hosted Okta deployments actually run.
//
// clientType: 'confidential' makes AuthProvider mount GenericAuthenticator
// rather than OktaAuthenticator, so renewal stops going to the Okta tenant and
// becomes GET /api/v1/auth/refresh against OpenMetadata, backed by the
// server-side OM_SESSION. That makes this suite a near-copy of
// SSORenewal.spec.ts, with oidcConfiguration.tokenValidity standing in for
// samlConfiguration.security.tokenValidity as the TTL knob.
//
// Tagged @okta, deliberately not @tokenRenewal. It does shorten a TTL, but
// tokenValidity governs OpenMetadata's own JWT rather than anything the Okta
// tenant issues, so the reason @tokenRenewal is excluded from the okta leg does
// not apply — and carrying that tag would leave this spec running nowhere.
const OKTA_CONFIDENTIAL_TAGS = ['@sso', '@Platform', '@okta'];

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';
const confidentialClientId =
  process.env[SSO_ENV.OKTA_CONFIDENTIAL_CLIENT_ID] ?? '';
const clientSecret = process.env[SSO_ENV.OKTA_CLIENT_SECRET] ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('Okta Confidential Session Renewal', {
  tag: OKTA_CONFIDENTIAL_TAGS,
}, () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    !username || !password || !confidentialClientId || !clientSecret,
    `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD} plus ${SSO_ENV.OKTA_CONFIDENTIAL_CLIENT_ID}/${SSO_ENV.OKTA_CLIENT_SECRET} for a confidential Okta app registration`
  );

  let helper: ProviderHelper;
  let adminJwt: string | undefined;
  let originalSecurityConfig: SecurityConfigSnapshot | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap server to confidential Okta with a short JWT TTL and sign in',
    async ({ browser }) => {
      helper = getProviderHelper(providerType);
      const { apiContext, afterAction, token } = await performAdminLogin(
        browser
      );

      try {
        adminJwt = token;

        if (!adminJwt) {
          throw new Error(
            'Failed to capture admin JWT before SSO swap — aborting to avoid leaving server in SSO mode'
          );
        }

        originalSecurityConfig = await fetchSecurityConfig(apiContext);

        await applyProviderConfig(
          apiContext,
          originalSecurityConfig,
          withShortOidcTokenValidity(
            buildOktaConfidentialConfigPayload(
              confidentialClientId,
              clientSecret
            )
          )
        );
      } finally {
        await afterAction();
      }

      userContext = await browser.newContext();
      userPage = await userContext.newPage();
      await loginViaSso(userPage, helper, { username, password });
    }
  );

  test.afterAll('Restore original security configuration', async () => {
    await userPage?.close();
    await userContext?.close();

    if (!adminJwt || !originalSecurityConfig) {
      return;
    }

    const adminContext = await getAuthContext(adminJwt);

    try {
      await restoreSecurityConfig(adminContext, originalSecurityConfig);
    } finally {
      await adminContext.dispose();
    }
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
});
