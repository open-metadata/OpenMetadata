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
import { redirectToHomePage } from '../../utils/common';
import { createSubDomain, selectDomain } from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Use existing sample data domain and subdomains
const SAMPLE_DOMAIN_NAME = 'TestDomain';

// Create Domain object with sample data properties
const sampleDomain = new Domain();
sampleDomain.data.name = SAMPLE_DOMAIN_NAME;
sampleDomain.data.displayName = SAMPLE_DOMAIN_NAME;
sampleDomain.data.description =
  'Sample domain with 60 subdomains for pagination testing';

test.describe('SubDomain Pagination', () => {
  test.beforeEach('Navigate to domain page', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Verify subdomain count and pagination functionality', async ({
    page,
  }) => {
    await selectDomain(page, sampleDomain.data);

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await test.step('Verify subdomain count in tab label', async () => {
      const subDomainsTab = page.getByTestId('subdomains');

      await expect(subDomainsTab).toBeVisible();

      await expect(subDomainsTab).toContainText('60');
    });

    await test.step(
      'Navigate to subdomains tab and verify initial data load',
      async () => {
        const subDomainRes = page.waitForResponse(
          '/api/v1/search/query?q=*&from=0&size=50&index=domain_search_index&deleted=false&track_total_hits=true'
        );
        await page.getByTestId('subdomains').click();
        await subDomainRes;
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
        const subDomain = new SubDomain(sampleDomain);
        await createSubDomain(page, subDomain.data);

        await redirectToHomePage(page);

        await sidebarClick(page, SidebarItem.DOMAIN);
        await page.waitForLoadState('networkidle');

        await selectDomain(page, sampleDomain.data);

        const subDomainsTab = page.getByTestId('subdomains');

        await expect(subDomainsTab).toContainText('61');
      }
    );
  });
});
