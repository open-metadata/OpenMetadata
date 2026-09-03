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
  // Skip the whole leg at module-load time when the fixture reports the
  // env is not shaped for it (e.g. Okta with no OKTA_CLIENT_ID, Keycloak
  // with no KEYCLOAK_SAML_BASE_URL). Filtering here — instead of a
  // `test.skip()` inside `beforeAll` — keeps the report free of noise
  // "skipped" rows and satisfies `playwright/no-skipped-test`. The
  // reason is emitted so a missing IdP env var still shows up in the CI
  // log rather than disappearing silently.
  if (!fixture.isAvailable()) {
    process.stderr.write(
      `[SsoScenarios] Skipping ${fixture.slug}: ${
        fixture.unavailableReason?.() ??
        'fixture reports isAvailable() === false'
      }\n`
    );
    continue;
  }

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

      let restoreConfig: (() => Promise<void>) | undefined;
      // Describe-scoped admin session. `configureBackend`'s returned
      // restore closure captures the apiContext it received, so disposing
      // early (in a beforeAll finally) makes the afterAll restore hit a
      // dead context with "apiRequestContext.put: Target page, context or
      // browser has been closed". `sharedAfterAction` keeps that context
      // alive for the whole describe; dispose only from afterAll AFTER
      // restore runs.
      let sharedAfterAction: (() => Promise<void>) | undefined;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        sharedAfterAction = afterAction;
        try {
          // Mint a PAT and snapshot BEFORE the provider swap. The current
          // admin session is provider-bound (JwtFilter rejects it once the
          // provider is swapped); a PAT carries no `sessionId` claim and
          // stays verifiable across the swap — see `mintAdminRestoreToken`
          // in ssoAuth.ts. Without this, afterAll's restore hits 401 on
          // every non-Basic leg and fails the whole describe.
          let restoreToken: string | undefined;
          let snapshot: SecurityConfigSnapshot | undefined;
          try {
            restoreToken = await mintAdminRestoreToken(apiContext);
            snapshot = await fetchSecurityConfig(apiContext);
          } catch {
            // Non-fatal: fall back to the fixture-owned restore below. Some
            // legs (e.g. LDAP mounted on a fresh backend) may not have PAT
            // minting wired yet — better to try the fixture's own restore
            // than to bail on setup.
          }

          const configured = await fixture.configureBackend(apiContext);
          restoreConfig = async () => {
            if (restoreToken && snapshot) {
              const patContext = await getAuthContext(restoreToken);
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

      // Scenario 2 — logout clears storage and returns to /signin. Tokens
      // live in the SW/IndexedDB `app_state` JSON (see `SwTokenStorageUtils`,
      // keys `primary` / `secondary`), with a `localStorage['app_state']`
      // fallback for browsers without SW+IndexedDB. Assert on the union of
      // both so a leftover token is caught regardless of which storage the
      // fixture's browser context uses. A stale legacy `oidcIdToken` key is
      // also checked as belt-and-braces — nothing should write it anymore,
      // but a rogue reintroduction would silently re-auth the next tab.
      test('logout', async ({ page }) => {
        test.slow();

        await fixture.performLogin(page);
        await fixture.performLogout(page);

        await expect(page).toHaveURL(/\/signin$/);

        const remainingTokens = await page.evaluate(async () => {
          const legacy = localStorage.getItem('oidcIdToken');
          const localFallback = localStorage.getItem('app_state');
          let idb: string | null = null;
          try {
            // Same store path the SW writes to (`AppDataStore` DB,
            // `keyValueStore` object store, key `app_state` — see
            // `public/app-worker.js`) — read directly so we don't depend on
            // the SW being registered in the test browser context.
            idb = await new Promise<string | null>((resolve) => {
              const req = indexedDB.open('AppDataStore');
              req.onerror = () => resolve(null);
              req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('keyValueStore')) {
                  db.close();
                  resolve(null);

                  return;
                }
                const tx = db.transaction('keyValueStore', 'readonly');
                const get = tx.objectStore('keyValueStore').get('app_state');
                get.onerror = () => {
                  db.close();
                  resolve(null);
                };
                get.onsuccess = () => {
                  db.close();
                  const v = get.result;
                  resolve(typeof v === 'string' ? v : null);
                };
              };
            });
          } catch {
            idb = null;
          }

          const parseHasPrimary = (raw: string | null): boolean => {
            if (!raw) {
              return false;
            }
            try {
              const parsed = JSON.parse(raw) as { primary?: unknown };

              return (
                typeof parsed.primary === 'string' && parsed.primary !== ''
              );
            } catch {
              return false;
            }
          };

          return {
            legacy,
            fallbackHasToken: parseHasPrimary(localFallback),
            idbHasToken: parseHasPrimary(idb),
          };
        });

        expect(remainingTokens.legacy).toBeNull();
        expect(remainingTokens.fallbackHasToken).toBe(false);
        expect(remainingTokens.idbHasToken).toBe(false);
      });

      // Scenario 3 — silent refresh recovers an expired token. `forceTokenExpiry`
      // mangles the stored JWT's `exp` claim; the coordinator's boot path (or
      // its axios 401 interceptor) must detect the expired token and drive a
      // /auth/refresh handshake, then land the user back on the authenticated
      // shell without ever bouncing through /signin.
      //
      // Only Basic/LDAP/SAML/confidential-OIDC drive their Renewer through
      // OM's `/api/v1/auth/refresh` — MSAL/Auth0/OIDC-public/Okta run silent
      // refresh entirely inside the browser SDK, so the `waitForResponse` on
      // `/auth/refresh` below would hang for those fixtures. Gate at
      // registration time (rather than a runtime `test.skip()`) so
      // SDK-driven fixtures never enrol this scenario in the first place.
      if (fixture.usesBackendRefresh) {
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
      }

      // Scenario 4 — a second tab in the same browser context inherits the
      // authenticated session via shared localStorage without a second IdP
      // handshake. Fixtures whose auth is per-page (Basic, LDAP) opt out via
      // supportsCrossTab. Gate at registration time so the runtime
      // `test.skip()` is never needed.
      if (fixture.supportsCrossTab) {
        test('multi-tab shares auth state after login in one tab', async ({
          browser,
        }) => {
          test.slow();

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
      }

      // Scenario 5 — CrossTabLock (Web Locks + BroadcastChannel) coalesces
      // concurrent refresh attempts to exactly one 200. The follower tab does
      // NOT retry against the server: it resolves off the leader's broadcast,
      // so only one 200 hits the network across both tabs.
      // Only meaningful when BOTH capabilities hold: the CrossTabLock
      // presumes cross-tab shared storage, and the "single 200 hits the
      // network" assertion presumes /auth/refresh is observable. Gate at
      // registration time so SDK-refresh or per-tab fixtures never enrol.
      if (fixture.supportsCrossTab && fixture.usesBackendRefresh) {
        test('cross-tab refresh coalesces to a single /auth/refresh call', async ({
          browser,
        }) => {
          test.slow();

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
      }

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
      // catches both. Only OIDC-public exercises this route; every other
      // provider either never issues a silent-refresh iframe (Basic/LDAP)
      // or renews via its own SDK (MSAL/Auth0/Okta/SAML), so registration
      // is gated at the fixture level.
      if (fixture.supportsSilentCallback) {
        test('silent-callback iframe does not load the full app', async ({
          page,
        }) => {
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

          // `waitUntil: 'load'` fires once every top-level resource — the
          // entry chunk plus every `<link rel=modulepreload>` sibling the
          // built index.html emits — has settled. That is the exact
          // response set the bundle-size assertion below inspects, so it
          // is the correct synchronization point (no wall-clock sleep, no
          // banned `networkidle`). oidc-client's own async work is fire-
          // and-forget inside a hidden iframe and is not asserted on.
          await page.goto('/silent-callback', { waitUntil: 'load' });

          // Full-app shell markers MUST NOT be present in the iframe DOM.
          await expect(
            page.getByTestId(APP_BAR_HOME_TESTID)
          ).not.toBeAttached();
          await expect(page.locator('#appbar')).not.toBeAttached();

          // Bundle-size budget: no single JS chunk larger than 500 KB should
          // load for this route. The full-app bundle is >2 MB, so exceeding
          // 500 KB means AppRoot mounted. Threshold picked to be loose enough
          // for oidc-client itself and to survive Vite's hot-reload wrappers
          // in dev; tighten if it proves too permissive.
          const largeChunks = responses.filter((r) => r.size > 500_000);

          expect(largeChunks).toEqual([]);
        });
      }

      // Scenarios 8 & 9 previously asserted a ConfigErrorPage short-circuit
      // that hard-blocked the whole UI on any missing top-level field. Per
      // conductor review the block was replaced with a toast that lets the
      // SPA render normally, so those page-render + no-IdP-redirect
      // assertions no longer apply. Coverage now lives in:
      //   - src/utils/AuthProvider.util.test.ts — asserts the validator
      //     returns the missing-field list and emits an
      //     `[AuthConfig] Missing config value: <field>` console.warn per
      //     field (the surface an admin tails logs with).
      //   - src/components/Auth/AuthProviders/AuthProvider.test.tsx —
      //     asserts the AuthProvider mount calls `showErrorToast` with the
      //     joined field names when the fetched config fails validation
      //     (the surface the user sees).
      // Neither needs a full docker-compose Playwright leg.
    }
  );
}
