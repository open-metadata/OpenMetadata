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
import { expect, Page } from '@playwright/test';
import { get } from 'lodash';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { TableClass } from '../../../support/entity/TableClass';
import {
  chooseSelectOption,
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  clickLineageNode,
  performZoomOut,
  verifyExportLineagePNG,
  visitLineageTab,
} from '../../../utils/lineage';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';

// Create a table with '/' in the name to test encoding functionality
const tableNameWithSlash = `pw-table-with/slash-${uuid()}`;
const table = new TableClass(tableNameWithSlash);

const waitForPlatformView = (
  page: Page,
  view: 'service' | 'domain' | 'dataProduct'
) =>
  waitForResponseWithStatus(
    page,
    (response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/v1/lineage/getPlatformLineage' &&
        url.searchParams.get('view') === view
      );
    },
    200
  );

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await table.create(apiContext);

  await table.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        value: [
          {
            type: 'domain',
            id: EntityDataClass.domain1.responseData.id,
          },
        ],
        path: '/domains',
      },
    ],
  });

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  try {
    if (table.serviceResponseData.id) {
      await table.delete(apiContext);
    }
  } finally {
    await afterAction();
  }
});

test.describe('Entity Lineage tab', () => {
  test.beforeEach(async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);
  });

  test(
    'Verify table search with special characters as handled',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await redirectToHomePage(page);
      const db = table.databaseResponseData.name;

      await sidebarClick(page, SidebarItem.LINEAGE);

      await page.getByTestId('search-entity-select').waitFor();
      await page.getByTestId('search-entity-select').click();

      await page.fill(
        '[data-testid="search-entity-select"] .ant-select-selection-search-input',
        table.entity.name
      );

      const nodeFqn = get(table, 'entityResponseData.fullyQualifiedName');
      const dbFqn = get(
        table,
        'entityResponseData.database.fullyQualifiedName',
        ''
      );
      const tableLineageResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/v1/lineage/getLineage',
        200
      );
      await chooseSelectOption(
        page.getByTestId('search-entity-select'),
        page.getByTestId(`node-suggestion-${nodeFqn}`)
      );

      await tableLineageResponse;

      await expect(
        page.locator('[data-testid="lineage-details"]')
      ).toBeVisible();

      await expect(
        page.locator(`[data-testid="lineage-node-${nodeFqn}"]`)
      ).toBeVisible();

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.LINEAGE);
      await page.getByTestId('search-entity-select').waitFor();
      await page.click('[data-testid="search-entity-select"]');

      await page.fill(
        '[data-testid="search-entity-select"] .ant-select-selection-search-input',
        db
      );
      await page.getByTestId(`node-suggestion-${dbFqn}`).waitFor();
      const dbLineageResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === '/api/v1/lineage/getLineage',
        200
      );
      await chooseSelectOption(
        page.getByTestId('search-entity-select'),
        page.getByTestId(`node-suggestion-${dbFqn}`)
      );
      await dbLineageResponse;

      await expect(page.getByTestId('lineage-details')).toBeVisible();

      await clickLineageNode(page, dbFqn);

      await expect(
        page.locator('.lineage-entity-panel').getByTestId('entity-header-title')
      ).toBeVisible();
    }
  );

  test(
    'Verify service platform view',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const serviceBtn = page.getByTestId('lineage-layer-service-btn');
      await expect(serviceBtn).toBeVisible();

      await serviceBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(serviceBtn).toHaveAttribute('data-selected');
    }
  );

  test(
    'Verify domain platform view',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const domainBtn = page.getByTestId('lineage-layer-domain-btn');
      await expect(domainBtn).toBeVisible();

      await domainBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(domainBtn).toHaveAttribute('data-selected');

      await page.keyboard.press('Escape');

      await waitForAllLoadersToDisappear(page);
    }
  );

  test(
    'Verify platform view switching',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const serviceBtn = page.getByTestId('lineage-layer-service-btn');
      const domainBtn = page.getByTestId('lineage-layer-domain-btn');

      await serviceBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(serviceBtn).toHaveAttribute('data-selected');
      await expect(domainBtn).not.toHaveAttribute('data-selected');

      await domainBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(domainBtn).toHaveAttribute('data-selected');
      await expect(serviceBtn).not.toHaveAttribute('data-selected');
    }
  );
});

test.describe('Platform Lineage page (/lineage)', () => {
  test('Verify Platform Lineage View', async ({ page }) => {
    test.slow();

    await redirectToHomePage(page);
    const lineageRes = waitForPlatformView(page, 'service');
    await sidebarClick(page, SidebarItem.LINEAGE);
    await lineageRes;

    // Verify PNG export
    await verifyExportLineagePNG(page, true);

    await page.getByTestId('lineage-layer-btn').click();

    await page
      .locator('[data-testid="lineage-layer-domain-btn"]:not([data-selected])')
      .waitFor();

    const domainRes = waitForPlatformView(page, 'domain');
    await page.getByTestId('lineage-layer-domain-btn').click();
    await domainRes;

    await page.getByTestId('lineage-layer-btn').click();
    const dataProductRes = waitForPlatformView(page, 'dataProduct');
    await page.getByTestId('lineage-layer-data-product-btn').click();
    await dataProductRes;
  });

  test('Settings depth change refetches platform lineage', async ({ page }) => {
    // Regression: on /lineage the settings modal used to write into local
    // page state instead of the shared Zustand store the fetch effect
    // listens to, so changing upstream/downstream depth silently produced
    // no network call. Assert the getPlatformLineage refetch fires with the
    // new depth values.
    await redirectToHomePage(page);
    const initialRes = waitForPlatformView(page, 'service');
    await sidebarClick(page, SidebarItem.LINEAGE);
    const initialResponse = await initialRes;
    expect(initialResponse.status()).toBe(200);
    const initialQuery = new URL(initialResponse.url()).searchParams;
    const upstreamDepth = initialQuery.get('upstreamDepth') === '1' ? '2' : '1';
    const downstreamDepth =
      initialQuery.get('downstreamDepth') === '1' ? '2' : '1';

    await page.getByTestId('lineage-config').click();
    await page.getByTestId('field-upstream').waitFor({ state: 'visible' });
    await page.getByTestId('field-upstream').fill(upstreamDepth);
    await page.getByTestId('field-downstream').fill(downstreamDepth);

    const refetch = waitForResponseWithStatus(
      page,
      (response) => {
        const url = new URL(response.url());

        return (
          response.request().method() === 'GET' &&
          url.pathname === '/api/v1/lineage/getPlatformLineage' &&
          url.searchParams.get('upstreamDepth') === upstreamDepth &&
          url.searchParams.get('downstreamDepth') === downstreamDepth
        );
      },
      200
    );

    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await refetch;
  });
});
