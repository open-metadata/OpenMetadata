/*
 *  Copyright 2024 Collate.
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
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { SubDomain } from '../../support/domain/SubDomain';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { createSubDomain, selectDomain } from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const domain = new Domain();
const subDomains: SubDomain[] = [];
const SUBDOMAIN_COUNT = 60;

test.describe('SubDomain Pagination', () => {
  test.slow(true);

  test.beforeAll('Setup domain and subdomains', async ({ browser }) => {
    const { page, apiContext, afterAction } = await createNewPage(browser);

    await domain.create(apiContext);

    await redirectToHomePage(page);

    const createPromises = [];
    for (let i = 1; i <= SUBDOMAIN_COUNT; i++) {
      const subDomain = new SubDomain(
        domain,
        `TestSubDomain${i.toString().padStart(2, '0')}`
      );
      subDomains.push(subDomain);
      createPromises.push(subDomain.create(apiContext));
    }

    await Promise.all(createPromises);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Delete all subdomains in parallel
    const deletePromises = subDomains.map((subDomain) =>
      subDomain.delete(apiContext)
    );
    await Promise.all(deletePromises);

    await domain.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Navigate to domain page', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Verify subdomain count and pagination functionality', async ({
    page,
  }) => {
    await selectDomain(page, domain.data);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Verify subdomain count in tab label', async () => {
      const subDomainsTab = page.getByTestId('subdomains');

      await expect(subDomainsTab).toBeVisible();

      await expect(subDomainsTab).toContainText('60');
    });

    await test.step(
      'Navigate to subdomains tab and verify initial data load',
      async () => {
        await page.getByTestId('subdomains').click();
        await page.waitForResponse('/api/v1/search/query?*');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(page.locator('table')).toBeVisible();

        await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      }
    );

    await test.step('Test pagination navigation', async () => {
      // Verify current page shows page 1
      const tableRows = page.locator('table tbody tr');

      await expect(tableRows).toHaveCount(50);

      const nextPageResponse = page.waitForResponse('/api/v1/search/query?*');
      await page.locator('[data-testid="next"]').click();
      await nextPageResponse;

      await expect(tableRows).toHaveCount(10);

      const prevPageResponse = page.waitForResponse('/api/v1/search/query?*');
      await page.locator('[data-testid="previous"]').click();
      await prevPageResponse;

      await expect(tableRows).toHaveCount(50);
    });

    await test.step(
      'Create new subdomain and verify count updates',
      async () => {
        const subDomain = new SubDomain(domain);
        await createSubDomain(page, subDomain.data);

        await redirectToHomePage(page);

        await sidebarClick(page, SidebarItem.DOMAIN);
        await page.waitForLoadState('networkidle');

        await selectDomain(page, domain.data);

        const subDomainsTab = page.getByTestId('subdomains');

        await expect(subDomainsTab).toContainText('61');

        const { apiContext, afterAction } = await getApiContext(page);

        const response = await apiContext.get(
          '/api/v1/domains/name/' +
            encodeURIComponent(`"${domain.data.name}"."NewTestSubDomain"`)
        );
        const subDomainData = await response.json();
        await apiContext.delete(
          `/api/v1/domains/${subDomainData.id}?hardDelete=true`
        );
        await afterAction();
      }
    );
  });
});
