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
import { Page, expect, test as base } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';

const table = new TableClass();
const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Paginated Version History', () => {
  test.beforeAll(
    'Setup entity with versions',
    async ({ browser }) => {
      test.setTimeout(120_000);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);

      await table.create(apiContext);

      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/description',
            value: 'Description for pagination test',
          },
        ],
      });

      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('should call versions API with pagination params and return paging metadata', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);

    const fqn = table.entityResponseData?.fullyQualifiedName;

    await page.goto(`/table/${fqn}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="version-button"]');

    const versionsApiCall = page.waitForResponse(
      (response) =>
        response.url().includes('/versions') &&
        response.url().includes('limit=') &&
        response.status() === 200
    );

    await page.locator('[data-testid="version-button"]').click();
    const response = await versionsApiCall;
    const responseBody = await response.json();

    expect(responseBody.paging).toBeDefined();
    expect(responseBody.paging.total).toBeGreaterThanOrEqual(2);
    expect(responseBody.paging.limit).toBe(20);
    expect(responseBody.paging.offset).toBe(0);

    const versionSelectors = page.locator(
      '[data-testid^="version-selector-v"]'
    );

    await expect(versionSelectors.first()).toBeVisible();

    const count = await versionSelectors.count();

    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('should load more versions on scroll via infinite scroll', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);

    const fqn = table.entityResponseData?.fullyQualifiedName;
    const entityId = table.entityResponseData?.id;
    let totalVersionCount = 0;
    let callCount = 0;

    // Intercept the versions API to simulate pagination by modifying the response.
    // The first call returns only the first version; the sentinel triggers the second call
    // which returns the remaining versions.
    await page.route(
      (url) =>
        url.pathname.includes(`${entityId}/versions`) &&
        !url.pathname.includes('/versions/'),
      async (route) => {
        callCount++;
        const currentCall = callCount;

        const response = await route.fetch();
        const body = await response.json();

        if (currentCall === 1 && body.versions?.length >= 2) {
          totalVersionCount = body.versions.length;

          await route.fulfill({
            response,
            json: {
              ...body,
              versions: [body.versions[0]],
              paging: { offset: 0, limit: 1, total: totalVersionCount },
            },
          });
        } else if (currentCall === 2 && totalVersionCount > 0) {
          // Second call: return remaining versions from the full set
          // The server may return different data since offset differs,
          // so we use the cached total to build proper paging
          await route.fulfill({
            response,
            json: {
              ...body,
              paging: {
                offset: 1,
                limit: 1,
                total: totalVersionCount,
              },
            },
          });
        } else {
          await route.fulfill({ response, json: body });
        }
      }
    );

    await page.goto(`/table/${fqn}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="version-button"]');

    await page.locator('[data-testid="version-button"]').click();

    // The sentinel is immediately visible with only 1 version, so infinite scroll
    // auto-triggers the second API call. Wait for both versions to render.
    const versionSelectors = page.locator(
      '[data-testid^="version-selector-v"]'
    );

    await expect(versionSelectors.nth(1)).toBeVisible({ timeout: 15_000 });

    const totalCount = await versionSelectors.count();

    expect(totalCount).toBeGreaterThanOrEqual(2);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});
