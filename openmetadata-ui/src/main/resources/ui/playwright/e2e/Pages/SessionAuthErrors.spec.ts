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
import { expect, Page, Route, test } from '@playwright/test';
import {
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { setToken } from '../../utils/tokenStorage';

test.use({ storageState: 'playwright/.auth/admin.json' });

const TEAMS_URL = '/settings/members/teams';

// A syntactically valid JWT whose exp is far in the past. The UI only decodes the token to decide
// whether to renew it; the server rejects it on its own merits.
const EXPIRED_JWT = [
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiZXhwIjoxMDAwMDAwMDAwfQ',
  'not-a-real-signature',
].join('.');

const UPSTREAM_401_MESSAGE =
  'The configured runner token is not authorized for this namespace';
const FORBIDDEN_WRITE_MESSAGE =
  'Principal admin is not allowed to create teams';

const isTeamsCollection = (url: URL) => url.pathname.endsWith('/api/v1/teams');

const fulfillWith = (status: number, message: string) => (route: Route) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ code: status, message }),
  });

const fulfillMethodWith =
  (method: string, status: number, message: string) => async (route: Route) => {
    if (route.request().method() === method) {
      await fulfillWith(status, message)(route);
    } else {
      await route.fallback();
    }
  };

const expectStillSignedIn = async (page: Page) => {
  expect(page.url()).not.toContain('/signin');

  await expect(page.getByTestId('dropdown-profile')).toBeVisible();
};

/**
 * A 401 means "sign in again" only when our own session token is the thing that expired. Every
 * other 401 — most often a service the API depends on rejecting its own credentials — has to reach
 * the user as an error, because signing them out both loses their work and hides the real cause.
 *
 * See https://github.com/open-metadata/openmetadata-collate/issues/4647
 */
test.describe(
  'Auth errors: session failures sign out, everything else surfaces',
  { tag: ['@Pages', '@Platform'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('signs the user out when the session token has genuinely expired', async ({
      page,
    }) => {
      test.slow();

      // Renewal has to fail too, otherwise the app legitimately recovers.
      await page.route('**/api/v1/auth/refresh', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 401, message: 'No active session' }),
        })
      );
      await page.route('**/api/v1/users/refresh', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 401, message: 'Expired token!' }),
        })
      );

      await setToken(page, EXPIRED_JWT);

      await page.goto(TEAMS_URL, { waitUntil: 'domcontentloaded' });

      await page.waitForURL('**/signin**', { timeout: 60000 });

      expect(page.url()).toContain('/signin');
    });

    test('surfaces a 401 from a dependency instead of signing the user out', async ({
      page,
    }) => {
      test.slow();

      // The session is untouched and valid; only this endpoint answers 401. Before the fix the
      // interceptor read it as a dead session, redirected to /signin and swallowed the message.
      await page.route(
        isTeamsCollection,
        fulfillWith(401, UPSTREAM_401_MESSAGE)
      );

      await page.goto(TEAMS_URL, { waitUntil: 'domcontentloaded' });

      await toastNotification(page, new RegExp(UPSTREAM_401_MESSAGE, 'i'));
      await expectStillSignedIn(page);
    });

    test('surfaces a 403 on a write instead of signing the user out', async ({
      page,
    }) => {
      test.slow();

      await page.goto(TEAMS_URL, { waitUntil: 'domcontentloaded' });

      await page.getByTestId('add-team').waitFor({ state: 'visible' });
      await page.getByTestId('add-team').click();

      await page.locator('[role="dialog"].ant-modal').waitFor();

      await page.fill('[data-testid="name"]', `pw-team-${uuid()}`);
      await page.fill('[data-testid="display-name"]', `PW ${uuid()}`);
      await page.fill('[data-testid="email"]', `pwteam${uuid()}@example.com`);
      await page.locator(descriptionBox).fill('Created by a Playwright test');

      await page.route(
        isTeamsCollection,
        fulfillMethodWith('POST', 403, FORBIDDEN_WRITE_MESSAGE)
      );

      await page.locator('button[type="submit"]').click();

      await toastNotification(page, new RegExp(FORBIDDEN_WRITE_MESSAGE, 'i'));
      await expectStillSignedIn(page);
    });

    test('keeps a 403 on a read silent and the user signed in', async ({
      page,
    }) => {
      test.slow();

      // Permission-gated reads are everywhere and pages render their own placeholder, so this one
      // deliberately produces no toast. It must still never sign anyone out.
      await page.route(
        isTeamsCollection,
        fulfillMethodWith(
          'GET',
          403,
          'Principal admin is not allowed to list teams'
        )
      );

      await page.goto(TEAMS_URL, { waitUntil: 'domcontentloaded' });

      await expectStillSignedIn(page);
      await expect(page.getByTestId('alert-bar')).toHaveCount(0);
    });
  }
);
