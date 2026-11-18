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
import { expect, test } from '@playwright/test';
import { clickIgnoringToasts, redirectToHomePage } from '../../utils/common';
import { ARTICLES_URL } from '../../utils/ContextCenterUtil';

const ARTICLES_PATH_RE = /\/api\/v1\/contextCenter\/pages/;
const PAGE_GOTO_OPTIONS = {
  timeout: 90_000,
  waitUntil: 'domcontentloaded',
} as const;

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Knowledge Center articles-page fetch-failure regression', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('failed list fetch shows in-place error placeholder, not the onboarding empty placeholder', async ({
    page,
  }) => {
    // Block every articles-list GET with a 500 — both the SPA's initial list
    // load and the sidebar's hierarchy call hit this endpoint. The sidebar's
    // failure mode is a separate code path; this assertion covers the list's
    // error-state contract added by the fix.
    await page.route(ARTICLES_PATH_RE, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'transient backend error' }),
      })
    );

    // Wait for the SPA-boot list GET to fire after navigation; capture the
    // promise first so the navigation's request is caught.
    const failingListResp = page.waitForResponse(
      (r) =>
        ARTICLES_PATH_RE.test(r.url()) &&
        r.request().method() === 'GET' &&
        !r.url().includes('/name/')
    );
    await page.goto(ARTICLES_URL, PAGE_GOTO_OPTIONS);
    await failingListResp;

    // C1: the parent layout (sidebar + toolbar) MUST stay visible — the bug
    // hid the entire ReflexContainer behind the onboarding placeholder.
    await expect(
      page.getByTestId('knowledge-pages-hierarchy-container')
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('articles-list-toolbar')).toBeVisible();

    // C2/C3: the list area renders the in-place error placeholder (with
    // Reload), NEVER the genuine-empty onboarding placeholder.
    await expect(page.getByText('Something went wrong')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText('Write it once, let AI answer it forever')
    ).toHaveCount(0);

    // C4: un-block + Reload → recover to the normal list (or the genuine
    // onboarding empty state if the server has zero articles). Either is fine
    // — only "Something went wrong" must disappear. Use clickIgnoringToasts because
    // the sidebar's own failure toast (the bug report mentions showEndpointToast)
    // would otherwise intercept the Reload button.
    await page.unroute(ARTICLES_PATH_RE);
    const retryListResp = page.waitForResponse(
      (r) =>
        ARTICLES_PATH_RE.test(r.url()) &&
        r.request().method() === 'GET' &&
        !r.url().includes('/name/') &&
        r.status() === 200
    );
    await clickIgnoringToasts(page.getByRole('button', { name: 'Reload' }));
    await retryListResp;

    // Assert a settled end state — "Something went wrong" is also hidden
    // while the retry is still loading.
    await expect(
      page
        .getByTestId('knowledge-page-listing')
        .or(page.getByText('Write it once, let AI answer it forever'))
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Something went wrong')).toBeHidden();
  });
});
