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
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';

test.describe('Paginated Version History', () => {
  const table = new TableClass();
  const user2 = new UserClass();

  test.beforeAll('Setup entity with versions via alternating users', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { apiContext: adminApi, afterAction } =
      await performAdminLogin(browser);

    await user2.create(adminApi);
    await user2.setAdminRole(adminApi);
    const user2Page = await browser.newPage();
    await user2.login(user2Page);
    const user2Token = await user2Page.evaluate(() =>
      localStorage.getItem('oidcIdToken')
    );
    const user2Api = await browser.newContext().then((ctx) =>
      ctx.request.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8585',
        extraHTTPHeaders: {
          Authorization: `Bearer ${user2Token}`,
        },
      })
    );
    await user2Page.close();

    await table.create(adminApi);

    const fqn = table.entityResponseData?.fullyQualifiedName;

    await adminApi.patch(`/api/v1/tables/name/${fqn}`, {
      data: [
        {
          op: 'add',
          path: '/description',
          value: 'Admin patch 1',
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });

    await user2Api.patch(`/api/v1/tables/name/${fqn}`, {
      data: [
        {
          op: 'replace',
          path: '/description',
          value: 'User2 patch 2',
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });

    await adminApi.patch(`/api/v1/tables/name/${fqn}`, {
      data: [
        {
          op: 'replace',
          path: '/description',
          value: 'Admin patch 3',
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    });

    await user2Api.dispose();
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await user2.delete(apiContext);
    await afterAction();
  });

  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('should call versions API with pagination params and return paging metadata', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

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
    expect(responseBody.paging.total).toBeGreaterThanOrEqual(3);
    expect(responseBody.paging.limit).toBe(20);
    expect(responseBody.paging.offset).toBe(0);

    const versionSelectors = page.locator(
      '[data-testid^="version-selector-v"]'
    );

    await expect(versionSelectors.first()).toBeVisible();

    const count = await versionSelectors.count();

    expect(count).toBeGreaterThanOrEqual(3);
  });
});
