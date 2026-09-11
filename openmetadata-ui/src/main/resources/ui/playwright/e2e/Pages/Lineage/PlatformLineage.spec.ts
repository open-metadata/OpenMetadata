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
import { expect } from '@playwright/test';
import { get } from 'lodash';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { TableClass } from '../../../support/entity/TableClass';
import {
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
import { test } from '../../fixtures/pages';

// Create a table with '/' in the name to test encoding functionality
const tableNameWithSlash = `pw-table-with/slash-${uuid()}`;
const table = new TableClass(tableNameWithSlash);

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

      await page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/search/query') &&
          req.url().includes('deleted=false')
      );

      await page.locator('.ant-select-dropdown').waitFor();

      const nodeFqn = get(table, 'entityResponseData.fullyQualifiedName');
      const dbFqn = get(
        table,
        'entityResponseData.database.fullyQualifiedName',
        ''
      );
      const tableLineageResponse = page.waitForResponse(
        '/api/v1/lineage/getLineage?*'
      );
      await page
        .locator(`[data-testid="node-suggestion-${nodeFqn}"]`)
        .dispatchEvent('click');

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
      const dbLineageResponse = page.waitForResponse(
        '/api/v1/lineage/getLineage?*'
      );
      await page.getByTestId(`node-suggestion-${dbFqn}`).dispatchEvent('click');
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
    // Slow unconditionally: verifyExportLineagePNG waits up to 120s for the
    // download event, so the outer test timeout must exceed that. The base
    // 60s left PR runs (where PLAYWRIGHT_IS_OSS is set) unable to ever reach
    // the download event — the test timed out mid-render every time.
    test.slow();

    // Cap payload so the client-side toCanvas + PNG encode stays inside the
    // verifyExportLineagePNG 120s download-event budget. The dominant cost is
    // DOM cloning in html-to-image, which scales linearly with node count —
    // ~5000 inner DOM elements per 200 lineage nodes takes ~90s just to
    // clone on nightly CI runners, leaving no room for encoding. 100 nodes
    // is enough to prove the export path works end-to-end (verifies the
    // route intercept, PNG selection, and download event) without dictating
    // an unreliable rendering budget. Any real-user export of a much larger
    // graph is protected by the adaptive-pixelRatio cap in
    // openmetadata-ui/.../utils/Export/ExportUtils.ts.
    const MAX_NODES = 50;

    await page.route(
      '**/api/v1/lineage/getPlatformLineage**',
      async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        const filteredData = {
          ...data,
          nodes: data.nodes
            ? Object.fromEntries(Object.entries(data.nodes).slice(0, MAX_NODES))
            : data.nodes,
        };

        // Use Playwright's { response, json } shortcut so headers stay valid
        // after the body change. The shortcut auto-strips Content-Encoding
        // (no longer gzip after our modification) and re-computes Content-
        // Length. Passing headers: response.headers() verbatim — which the
        // previous version did — keeps a stale Content-Encoding: gzip and
        // wrong Content-Length, both of which silently break body parsing.
        await route.fulfill({
          response,
          json: filteredData,
        });
      }
    );

    await redirectToHomePage(page);
    const lineageRes = page.waitForResponse(
      '/api/v1/lineage/getPlatformLineage?view=service*'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    await lineageRes;

    // Verify PNG export
    await verifyExportLineagePNG(page, true);

    await page.getByTestId('lineage-layer-btn').click();

    await page
      .locator('[data-testid="lineage-layer-domain-btn"]:not([data-selected])')
      .waitFor();

    const domainRes = page.waitForResponse(
      '/api/v1/lineage/getPlatformLineage?view=domain*'
    );
    await page.getByTestId('lineage-layer-domain-btn').click();
    await domainRes;

    await page.getByTestId('lineage-layer-btn').click();
    const dataProductRes = page.waitForResponse(
      '/api/v1/lineage/getPlatformLineage?view=dataProduct*'
    );
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
    const initialRes = page.waitForResponse(
      '/api/v1/lineage/getPlatformLineage?view=service*'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    await initialRes;

    await page.getByTestId('lineage-config').click();
    await page.getByTestId('field-upstream').waitFor({ state: 'visible' });
    await page.getByTestId('field-upstream').fill('2');
    await page.getByTestId('field-downstream').fill('2');

    const refetch = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/lineage/getPlatformLineage') &&
        response.url().includes('upstreamDepth=2') &&
        response.url().includes('downstreamDepth=2')
    );

    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await refetch;
  });
});
