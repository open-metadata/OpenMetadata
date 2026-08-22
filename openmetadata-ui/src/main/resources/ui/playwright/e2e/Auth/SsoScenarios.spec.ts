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
import { getAuthContext } from '../../utils/common';
import { auth0MockProviderFixture } from '../../utils/sso-providers/auth0-mock';
import { basicProviderFixture } from '../../utils/sso-providers/basic';
import type { SsoProviderFixture } from '../../utils/sso-providers/fixture';
import { keycloakOidcConfidentialProviderFixture } from '../../utils/sso-providers/keycloak-oidc';
import { keycloakOidcPublicProviderFixture } from '../../utils/sso-providers/keycloak-oidc-public';
import { keycloakSamlProviderFixture } from '../../utils/sso-providers/keycloak-saml';
import { ldapProviderFixture } from '../../utils/sso-providers/ldap';
import { msalMockProviderFixture } from '../../utils/sso-providers/msal-mock';
import { oktaProviderFixture } from '../../utils/sso-providers/okta';
import {
  fetchSecurityConfig,
  mintAdminRestoreToken,
  restoreSecurityConfig,
  SecurityConfigSnapshot,
} from '../../utils/ssoAuth';

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
      // A test failure must NOT retry: retries re-run beforeAll, but the
      // backend is now on this fixture's provider and /api/v1/auth/login no
      // longer accepts the seeded admin creds → the retry fails at setup
      // and masks the real failure. Each matrix leg starts with a fresh
      // backend anyway, so retries never bought us anything here.
      test.describe.configure({ retries: 0 });

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
      // Describe-scoped admin session. `configureBackend`'s returned
      // restore closure captures the apiContext it received, so disposing
      // early (in a beforeAll finally) makes the afterAll restore hit a
      // dead context with "apiRequestContext.put: Target page, context or
      // browser has been closed". Keep both apiContext and afterAction
      // alive for the whole describe; dispose only from afterAll AFTER
      // restore runs. Additionally: once configureBackend swaps the
      // backend away from Basic, /api/v1/auth/login no longer accepts the
      // seeded admin creds — scenarios 8/9 must reuse this same context
      // instead of re-performing admin login.
      let sharedApiContext:
        | import('@playwright/test').APIRequestContext
        | undefined;
      let sharedAfterAction: (() => Promise<void>) | undefined;
      // PAT minted BEFORE the provider swap; usable across the swap by
      // scenarios 8/9 to authenticate the broken-config PUT after the
      // session-bound sharedApiContext has been 401'd. See
      // `mintAdminRestoreToken` in ssoAuth.ts.
      let sharedRestoreToken: string | undefined;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        sharedApiContext = apiContext;
        sharedAfterAction = afterAction;
        try {
          // Mint a PAT and snapshot BEFORE the provider swap. The current
          // admin session is provider-bound (JwtFilter rejects it once the
          // provider is swapped); a PAT carries no `sessionId` claim and
          // stays verifiable across the swap — see `mintAdminRestoreToken`
          // in ssoAuth.ts. Without this, afterAll's restore hits 401 on
          // every non-Basic leg and fails the whole describe.
          let snapshot: SecurityConfigSnapshot | undefined;
          try {
            sharedRestoreToken = await mintAdminRestoreToken(apiContext);
            snapshot = await fetchSecurityConfig(apiContext);
          } catch {
            // Non-fatal: fall back to the fixture-owned restore below. Some
            // legs (e.g. LDAP mounted on a fresh backend) may not have PAT
            // minting wired yet — better to try the fixture's own restore
            // than to bail on setup.
          }

          const configured = await fixture.configureBackend(apiContext);
          restoreConfig = async () => {
            if (sharedRestoreToken && snapshot) {
              const patContext = await getAuthContext(sharedRestoreToken);
              try {
                await restoreSecurityConfig(patContext, snapshot);

                return;
              } finally {
                await patContext.dispose();
              }
            }
            // Fallback: fixture's own restore uses the (now provider-bound)
            // apiContext. Works for Basic; expected to 401 for other legs
            // but the next matrix leg starts with a fresh backend anyway.
            await configured.restore();
          };
        } catch (err) {
          // If configureBackend failed, we still own the admin session —
          // release it so the leg fails fast without leaking the worker.
          await afterAction();
          sharedApiContext = undefined;
          sharedAfterAction = undefined;
          throw err;
        }
      });

      test.afterAll(async () => {
        // Swallow restore failures — a failed teardown must not mask the
        // real test result, and each matrix leg starts with a fresh
        // backend so lingering non-Basic config never leaks between legs.
        try {
          await restoreConfig?.();
        } catch {
          // Intentionally silent — see comment above.
        } finally {
          await sharedAfterAction?.();
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

      // Scenario 7 — the /silent-callback iframe route is a bare oidc-client
      // handoff and MUST NOT boot the full app. If AppRoot ever mounted here
      // (regression: someone re-adds it under AuthProvider), a >2 MB main
      // chunk would load and the sidebar shell would attach — this test
      // catches both.
      test('silent-callback iframe does not load the full app', async ({
        page,
      }) => {
        if (!fixture.supportsSilentCallback) {
          test.skip(
            true,
            `${fixture.slug} does not use the silent-callback iframe`
          );

          return;
        }

        const responses: Array<{ url: string; size: number }> = [];
        page.on('response', async (resp) => {
          if (
            resp.url().endsWith('.js') ||
            resp.url().endsWith('.js.map') ||
            resp.url().endsWith('.css')
          ) {
            const body = await resp.body().catch(() => null);
            responses.push({ url: resp.url(), size: body?.length ?? 0 });
          }
        });

        await page.goto('/silent-callback');
        // Wait a couple hundred ms for oidc-client to fire signinSilentCallback
        // and any async work to complete; then snapshot the DOM.
        await page.waitForTimeout(500);

        // Full-app shell markers MUST NOT be present in the iframe DOM.
        await expect(page.getByTestId(APP_BAR_HOME_TESTID)).not.toBeAttached();
        await expect(page.locator('#appbar')).not.toBeAttached();

        // Bundle-size budget: no single JS chunk larger than 500 KB should
        // load for this route. The full-app bundle is >2 MB, so exceeding
        // 500 KB means AppRoot mounted. Threshold picked to be loose enough
        // for oidc-client itself and to survive Vite's hot-reload wrappers
        // in dev; tighten if it proves too permissive.
        const largeChunks = responses.filter((r) => r.size > 500_000);

        expect(largeChunks).toEqual([]);
      });

      // Scenario 8 — validateAuthFieldsDetailed short-circuits AuthProvider
      // when the backend advertises a broken config: ConfigErrorPage renders
      // and NO /authorize request is fired at the IdP. Guards against a
      // regression where the guard is removed and the user gets bounced
      // through a half-configured IdP.
      test('broken config renders ConfigErrorPage before IdP redirect', async ({
        page,
      }) => {
        // `sharedApiContext` is session-bound and 401s once the provider
        // was swapped in beforeAll (JwtFilter.validateSessionProviderIsCurrent).
        // Build a fresh PAT-based context from the token minted before the
        // swap — see `mintAdminRestoreToken` in ssoAuth.ts.
        if (!sharedRestoreToken) {
          test.skip(true, 'PAT-based admin context not initialized');

          return;
        }
        const cfgContext = await getAuthContext(sharedRestoreToken);
        const broken = await fixture.configureBrokenBackend(cfgContext);
        const restoreBroken = broken.restore;

        try {
          // Track any /authorize or IdP-side call — none should fire.
          let idpCalled = false;
          page.on('request', (req) => {
            const url = req.url();
            if (
              /\/authorize|\/oauth2|\/saml|\/openid-configuration/.test(url) &&
              !url.includes('localhost:8585') // ignore our own JWKS
            ) {
              idpCalled = true;
            }
          });

          await page.goto('/signin');
          // ConfigErrorPage renders under AuthProvider's short-circuit. Match
          // by the heading role — text goes through i18n so we assert on the
          // "config" substring for stability across locales.
          await expect(
            page.getByRole('heading', { name: /config/i })
          ).toBeVisible({ timeout: 20_000 });
          expect(idpCalled).toBe(false);
        } finally {
          await restoreBroken();
          // Restore the valid config so subsequent scenarios keep passing.
          // Chain its restore into the outer `restoreConfig` closure so the
          // `afterAll` teardown still works.
          const good = await fixture.configureBackend(cfgContext);
          restoreConfig = good.restore;
          await cfgContext.dispose();
        }
      });

      // Scenario 9 — validateAuthFieldsDetailed emits a `[AuthConfig] ...`
      // console.warn naming the specific offending field. The fixture owns
      // the expected pattern (each provider misconfigures its own field),
      // so we assert the pattern shows up in at least one warn line.
      test('broken config surfaces the specific field in a console.warn', async ({
        page,
      }) => {
        // Same rationale as scenario 8 — `sharedApiContext` is
        // session-bound and 401s after the provider swap. Use the
        // pre-swap PAT to authenticate config writes.
        if (!sharedRestoreToken) {
          test.skip(true, 'PAT-based admin context not initialized');

          return;
        }
        const cfgContext = await getAuthContext(sharedRestoreToken);
        const broken = await fixture.configureBrokenBackend(cfgContext);
        const restoreBroken = broken.restore;
        const expectedPattern = broken.expectedWarningPattern;

        try {
          const warnings: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'warning') {
              warnings.push(msg.text());
            }
          });

          await page.goto('/signin');
          await expect(
            page.getByRole('heading', { name: /config/i })
          ).toBeVisible({ timeout: 20_000 });

          // At least one warn line must match the fixture's expected pattern.
          const authConfigWarnings = warnings.filter((w) =>
            w.includes('[AuthConfig]')
          );

          expect(authConfigWarnings.length).toBeGreaterThan(0);
          expect(authConfigWarnings.some((w) => expectedPattern.test(w))).toBe(
            true
          );
        } finally {
          await restoreBroken();
          const good = await fixture.configureBackend(cfgContext);
          restoreConfig = good.restore;
          await cfgContext.dispose();
        }
      });
    }
  );
}
