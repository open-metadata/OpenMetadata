/*
 *  Copyright 2026 Collate.
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
import { expect, Response, test } from '@playwright/test';
import { performAdminLogin } from '../../utils/admin';
import { auth0MockProviderFixture } from '../../utils/sso-providers/auth0-mock';
import { basicProviderFixture } from '../../utils/sso-providers/basic';
import type { SsoProviderFixture } from '../../utils/sso-providers/fixture';
import { keycloakOidcConfidentialProviderFixture } from '../../utils/sso-providers/keycloak-oidc';
import { keycloakOidcPublicProviderFixture } from '../../utils/sso-providers/keycloak-oidc-public';
import { keycloakSamlProviderFixture } from '../../utils/sso-providers/keycloak-saml';
import { ldapProviderFixture } from '../../utils/sso-providers/ldap';
import { msalMockProviderFixture } from '../../utils/sso-providers/msal-mock';
import { oktaProviderFixture } from '../../utils/sso-providers/okta';

// Every fixture the AuthCoordinator scenario matrix runs against. Scenarios 1–6
// covered here; commit 10 layers scenarios 7–9 (misconfig, self-signup) on top.
// The suite is written against the SsoProviderFixture interface only — no
// per-provider `if` branches — so adding a new provider is one push into this
// array plus its fixture module.
const FIXTURES: SsoProviderFixture[] = [
  basicProviderFixture,
  ldapProviderFixture,
  keycloakSamlProviderFixture,
  keycloakOidcConfidentialProviderFixture,
  keycloakOidcPublicProviderFixture,
  oktaProviderFixture,
  msalMockProviderFixture,
  auth0MockProviderFixture,
];

const AUTH_REFRESH_PATH = '/api/v1/auth/refresh';
const APP_BAR_HOME_TESTID = 'app-bar-item-my-data';

// Concurrent refresh attempts against the backend lose the server-side lease
// and get 503 + Retry-After (see AuthCoordinator + SSORenewal spec). Only 200s
// represent an actual token roll — that's what the coalescing lock guarantees
// happens exactly once across N tabs.
const trackSuccessfulRefreshes = (
  target: {
    on: (evt: 'response', h: (r: Response) => void) => void;
    off: (evt: 'response', h: (r: Response) => void) => void;
  },
  calls: string[]
): (() => void) => {
  const handler = (response: Response): void => {
    if (
      response.url().includes(AUTH_REFRESH_PATH) &&
      response.status() === 200
    ) {
      calls.push(response.url());
    }
  };
  target.on('response', handler);

  return () => target.off('response', handler);
};

for (const fixture of FIXTURES) {
  test.describe(
    `SSO / ${fixture.name} [${fixture.slug}]`,
    { tag: [`@${fixture.slug}`, '@sso-matrix'] },
    () => {
      // Every scenario in this describe block is skipped as a group if the
      // fixture reports it isn't runnable in the current env — e.g. Okta with
      // no OKTA_CLIENT_ID, Keycloak with no KEYCLOAK_SAML_BASE_URL. Runs before
      // configureBackend so we don't waste an admin login on an unusable row.
      test.beforeAll(() => {
        if (!fixture.isAvailable()) {
          test.skip(
            true,
            `Fixture unavailable: ${
              fixture.unavailableReason?.() ?? 'no reason given'
            }`
          );
        }
      });

      let restoreConfig: (() => Promise<void>) | undefined;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        try {
          const configured = await fixture.configureBackend(apiContext);
          restoreConfig = configured.restore;
        } finally {
          await afterAction();
        }
      });

      test.afterAll(async ({ browser }) => {
        if (!restoreConfig) {
          return;
        }
        // apiContext is baked into the closure returned by configureBackend,
        // so we only need the admin login to keep the worker's admin session
        // alive for the restore call. Destructure `afterAction` explicitly and
        // ignore the rest to keep the intent legible.
        const { afterAction } = await performAdminLogin(browser);
        try {
          await restoreConfig();
        } finally {
          await afterAction();
        }
      });

      // Scenario 1 — the plain login handshake resolves into the authenticated
      // shell. `performLogin` already waits for the sidebar, but re-assert here
      // so a fixture with a too-permissive internal wait fails loudly instead
      // of leaking a half-booted app into downstream tests.
      test('login', async ({ page }) => {
        test.slow();

        await fixture.performLogin(page);

        await expect(page.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
          timeout: 30_000,
        });
      });

      // Scenario 2 — logout clears storage and returns to /signin. The
      // oidcIdToken key is the single source of truth the coordinator reads on
      // cold-load, so leaving it behind would silently re-auth the next tab.
      test('logout', async ({ page }) => {
        test.slow();

        await fixture.performLogin(page);
        await fixture.performLogout(page);

        await expect(page).toHaveURL(/\/signin$/);

        const remainingToken = await page.evaluate(() =>
          localStorage.getItem('oidcIdToken')
        );

        expect(remainingToken).toBeNull();
      });

      // Scenario 3 — silent refresh recovers an expired token. `forceTokenExpiry`
      // mangles the stored JWT's `exp` claim; the coordinator's boot path (or
      // its axios 401 interceptor) must detect the expired token and drive a
      // /auth/refresh handshake, then land the user back on the authenticated
      // shell without ever bouncing through /signin.
      test('silent refresh recovers an expired token', async ({ page }) => {
        test.slow();

        await fixture.performLogin(page);
        await fixture.forceTokenExpiry(page);

        const refreshPromise = page.waitForResponse(
          (resp) =>
            resp.url().includes(AUTH_REFRESH_PATH) && resp.status() === 200,
          { timeout: 30_000 }
        );

        // Reload rather than a same-URL goto: reload guarantees the coordinator
        // reinstalls and inspects the stored token, which is what the "expired
        // token on cold-load" contract actually exercises.
        await page.reload({ waitUntil: 'domcontentloaded' });

        await refreshPromise;

        await expect(page.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
          timeout: 30_000,
        });
        expect(page.url()).not.toContain('/signin');
      });

      // Scenario 4 — a second tab in the same browser context inherits the
      // authenticated session via shared localStorage without a second IdP
      // handshake. Fixtures whose auth is per-page (Basic, LDAP) opt out via
      // supportsCrossTab.
      test('multi-tab shares auth state after login in one tab', async ({
        browser,
      }) => {
        test.slow();

        if (!fixture.supportsCrossTab) {
          test.skip(
            true,
            `${fixture.slug} does not mint tokens with cross-tab storage`
          );
        }

        const context = await browser.newContext();
        try {
          const tabA = await context.newPage();
          await fixture.performLogin(tabA);

          const tabB = await context.newPage();
          await tabB.goto('/', { waitUntil: 'domcontentloaded' });

          await expect(tabB.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
            timeout: 20_000,
          });
        } finally {
          await context.close();
        }
      });

      // Scenario 5 — CrossTabLock (Web Locks + BroadcastChannel) coalesces
      // concurrent refresh attempts to exactly one 200. The follower tab does
      // NOT retry against the server: it resolves off the leader's broadcast,
      // so only one 200 hits the network across both tabs.
      test('cross-tab refresh coalesces to a single /auth/refresh call', async ({
        browser,
      }) => {
        test.slow();

        if (!fixture.supportsCrossTab) {
          test.skip(true, `${fixture.slug} skipped: no cross-tab lock`);
        }

        const context = await browser.newContext();
        try {
          const tabA = await context.newPage();
          await fixture.performLogin(tabA);

          const tabB = await context.newPage();
          await tabB.goto('/', { waitUntil: 'domcontentloaded' });
          await expect(tabB.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
            timeout: 20_000,
          });

          const refreshCalls: string[] = [];
          const stopA = trackSuccessfulRefreshes(tabA, refreshCalls);
          const stopB = trackSuccessfulRefreshes(tabB, refreshCalls);

          try {
            // Force both stored tokens expired before either tab is asked to
            // do anything auth-gated, so the race is between their coordinator
            // boots — which is what the CrossTabLock is meant to serialize.
            await Promise.all([
              fixture.forceTokenExpiry(tabA),
              fixture.forceTokenExpiry(tabB),
            ]);

            // Reload both tabs simultaneously — each coordinator wakes with an
            // expired token and races for the Web Lock.
            await Promise.all([
              tabA.reload({ waitUntil: 'domcontentloaded' }),
              tabB.reload({ waitUntil: 'domcontentloaded' }),
            ]);

            await Promise.all([
              expect(tabA.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
                timeout: 30_000,
              }),
              expect(tabB.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
                timeout: 30_000,
              }),
            ]);

            // The follower resolves off a BroadcastChannel notification, not
            // the leader's own response, so poll briefly for the counter to
            // settle instead of asserting on the instant the leader completes.
            await expect
              .poll(() => refreshCalls.length, { timeout: 10_000 })
              .toBeGreaterThan(0);
          } finally {
            stopA();
            stopB();
          }

          expect(refreshCalls).toHaveLength(1);
          expect(tabA.url()).not.toContain('/signin');
          expect(tabB.url()).not.toContain('/signin');
        } finally {
          await context.close();
        }
      });

      // Scenario 6 — cold-load with an expired stored token must render the
      // authenticated shell within budget. Real IdPs vary, so the ceiling is
      // 15s soft (the coordinator's own timeouts sit well under this); regress
      // means someone added a synchronous roundtrip to the boot path.
      test('cold-load with an expired stored token renders authenticated within budget', async ({
        page,
      }) => {
        test.slow();

        await fixture.performLogin(page);
        await fixture.forceTokenExpiry(page);

        const start = Date.now();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId(APP_BAR_HOME_TESTID)).toBeVisible({
          timeout: 15_000,
        });
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(15_000);
        expect(page.url()).not.toContain('/signin');
      });
    }
  );
}
