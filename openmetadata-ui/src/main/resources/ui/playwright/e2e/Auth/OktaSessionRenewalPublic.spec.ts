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
import { BrowserContext, Page, Request } from '@playwright/test';
import { SSO_ENV } from '../../constant/ssoAuth';
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage } from '../../utils/common';
import { decodeJwtExp, expireStoredToken } from '../../utils/sessionRenewal';
import { getProviderHelper, ProviderHelper } from '../../utils/sso-providers';
import { swapSecurityConfig } from '../../utils/ssoAuth';
import { loginViaSso, SSO_LOGIN_HOOK_TIMEOUT_MS } from '../../utils/ssoLogin';
import { getToken } from '../../utils/tokenStorage';

// Public-client Okta renews through @okta/okta-auth-js against the tenant, so
// AUTH_REFRESH_PATH is not observable here. Okta fixes the ID token at 60min and
// SSORenewal's TTL override has no equivalent, so expiry is induced client-side.
//
// @okta, deliberately not @tokenRenewal — the okta leg excludes that tag, which
// would leave this spec running nowhere.
const OKTA_PUBLIC_TAGS = ['@sso', '@Platform', '@okta'];

// Renewal endpoints on the Okta authorization server. Matched on path only so
// they hold for any tenant domain.
const OKTA_TOKEN_PATH = '/oauth2/default/v1/token';
const OKTA_AUTHORIZE_PATH = '/oauth2/default/v1/authorize';
const OKTA_TOKEN_ENDPOINT = `**${OKTA_TOKEN_PATH}*`;
const OKTA_AUTHORIZE_ENDPOINT = `**${OKTA_AUTHORIZE_PATH}*`;

const providerType = process.env[SSO_ENV.PROVIDER_TYPE] ?? '';
const username = process.env[SSO_ENV.USERNAME] ?? '';
const password = process.env[SSO_ENV.PASSWORD] ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('Okta Public Session Renewal', { tag: OKTA_PUBLIC_TAGS }, () => {
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
    'Swap server to Okta and establish a user session',
    async ({ browser }) => {
      test.setTimeout(SSO_LOGIN_HOOK_TIMEOUT_MS);

      helper = getProviderHelper(providerType);
      restoreSecurity = await swapSecurityConfig(
        browser,
        await helper.buildConfigPayload()
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

  test('should silently renew the token once the stored token has expired', async () => {
    test.slow();
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    // "Token became valid again" alone would pass if the app merely re-wrote
    // okta-auth-js's cached copy, so also require a network renewal.
    const renewalRequests: string[] = [];
    const trackRenewal = (request: Request): void => {
      const url = request.url();

      if (url.includes(OKTA_TOKEN_PATH) || url.includes(OKTA_AUTHORIZE_PATH)) {
        renewalRequests.push(url);
      }
    };

    page.on('request', trackRenewal);

    try {
      const expiredJwt = await expireStoredToken(page, {
        sub: username,
        email: username,
      });

      // Renewal is driven by a 401 from a genuine API call, so this has to be a
      // real navigation — a no-op click observes nothing.
      await page.getByTestId('app-bar-item-explore').click();

      // Polls the decoded expiry, not "changed": a failed renewal stores '' which
      // would satisfy "changed" and then throw in decodeJwtExp.
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
    } finally {
      page.off('request', trackRenewal);
    }

    expect(renewalRequests.length).toBeGreaterThan(0);
    await expect(page.getByTestId('dropdown-profile')).toBeVisible();
    expect(page.url()).not.toContain('/signin');
  });

  test('should fall back to interactive login when silent renewal returns login_required', async () => {
    test.slow();
    const page = userPage!;

    await expect(page.getByTestId('dropdown-profile')).toBeVisible();

    // Test 1 ends on the Explore page. Navigating home ensures the subsequent
    // app-bar-item-explore click is always a real navigation that triggers an
    // API call, a 401, and the renewal flow we are testing.
    await redirectToHomePage(page);

    // renewToken reaches signInWithRedirect() both from the catch around
    // renewTokens() and from an early return when okta-auth-js holds no tokens.
    // Ordering is what distinguishes them.
    const renewalEvents: string[] = [];

    // Stubbed rather than achieved by dropping cookies, which a tenant issuing
    // refresh tokens would renew straight through.
    await page.route(OKTA_TOKEN_ENDPOINT, (route) => {
      renewalEvents.push('silent-token');

      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'login_required',
          error_description:
            'The client specified not to prompt, but the user is not logged in.',
        }),
      });
    });

    // Only the silent (prompt=none) authorization request is failed. The
    // interactive redirect that the fallback is expected to perform carries no
    // prompt=none and must reach Okta untouched.
    await page.route(OKTA_AUTHORIZE_ENDPOINT, (route) => {
      if (route.request().url().includes('prompt=none')) {
        renewalEvents.push('silent-authorize');

        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'login_required' }),
        });
      }

      renewalEvents.push('interactive-authorize');

      return route.continue();
    });

    await expireStoredToken(page, { sub: username, email: username });

    await page.getByTestId('app-bar-item-explore').click();

    // Asserting the hosted sign-in form would be wrong: the tenant session is
    // still live, so Okta may answer immediately and bounce back authenticated.
    await expect
      .poll(
        () => renewalEvents.filter((e) => e === 'interactive-authorize').length,
        { timeout: 60_000 }
      )
      .toBeGreaterThan(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });

    // The refused silent renewal must be what triggered it.
    expect(renewalEvents.length).toBeGreaterThan(1);
    expect(renewalEvents[0]).toMatch(/^silent-/);
    expect(renewalEvents).toContain('interactive-authorize');
  });
});
