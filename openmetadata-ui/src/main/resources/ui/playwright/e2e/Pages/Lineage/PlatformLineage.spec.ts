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
import { escapeRegExp, get } from 'lodash';
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
  connectEdgeBetweenNodesViaAPI,
  dismissLineageMapOnboarding,
  expectLineageNodeVisible,
  performZoomOut,
  verifyExportLineagePNG,
  visitLineageTab,
} from '../../../utils/lineage';
import { waitForAggregation } from '../../../utils/searchAggregation';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';

// On an asset's Lineage tab a platform view swaps the graph for the lineage
// of the asset's service or domain, fetched by that container's FQN.
const waitForPlatformViewLineage = (page: Page, fqn: string) =>
  page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/getLineage') &&
      new URL(response.url()).searchParams.get('fqn') === fqn
  );

// Create a table with '/' in the name to test encoding functionality.
// Its database is owned rather than the shard's shared one: the database
// lineage scene draws every table and edge other specs put under the shared
// database, and there the scene request failed or this table's schema node
// never rendered.
const WIDE_SERVICE_FQN = 'pw_wide_svc';
const tableNameWithSlash = `pw-table-with/slash-${uuid()}`;
const table = new TableClass({
  name: tableNameWithSlash,
  database: new DatabaseClass(),
});
// A focused table with no lineage is an empty scene, so the zoom tests need a
// real edge to land on a card.
const upstreamTable = new TableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await table.create(apiContext);
  await upstreamTable.create(apiContext);
  await connectEdgeBetweenNodesViaAPI(
    apiContext,
    { id: upstreamTable.entityResponseData.id, type: 'table' },
    { id: table.entityResponseData.id, type: 'table' }
  );

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
  await upstreamTable.delete(apiContext);
  await table.delete(apiContext);
  await afterAction();
});

test.describe('Entity Lineage tab', () => {
  test.beforeEach(async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);
  });

  test('A quick filter set on the Lineage tab does not reach the map', async ({
    page,
  }) => {
    // Regression: the tab resets its quick filters only after the map's first
    // render, and the map's first request still carried the tab's filter.
    const serviceName = get(table, 'entityResponseData.service.name', '');
    await page.locator('[aria-label="Filters"]').click();
    await page.getByTestId('search-dropdown-Service').click();
    const menu = page.getByTestId('drop-down-menu');
    await waitForAllLoadersToDisappear(menu);
    const searchResponse = waitForAggregation(page, {
      field: 'service.displayName.keyword',
      value: serviceName,
    });
    await menu.getByTestId('search-input').fill(serviceName);
    await searchResponse;
    await menu.getByText(serviceName).click();
    await page.getByTestId('update-btn').click();
    await expect(page.getByTestId('update-btn')).toBeHidden();

    const sceneFilters: Array<string | null> = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/api/v1/lineage/scene')) {
        sceneFilters.push(url.searchParams.get('query_filter'));
      }
    });
    await sidebarClick(page, SidebarItem.LINEAGE);
    await dismissLineageMapOnboarding(page);
    await expect(page.getByTestId('lineage-map-canvas')).toBeVisible();

    // The map's own request and its adjacent-band prefetch.
    await expect.poll(() => sceneFilters.length).toBeGreaterThanOrEqual(2);

    expect(sceneFilters.filter(Boolean)).toEqual([]);
  });

  test(
    'Verify table search with special characters as handled',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await redirectToHomePage(page);
      const db = table.databaseResponseData.name;

      await sidebarClick(page, SidebarItem.LINEAGE);
      // The asset Lineage tab no longer shows the map onboarding, so this is
      // the first visit that does.
      await dismissLineageMapOnboarding(page);

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

      // The tab title names the entity the page is centred on.
      const tableName =
        table.entityResponseData.displayName ?? table.entityResponseData.name;
      await expect(page).toHaveTitle(
        new RegExp(`^${escapeRegExp(`${tableName} Lineage`)} \\|`)
      );

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

      const serviceBtn = page.getByTestId('lineage-layer-service-btn');
      await expect(serviceBtn).not.toHaveAttribute('data-selected');

      const serviceLineage = waitForPlatformViewLineage(
        page,
        get(table, 'entityResponseData.service.fullyQualifiedName', '')
      );
      await serviceBtn.click();
      expect((await serviceLineage).ok()).toBeTruthy();
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

      const domainLineage = waitForPlatformViewLineage(
        page,
        EntityDataClass.domain1.responseData.fullyQualifiedName ?? ''
      );
      await domainBtn.click();
      expect((await domainLineage).ok()).toBeTruthy();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(domainBtn).toHaveAttribute('data-selected');
    }
  );

  test(
    'Verify platform view switching',
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const serviceBtn = page.getByTestId('lineage-layer-service-btn');
      const domainBtn = page.getByTestId('lineage-layer-domain-btn');

      const serviceLineage = waitForPlatformViewLineage(
        page,
        get(table, 'entityResponseData.service.fullyQualifiedName', '')
      );
      await serviceBtn.click();
      expect((await serviceLineage).ok()).toBeTruthy();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(serviceBtn).toHaveAttribute('data-selected');
      await expect(domainBtn).not.toHaveAttribute('data-selected');

      // The platform views are exclusive: picking Domain replaces Service.
      const domainLineage = waitForPlatformViewLineage(
        page,
        EntityDataClass.domain1.responseData.fullyQualifiedName ?? ''
      );
      await domainBtn.click();
      expect((await domainLineage).ok()).toBeTruthy();
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

    const pageHeading = page
      .getByTestId('page-header-container')
      .getByTestId('heading');
    await expect(pageHeading).toHaveText('Service Lineage');

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
    await expect(pageHeading).toHaveText('Domain Lineage');

    await page.getByTestId('lineage-layer-btn').click();
    const dataProductRes = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'dataProduct'
    );
    await page.getByTestId('lineage-layer-lens-dataProduct').click();
    expect((await dataProductRes).ok()).toBeTruthy();
    await expect(pageHeading).toHaveText('Data Product Lineage');
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
    const upstreamField = page.getByTestId('field-upstream');
    await upstreamField.waitFor({ state: 'visible' });
    // The global lineage settings are shared with other specs, so the depth
    // may already be 2; an unchanged depth fetches nothing.
    const depth = (await upstreamField.inputValue()) === '2' ? '3' : '2';
    await upstreamField.fill(depth);
    await page.getByTestId('field-downstream').fill(depth);

    const refetch = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        url.pathname.endsWith('/api/v1/lineage/scene') &&
        url.searchParams.get('upstreamDepth') === depth &&
        url.searchParams.get('downstreamDepth') === depth
      );
    });

    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Ok', exact: true })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    expect((await refetch).ok()).toBeTruthy();
  });

  test('An empty scene shows the placeholder inside the canvas, below the toolbar', async ({
    page,
  }) => {
    // #35783: the empty state escaped the canvas and drew a narrow column
    // over the toolbar.
    // Answer without route.fetch(): the map prefetches adjacent bands, and a
    // fetch still in flight when the test ends throws "page has been closed",
    // failing a test whose assertions all passed.
    await page.route('**/api/v1/lineage/scene?*', (route) => {
      const params = new URL(route.request().url()).searchParams;

      return route.fulfill({
        json: {
          lens: params.get('lens'),
          band: params.get('band'),
          nodes: [],
          edges: [],
          breadcrumb: [],
          hiddenNodeCount: 0,
          sampled: false,
        },
      });
    });
    await redirectToHomePage(page);
    const sceneRes = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene')
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    await sceneRes;

    const placeholder = page.getByTestId('empty-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('No lineage data available');
    // A first visit can land on an empty scene; the map's introduction still
    // opens there.
    await dismissLineageMapOnboarding(page);

    const canvas = await page.getByTestId('lineage-container').boundingBox();
    const box = await placeholder.boundingBox();
    expect(canvas).not.toBeNull();
    expect(box).not.toBeNull();
    if (canvas && box) {
      expect(box.y).toBeGreaterThanOrEqual(canvas.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(
        canvas.y + canvas.height + 1
      );
      expect(box.width).toBeGreaterThan(canvas.width * 0.9);
    }
  });

  test('A domain opens as its own card on the Domain lens, and clearing the search returns to all domains', async ({
    page,
  }) => {
    // Regression: a domain opened on its Data Assets instead of as its own
    // card (2.0 behaviour), and clearing the search did nothing.
    const domainFqn = EntityDataClass.domain1.responseData.fullyQualifiedName;
    const domainScene = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('focusFqn') === domainFqn
    );
    await redirectToHomePage(page);
    await page.goto(`/lineage/domain/${encodeURIComponent(domainFqn)}`);
    const sceneRequest = new URL((await domainScene).url()).searchParams;
    await dismissLineageMapOnboarding(page);

    expect(sceneRequest.get('lens')).toBe('domain');
    expect(sceneRequest.get('band')).toBe('LAYER');
    await expect(
      page.getByTestId('page-header-container').getByTestId('heading')
    ).toHaveText('Domain Lineage');
    await expect(page.getByTestId(`lineage-node-${domainFqn}`)).toBeVisible();

    await page.getByTestId('clear-lineage-search').click();

    await expect(page).toHaveURL(/\/lineage\?lineageLens=domain$/);
    await expect(page.getByTestId('clear-lineage-search')).toHaveCount(0);
  });

  test('Switching lens from a domain opens the new lens root, not the domain', async ({
    page,
  }) => {
    // Regression: the Data Product lens kept the domain as its focus, and the
    // search still named the domain.
    const domainFqn = EntityDataClass.domain1.responseData.fullyQualifiedName;
    await redirectToHomePage(page);
    await page.goto(`/lineage/domain/${encodeURIComponent(domainFqn)}`);
    await dismissLineageMapOnboarding(page);
    await expect(page.getByTestId(`lineage-node-${domainFqn}`)).toBeVisible();

    const dataProductScene = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(request.url()).searchParams.get('lens') === 'dataProduct'
    );
    await page.getByTestId('lineage-layer-btn').click();
    await page.getByTestId('lineage-layer-lens-dataProduct').click();
    const params = new URL((await dataProductScene).url()).searchParams;

    expect(params.get('focusFqn')).toBeNull();
    expect(params.get('band')).toBe('LAYER');
    await expect(
      page.getByTestId('page-header-container').getByTestId('heading')
    ).toHaveText('Data Product Lineage');
    await expect(
      page.getByTestId('search-entity-select').getByRole('combobox')
    ).toHaveAttribute('placeholder', 'Search data product to view lineage');
    await expect(page.getByTestId('clear-lineage-search')).toHaveCount(0);
  });

  test('A failed scene request offers a reload that refetches', async ({
    page,
  }) => {
    await page.route('**/api/v1/lineage/scene?*', (route) =>
      route.fulfill({ status: 500, json: { message: 'Scene unavailable' } })
    );
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.LINEAGE);

    const placeholder = page.getByTestId('empty-placeholder');
    await expect(placeholder).toContainText('Something went wrong');
    const retry = placeholder.getByRole('button', { name: 'Reload' });
    await expect(retry).toBeVisible();

    const refetch = page.waitForRequest((request) =>
      new URL(request.url()).pathname.endsWith('/api/v1/lineage/scene')
    );
    await retry.click();
    await refetch;
  });

  test('A failed request after a scene is shown replaces it with a reload', async ({
    page,
  }) => {
    // Regression: the previous scene stayed on screen under the new lens, with
    // only a small error pill and no way to retry.
    await redirectToHomePage(page);
    const serviceScene = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/v1/lineage/scene') &&
        new URL(response.url()).searchParams.get('lens') === 'service'
    );
    await sidebarClick(page, SidebarItem.LINEAGE);
    expect((await serviceScene).ok()).toBeTruthy();
    await dismissLineageMapOnboarding(page);
    await expect(page.getByTestId('lineage-map-canvas')).toBeVisible();

    await page.route('**/api/v1/lineage/scene?*', (route) =>
      new URL(route.request().url()).searchParams.get('lens') === 'domain'
        ? route.fulfill({ status: 500, json: { message: 'Scene unavailable' } })
        : route.fallback()
    );
    await page.getByTestId('lineage-layer-btn').click();
    await page.getByTestId('lineage-layer-lens-domain').click();

    const placeholder = page.getByTestId('empty-placeholder');
    await expect(placeholder).toContainText('Something went wrong');
    await expect(
      placeholder.getByRole('button', { name: 'Reload' })
    ).toBeVisible();
    await expect(page.getByTestId('lineage-map-canvas')).toHaveCount(0);
  });

  test('Zooming in quickly past the maximum zoom still drills into the card', async ({
    page,
  }) => {
    // Regression: wheel events keep arriving after the zoom reaches its maximum,
    // and each one cancelled the pending drill without starting it again, so a
    // fast zoom-in stopped at the maximum and never opened the next level.
    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName', '');
    await redirectToHomePage(page);
    await page.goto(
      `/lineage?lineageLens=service&lineageBand=ASSET&lineageFocus=${encodeURIComponent(
        tableFqn
      )}&lineageEntityType=table`
    );
    await dismissLineageMapOnboarding(page);

    const card = page.getByTestId(`lineage-node-${tableFqn}`);
    await expect(card).toBeVisible();
    await expect(page.getByTestId('loader')).toHaveCount(0);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- the map ignores semantic zoom for 1.2s after it fits a scene, with no DOM signal
    await page.waitForTimeout(1500);

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2
    );
    // Far more steps than the maximum zoom needs, sent without pausing, the
    // way a fast wheel or trackpad does.
    for (let step = 0; step < 40; step++) {
      await page.mouse.wheel(0, -100);
    }

    await expect(page).toHaveURL(/lineageBand=FIELD/);
  });

  // A service whose databases form a chain far too wide to fit: a Layer scene
  // that big lands at the minimum zoom, and the only way out by zooming out is
  // the min-zoom gesture, never the "graph fills under a third" rule.
  const routeWideServiceScene = (page: Page) =>
    page.route('**/api/v1/lineage/scene?*', (route) => {
      const params = new URL(route.request().url()).searchParams;
      const isService = params.get('focusFqn') === WIDE_SERVICE_FQN;
      const crumb = (
        label: string,
        fullyQualifiedName?: string,
        entityType?: string
      ) => ({
        id: `service-${label}`,
        label,
        levelKind: 'service',
        band: 'LAYER',
        fullyQualifiedName,
        entityType,
      });

      return route.fulfill({
        json: {
          lens: 'service',
          band: 'LAYER',
          focusFqn: params.get('focusFqn') ?? undefined,
          focusEntityType: params.get('entityType') ?? undefined,
          nodes: isService
            ? Array.from({ length: 150 }, (_, index) => ({
                id: `pw-wide-${index}`,
                label: `pw_wide_${index}`,
                levelKind: 'database',
                band: 'LAYER',
                fullyQualifiedName: `${WIDE_SERVICE_FQN}.pw_wide_${index}`,
                entityType: 'database',
              }))
            : [],
          edges: isService
            ? Array.from({ length: 149 }, (_, index) => ({
                id: `pw-wide-edge-${index}`,
                from: `pw-wide-${index}`,
                to: `pw-wide-${index + 1}`,
                weight: 1,
              }))
            : [],
          breadcrumb: isService
            ? [
                crumb('service'),
                crumb(WIDE_SERVICE_FQN, WIDE_SERVICE_FQN, 'databaseService'),
              ]
            : [crumb('service')],
          hiddenNodeCount: 0,
          sampled: false,
        },
      });
    });

  const openWideServiceAtMinimumZoom = async (page: Page) => {
    await routeWideServiceScene(page);
    await redirectToHomePage(page);
    await page.goto(
      `/lineage?lineageLens=service&lineageBand=LAYER&lineageFocus=${WIDE_SERVICE_FQN}&lineageEntityType=databaseService`
    );
    await dismissLineageMapOnboarding(page);
    await expect(page.getByTestId('lineage-map-canvas')).toBeVisible();
    await expect(page.getByTestId('zoom-level')).toHaveText('10%');
    await expect(page).toHaveURL(/lineageFocus=/);
  };

  test('The zoom-out button at the minimum zoom goes up to the parent level', async ({
    page,
  }) => {
    await openWideServiceAtMinimumZoom(page);

    // The retry also outlasts the map ignoring semantic zoom right after a fit.
    await expect(async () => {
      await page.getByTestId('zoom-out').click();

      await expect(page).not.toHaveURL(/lineageFocus=/, { timeout: 1000 });
    }).toPass({ timeout: 30_000 });
  });

  test('A wheel step down over the canvas at the minimum zoom goes up to the parent level', async ({
    page,
  }) => {
    await openWideServiceAtMinimumZoom(page);
    const pane = await page.locator('.react-flow__pane').boundingBox();
    expect(pane).not.toBeNull();
    await page.mouse.move(
      (pane?.x ?? 0) + (pane?.width ?? 0) / 2,
      (pane?.y ?? 0) + (pane?.height ?? 0) / 2
    );

    await expect(async () => {
      await page.mouse.wheel(0, 100);

      await expect(page).not.toHaveURL(/lineageFocus=/, { timeout: 1000 });
    }).toPass({ timeout: 30_000 });
  });
});
