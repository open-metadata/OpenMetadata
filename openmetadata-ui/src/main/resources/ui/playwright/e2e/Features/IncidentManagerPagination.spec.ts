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
import { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { seedFailedIncidents } from '../../utils/incidentManager';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

// 22 incidents guarantees more than one page at the default page size of 15 —
// the minimum needed to exercise Next/Previous and the page indicator.
const PAGINATION_INCIDENT_COUNT = 22;

const table = new TableClass();

const listUrl =
  '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list';

test.describe.configure({ mode: 'serial' });

test.describe('Incident Manager pagination', () => {
  test.beforeAll(async ({ browser }) => {
    // Seed incidents directly via the API — these tests only need many incidents
    // to exist, not a real ingestion pipeline run. This keeps setup fast and
    // deterministic and off the Airflow-dependent path. `test.slow()` does not
    // extend a hook's timeout, so set an explicit budget for creating 22 test
    // cases + results and waiting for them to be indexed.
    test.setTimeout(3 * 60 * 1000);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await seedFailedIncidents({
      apiContext,
      table,
      count: PAGINATION_INCIDENT_COUNT,
    });
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Next, Previous and page indicator', async ({ page }) => {
    const initialListRes = page.waitForResponse((res) =>
      res.url().includes(listUrl)
    );
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
    await initialListRes;

    await expect(
      page.getByTestId('test-case-incident-manager-table')
    ).toBeVisible();
    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('page-indicator')).toContainText('1');

    const nextListRes = page.waitForResponse(
      (res) => res.url().includes(listUrl) && res.url().includes('offset=15')
    );
    await page.getByTestId('next').click();
    await nextListRes;

    await expect(page.getByTestId('page-indicator')).toContainText('2');

    const prevListRes = page.waitForResponse(
      (res) => res.url().includes(listUrl) && res.url().includes('offset=0')
    );
    await page.getByTestId('previous').click();
    await prevListRes;

    await expect(page.getByTestId('page-indicator')).toContainText('1');
  });

  test('Page size dropdown updates list limit and resets to page 1', async ({
    page,
  }) => {
    const initialListRes = page.waitForResponse((res) =>
      res.url().includes(listUrl)
    );
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
    await initialListRes;

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(
      page.getByTestId('page-size-selection-dropdown')
    ).toBeVisible();

    await page.getByTestId('page-size-selection-dropdown').click();
    const listWithLimit50 = page.waitForResponse(
      (res) => res.url().includes(listUrl) && res.url().includes('limit=50')
    );
    await page.getByRole('menuitem', { name: /50.*page/i }).click();
    await listWithLimit50;

    await expect(page.getByTestId('page-indicator')).toContainText('1');
    await expect(
      page.getByTestId('page-size-selection-dropdown')
    ).toContainText('50');
  });
});
