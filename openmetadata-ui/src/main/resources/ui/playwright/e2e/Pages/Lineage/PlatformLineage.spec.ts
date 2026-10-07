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
import { DatabaseClass } from '../../../support/entity/DatabaseClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { TableClass } from '../../../support/entity/TableClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  dismissLineageMapOnboarding,
  expectLineageNodeVisible,
  performZoomOut,
  verifyExportLineagePNG,
  visitLineageTab,
} from '../../../utils/lineage';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';

// Create a table with '/' in the name to test encoding functionality.
// Its database is owned rather than the shard's shared one: the database
// lineage scene draws every table and edge other specs put under the shared
// database, and there the scene request failed or this table's schema node
// never rendered.
const tableNameWithSlash = `pw-table-with/slash-${uuid()}`;
const table = new TableClass({
  name: tableNameWithSlash,
  database: new DatabaseClass(),
});

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
  await table.delete(apiContext);
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

      const entitySearch = page
        .getByTestId('search-entity-select')
        .getByRole('combobox');
      const suggestions = page.locator('[role="listbox"]:visible');

      const searchRequest = page.waitForRequest(
        (req) =>
          req.url().includes('/api/v1/search/query') &&
          req.url().includes('deleted=false')
      );
      await entitySearch.fill(table.entity.name);
      await searchRequest;

      const nodeFqn = get(table, 'entityResponseData.fullyQualifiedName', '');
      const dbFqn = get(
        table,
        'entityResponseData.database.fullyQualifiedName',
        ''
      );
      const schemaFqn = get(
        table,
        'entityResponseData.databaseSchema.fullyQualifiedName',
        ''
      );
      const tableSceneResponse = waitForResponseWithStatus(
        page,
        (response) =>
          new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
          new URL(response.url()).searchParams.get('focusFqn') === nodeFqn,
        200
      );
      await suggestions.getByTestId(`option-${nodeFqn}`).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(`/lineage/table/${encodeURIComponent(nodeFqn)}`);
      await tableSceneResponse;

      await expect(
        page.locator('[data-testid="lineage-details"]')
      ).toBeVisible();
      await expectLineageNodeVisible(page, nodeFqn);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.LINEAGE);
      await entitySearch.fill(db);
      await suggestions.getByTestId(`option-${dbFqn}`).waitFor();
      const databaseSceneResponse = waitForResponseWithStatus(
        page,
        (response) =>
          new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
          new URL(response.url()).searchParams.get('focusFqn') === dbFqn,
        200
      );
      await suggestions.getByTestId(`option-${dbFqn}`).click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(`/lineage/database/${encodeURIComponent(dbFqn)}`);
      await databaseSceneResponse;

      await expect(page.getByTestId('lineage-details')).toBeVisible();
      await expectLineageNodeVisible(page, schemaFqn);
    }
  );

  test(
    'Verify service platform view',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const serviceBtn = page.getByTestId('lineage-layer-lens-service');
      await expect(serviceBtn).toBeVisible();
      await expect(serviceBtn).toHaveAttribute('data-selected');
    }
  );

  test(
    'Verify domain platform view',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const domainBtn = page.getByTestId('lineage-layer-lens-domain');
      await expect(domainBtn).toBeVisible();

      const domainSceneResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
          new URL(response.url()).searchParams.get('lens') === 'domain'
      );
      await domainBtn.click();
      expect((await domainSceneResponse).ok()).toBeTruthy();

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

      const serviceBtn = page.getByTestId('lineage-layer-lens-service');
      const domainBtn = page.getByTestId('lineage-layer-lens-domain');

      await expect(serviceBtn).toHaveAttribute('data-selected');
      await expect(domainBtn).not.toHaveAttribute('data-selected');

      const domainSceneResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
          new URL(response.url()).searchParams.get('lens') === 'domain'
      );
      await domainBtn.click();
      expect((await domainSceneResponse).ok()).toBeTruthy();

      await page.getByTestId('lineage-layer-btn').click();
      await expect(domainBtn).toHaveAttribute('data-selected');
      await expect(serviceBtn).not.toHaveAttribute('data-selected');

      await serviceBtn.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageLens'))
        .toBe('service');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(serviceBtn).toHaveAttribute('data-selected');
      await expect(domainBtn).not.toHaveAttribute('data-selected');
    }
  );
});

test.describe('Platform Lineage page (/lineage)', () => {
  test('Verify Platform Lineage View', async ({ page }) => {
    // Slow unconditionally: verifyExportLineagePNG waits up to 120s for the
    // download event, so the outer test timeout must exceed that. The base
    // 60s left PR runs (where PLAYWRIGHT_IS_OSS is set) unable to ever reach
    // the download event -- the test timed out mid-render every time.
    test.slow();

    // Keep PNG rendering within the download-event budget on CI runners.
    const MAX_NODES = 100;

    await page.route('**/api/v1/lineage/scene?*', async (route) => {
      const requestUrl = new URL(route.request().url());
      requestUrl.searchParams.set('size', String(MAX_NODES));
      await route.continue({ url: requestUrl.toString() });
    });

    await redirectToHomePage(page);
    const lineageRes = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'service'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    expect((await lineageRes).ok()).toBeTruthy();
    await dismissLineageMapOnboarding(page);

    // Verify PNG export
    await verifyExportLineagePNG(page, true);

    await page.getByTestId('lineage-layer-btn').click();

    const domainButton = page.getByTestId('lineage-layer-lens-domain');
    await expect(domainButton).not.toHaveAttribute('data-selected');

    const domainRes = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'domain'
    );
    await domainButton.click();
    expect((await domainRes).ok()).toBeTruthy();

    await page.getByTestId('lineage-layer-btn').click();
    const dataProductRes = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'dataProduct'
    );
    await page.getByTestId('lineage-layer-lens-dataProduct').click();
    expect((await dataProductRes).ok()).toBeTruthy();
  });

  test('Settings depth change refetches platform lineage', async ({ page }) => {
    // Regression: on /lineage the settings modal used to write into local
    // page state instead of the shared Zustand store the fetch effect
    // listens to, so changing upstream/downstream depth silently produced
    // no network call. Assert the scene refetch fires with the new depths.
    await redirectToHomePage(page);
    const initialRes = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'service'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    expect((await initialRes).ok()).toBeTruthy();
    await dismissLineageMapOnboarding(page);

    await page.getByTestId('lineage-config').click();
    await page.getByTestId('field-upstream').waitFor({ state: 'visible' });
    await page.getByTestId('field-upstream').fill('2');
    await page.getByTestId('field-downstream').fill('2');

    const refetch = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname.endsWith('/api/v1/lineage/scene') &&
        url.searchParams.get('upstreamDepth') === '2' &&
        url.searchParams.get('downstreamDepth') === '2'
      );
    });

    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    expect((await refetch).ok()).toBeTruthy();
  });
});
