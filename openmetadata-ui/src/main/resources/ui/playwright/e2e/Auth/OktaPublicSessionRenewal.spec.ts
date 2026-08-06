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
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { performAdminLogin } from '../../utils/admin';
import { getAuthContext } from '../../utils/common';
import { decodeJwtExp, expireStoredToken } from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import {
  applyProviderConfig,
  fetchSecurityConfig,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from '../../utils/ssoAuth';
import { loginViaSso } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

// Renewal coverage for the Okta tenant, which SSORenewal.spec.ts cannot serve:
//
//   1. SSORenewal is tagged @tokenRenewal because it shortens the global access
//      token TTL, and the Okta matrix leg grep-inverts that tag away. Token
//      lifetimes live in the Okta tenant's access policy rather than in
//      OpenMetadata's config, so there is nothing to shorten here anyway —
//      expiry is induced on the client with expireStoredToken() instead.
//   2. The Okta app is a *public* client (see utils/sso-providers/okta.ts), so
//      AuthProvider mounts OktaAuthenticator and renewal goes through
//      @okta/okta-auth-js to the Okta tenant — never GET /api/v1/auth/refresh.
//      AUTH_REFRESH_PATH is therefore not observable here.
//
// Tagged @okta so the keycloak legs drop it at collection time. It must NOT
// carry @tokenRenewal: the Okta leg excludes that tag, which would leave this
// spec running nowhere.
const OKTA_PUBLIC_TAGS = ['@sso', '@Platform', '@okta'];

// Renewal endpoints on the Okta authorization server. Matched on path only so
// the globs hold for any tenant domain.
const OKTA_TOKEN_ENDPOINT = '**/oauth2/default/v1/token*';
const OKTA_AUTHORIZE_ENDPOINT = '**/oauth2/default/v1/authorize*';

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('Okta Public Session Renewal', { tag: OKTA_PUBLIC_TAGS }, () => {
  test.slow();
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    !username || !password,
    `Requires ${SSO_ENV.USERNAME}/${SSO_ENV.PASSWORD}`
  );

  let helper: ProviderHelper;
  let adminJwt: string | undefined;
  let originalSecurityConfig: SecurityConfigSnapshot | undefined;
  let userContext: BrowserContext | undefined;
  let userPage: Page | undefined;

  test.beforeAll(
    'Swap server to Okta and establish a user session',
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
          await helper.buildConfigPayload()
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

  test('should silently renew the token once the stored token has expired', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    const expiredJwt = await expireStoredToken(page, {
      sub: username,
      email: username,
    });

    // Renewal is driven by a 401 from a genuine API call, so this has to be a
    // real navigation — a no-op click observes nothing.
    await page.getByTestId('app-bar-item-explore').click();

    // Polls the decoded expiry rather than "token changed": a failed renewal
    // stores an empty string, which would satisfy "changed" and then blow up in
    // decodeJwtExp. Asserted against "now" rather than the pre-expiry token
    // because renewal may hand back okta-auth-js's still-valid cached ID token
    // instead of a brand new one — either outcome is a usable session.
    await expect
      .poll(
        async () => {
          const token = await getToken(page);

          if (!token || token === expiredJwt) {
            return 0;
          }

          try {
            return decodeJwtExp(token);
          } catch {
            return 0;
          }
        },
        { timeout: 60_000 }
      )
      .toBeGreaterThan(Math.floor(Date.now() / 1000));

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();
    expect(page.url()).not.toContain('/signin');
  });

  test('should fall back to interactive login when silent renewal returns login_required', async () => {
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    // Okta answers a prompt=none authorization request with login_required when
    // the tenant needs a fresh interaction (WebAuthn/MFA, or no IdP session).
    // Stubbing the response is what makes that deterministic — blocking cookies
    // instead would not work if the tenant issues refresh tokens.
    await page.route(OKTA_TOKEN_ENDPOINT, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'login_required',
          error_description:
            'The client specified not to prompt, but the user is not logged in.',
        }),
      })
    );

    // Only the silent (prompt=none) authorization request is failed. The
    // interactive redirect that the fallback is expected to perform carries no
    // prompt=none and must reach Okta untouched.
    const interactiveAuthorizeRequests: string[] = [];

    await page.route(OKTA_AUTHORIZE_ENDPOINT, (route) => {
      if (route.request().url().includes('prompt=none')) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'login_required' }),
        });
      }

      interactiveAuthorizeRequests.push(route.request().url());

      return route.continue();
    });

    await expireStoredToken(page, { sub: username, email: username });

    await page.getByTestId('app-bar-item-explore').click();

    // The observable fallback is an authorization request *without*
    // prompt=none. Asserting the hosted sign-in form instead would be wrong:
    // the tenant session is still live here, so Okta may answer the interactive
    // request straight away and bounce the user back already authenticated.
    // If the app looped on the silent request rather than falling back, no
    // interactive request is ever issued and this poll times out.
    await expect
      .poll(() => interactiveAuthorizeRequests.length, { timeout: 60_000 })
      .toBeGreaterThan(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
