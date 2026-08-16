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
import { expect, Page, Response, test } from '@playwright/test';
import { AdminClass } from '../../support/user/AdminClass';
import {
  AUTH_REFRESH_PATH,
  expireStoredToken,
} from '../../utils/sessionRenewal';

// Basic auth only: the AuthCoordinator contract (Renewer, install(), cross-tab
// lock) is provider-agnostic, so exercising it once through Basic proves it for
// every SSO provider without standing up IdP infrastructure this CI lacks
// (SSORenewal.spec.ts / OktaSessionRenewalPublic.spec.ts already cover the
// provider-specific renewal legs).
const SILENT_REFRESH_TAGS = ['@basic', '@Platform'];

const admin = new AdminClass();

const loginAdmin = async (page: Page): Promise<void> => {
  await admin.login(page);
  await expect(page.getByTestId('dropdown-profile')).toBeVisible();
};

/** Toggles document.visibilityState and fires the event VisibilityWatcher listens for. */
const setVisibility = (
  page: Page,
  state: 'visible' | 'hidden'
): Promise<void> =>
  page.evaluate((visibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
      value: visibilityState,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);

// A concurrent refresh loses the server-side lease and gets 503 + Retry-After
// (see SSORenewal.spec.ts), so only count the call that actually renewed.
const trackSuccessfulRefreshes = (
  target: Page,
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

test.describe(
  'Silent Refresh — Basic Auth',
  { tag: SILENT_REFRESH_TAGS },
  () => {
    test('should silently refresh an expired token on cold load and render the authenticated app', async ({
      page,
    }) => {
      test.slow();

      await test.step('Log in as admin', async () => {
        await loginAdmin(page);
      });

      await test.step('Expire the stored token and reload', async () => {
        await expireStoredToken(page);

        const refreshResponsePromise = page.waitForResponse(
          (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
          { timeout: 30_000 }
        );

        await page.reload({ waitUntil: 'domcontentloaded' });

        const refreshResponse = await refreshResponsePromise;

        expect(refreshResponse.status()).toBe(200);
      });

      await test.step('Assert the authenticated app renders, not the sign-in page', async () => {
        await expect(page.getByTestId('dropdown-profile')).toBeVisible();
        expect(page.url()).not.toContain('/signin');
      });
    });

    test('should recover a mid-session 401 with exactly one refresh and retry the request', async ({
      page,
    }) => {
      test.slow();

      await test.step('Log in as admin', async () => {
        await loginAdmin(page);
      });

      let intercepted = false;
      await test.step('Arm a single 401 on the next loggedInUser call', async () => {
        await page.route('**/api/v1/users/loggedInUser*', async (route) => {
          if (!intercepted) {
            intercepted = true;

            await route.fulfill({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ code: 401, message: 'Expired token!' }),
            });

            return;
          }
          await route.continue();
        });
      });

      const refreshCalls: string[] = [];
      const stopTracking = trackSuccessfulRefreshes(page, refreshCalls);

      try {
        await test.step('Trigger the 401 and assert a single refresh plus a successful retry', async () => {
          const refreshResponsePromise = page.waitForResponse(
            (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
            { timeout: 20_000 }
          );
          const retriedRequestPromise = page.waitForResponse(
            (r) =>
              r.url().includes('/api/v1/users/loggedInUser') &&
              r.status() === 200,
            { timeout: 20_000 }
          );

          await page.reload({ waitUntil: 'domcontentloaded' });

          await refreshResponsePromise;
          await retriedRequestPromise;

          await expect(page.getByTestId('dropdown-profile')).toBeVisible();
        });
      } finally {
        stopTracking();
        await page.unroute('**/api/v1/users/loggedInUser*');
      }

      expect(refreshCalls).toHaveLength(1);
      expect(intercepted).toBe(true);
      expect(page.url()).not.toContain('/signin');
    });

    test('should fire exactly one refresh across two tabs sharing a session', async ({
      browser,
    }) => {
      test.slow();

      const context = await browser.newContext();
      const pageA = await context.newPage();
      const pageB = await context.newPage();

      try {
        await test.step('Log in on tab A and open tab B in the same session', async () => {
          await loginAdmin(pageA);
          await pageB.goto('/my-data', { waitUntil: 'domcontentloaded' });
          await expect(pageB.getByTestId('dropdown-profile')).toBeVisible();
        });

        const refreshCalls: string[] = [];
        const stopTrackingA = trackSuccessfulRefreshes(pageA, refreshCalls);
        const stopTrackingB = trackSuccessfulRefreshes(pageB, refreshCalls);

        try {
          // No AuthCoordinator test hook is exposed on window (would require a
          // production Vite/bootstrap change out of scope for this task), so
          // both tabs are driven into a genuine 401 within the same window via
          // routed responses instead of calling ensureFreshToken() directly.
          // The CrossTabLock dedup this exercises (Web Locks + BroadcastChannel)
          // already has focused unit tests (Task 4) — this proves it end to end.
          await test.step('Arm one 401 per tab on the next loggedInUser call', async () => {
            const armOnce = async (target: Page) => {
              let intercepted = false;
              await target.route(
                '**/api/v1/users/loggedInUser*',
                async (route) => {
                  if (!intercepted) {
                    intercepted = true;

                    await route.fulfill({
                      status: 401,
                      contentType: 'application/json',
                      body: JSON.stringify({
                        code: 401,
                        message: 'Expired token!',
                      }),
                    });

                    return;
                  }
                  await route.continue();
                }
              );
            };

            await Promise.all([armOnce(pageA), armOnce(pageB)]);
          });

          await test.step('Reload both tabs in the same window and assert a single refresh', async () => {
            const refreshResponsePromise = pageA.waitForResponse(
              (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
              { timeout: 30_000 }
            );

            await Promise.all([
              pageA.reload({ waitUntil: 'domcontentloaded' }),
              pageB.reload({ waitUntil: 'domcontentloaded' }),
            ]);

            await refreshResponsePromise;

            await expect(pageA.getByTestId('dropdown-profile')).toBeVisible();
            await expect(pageB.getByTestId('dropdown-profile')).toBeVisible();

            // The follower tab resolves off a BroadcastChannel notification, not
            // the leader's own response — poll briefly for it to settle instead
            // of asserting on the instant the leader's request completes.
            await expect
              .poll(() => refreshCalls.length, { timeout: 10_000 })
              .toBeGreaterThan(0);
          });
        } finally {
          stopTrackingA();
          stopTrackingB();
          await pageA.unroute('**/api/v1/users/loggedInUser*');
          await pageB.unroute('**/api/v1/users/loggedInUser*');
        }

        expect(refreshCalls).toHaveLength(1);
        expect(pageA.url()).not.toContain('/signin');
        expect(pageB.url()).not.toContain('/signin');
      } finally {
        await pageA.close();
        await pageB.close();
        await context.close();
      }
    });

    test('should refresh once when the tab regains focus with an expired token', async ({
      page,
    }) => {
      test.slow();

      await test.step('Log in as admin', async () => {
        await loginAdmin(page);
      });

      await test.step('Expire the token while hidden, then assert a single refresh on focus', async () => {
        await expireStoredToken(page);

        const refreshCalls: string[] = [];
        const stopTracking = trackSuccessfulRefreshes(page, refreshCalls);

        try {
          const refreshResponsePromise = page.waitForResponse(
            (r) => r.url().includes(AUTH_REFRESH_PATH) && r.status() === 200,
            { timeout: 20_000 }
          );

          await setVisibility(page, 'hidden');
          await setVisibility(page, 'visible');

          await refreshResponsePromise;

          await expect(page.getByTestId('dropdown-profile')).toBeVisible();
        } finally {
          stopTracking();
        }

        expect(refreshCalls).toHaveLength(1);
      });
    });
  }
);
