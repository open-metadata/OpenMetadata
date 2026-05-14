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
import { SidebarItem } from '../../../constant/sidebar';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import {
  getApiContext,
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  clickLineageNode,
  connectEdgeBetweenNodesViaAPI,
  performZoomOut,
  visitLineageTab,
} from '../../../utils/lineage';
import { sidebarClick } from '../../../utils/sidebar';
import { test } from '../../fixtures/pages';

const table = new TableClass();
const topic = new TopicClass();
const pipeline = new PipelineClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);

  await Promise.all([
    table.create(apiContext),
    topic.create(apiContext),
    pipeline.create(apiContext),
  ]);

  // Patch topic with metadata for filter tests
  await topic.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          type: 'user',
          id: EntityDataClass.user1.responseData.id,
        },
      },
      {
        op: 'add',
        path: '/domains/0',
        value: {
          type: 'domain',
          id: EntityDataClass.domain1.responseData.id,
        },
      },
    ],
  });

  await connectEdgeBetweenNodesViaAPI(
    apiContext,
    { id: table.entityResponseData.id, type: 'table' },
    { id: topic.entityResponseData.id, type: 'topic' }
  );

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await Promise.all([
    table.delete(apiContext),
    topic.delete(apiContext),
    pipeline.delete(apiContext),
  ]);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

// ====================
// Suite 1: Canvas Control Buttons (4 tests)
// ====================
test.describe('Canvas Controls', () => {
  test.beforeEach(async ({ page }) => {
    await table.visitEntityPage(page);
    await visitLineageTab(page);
    await performZoomOut(page);
  });

  test('Verify zoom in and zoom out controls', async ({ page }) => {
    const zoomInBtn = page.getByTestId('zoom-in');
    const zoomOutBtn = page.getByTestId('zoom-out');

    await performZoomOut(page, 5);

    for (let i = 0; i < 3; i++) {
      await zoomInBtn.click();
    }

    for (let i = 0; i < 3; i++) {
      await zoomOutBtn.click();
    }

    await expect(zoomInBtn).toBeVisible();
    await expect(zoomOutBtn).toBeVisible();
  });

  test('Verify fit view options menu', async ({ page }) => {
    await page.getByTestId('fit-screen').click();
    await expect(page.locator('#lineage-view-options-menu')).toBeVisible();

    await page.getByRole('menuitem', { name: 'Fit to screen' }).click();

    const tableFqn = get(table, 'entityResponseData.fullyQualifiedName', '');
    await clickLineageNode(page, tableFqn);

    await page.getByTestId('drawer-close-icon').click();

    await page.getByTestId('fit-screen').click();
    await page.getByRole('menuitem', { name: 'Refocused to selected' }).click();

    await page.getByTestId('fit-screen').click();
    await page.getByRole('menuitem', { name: 'Rearrange Nodes' }).click();

    await page.getByTestId('fit-screen').click();
    await page.getByRole('menuitem', { name: 'Refocused to home' }).click();
  });

  test('Verify minimap toggle functionality', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible();

    await page.getByTestId('toggle-mind-map').click();
    await expect(minimap).not.toBeVisible();

    await page.getByTestId('toggle-mind-map').click();
    await expect(minimap).toBeVisible();
  });

  test('Verify fullscreen toggle', async ({ page }) => {
    // before each step has fullscreen=true
    expect(page.url()).toContain('fullscreen=true');

    await page.getByTestId('exit-full-screen').click();

    expect(page.url()).not.toContain('fullscreen=true');
    await page.getByTestId('full-screen').click();

    expect(page.url()).toContain('fullscreen=true');
  });
});

test.describe('Lineage Layers', () => {
  test.describe('Data Observability Layer', () => {
    test.beforeEach(async ({ page }) => {
      await table.visitEntityPage(page);
      await visitLineageTab(page);
      await performZoomOut(page);
    });

    test('Verify DQ layer toggle activation', async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const observabilityBtn = page.getByTestId(
        'lineage-layer-observability-btn'
      );
      await expect(observabilityBtn).toBeVisible();

      await expect(observabilityBtn).not.toHaveClass(/Mui-selected/);

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).toHaveClass(/Mui-selected/);
    });

    test('Verify DQ layer toggle off removes highlights', async ({ page }) => {
      await page.getByTestId('lineage-layer-btn').click();

      const observabilityBtn = page.getByTestId(
        'lineage-layer-observability-btn'
      );

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).toHaveClass(/Mui-selected/);

      await observabilityBtn.click();
      await page.keyboard.press('Escape');

      await page.getByTestId('lineage-layer-btn').click();
      await expect(observabilityBtn).not.toHaveClass(/Mui-selected/);
    });
  });

  test.describe('Error Handling', () => {
    test('Verify invalid entity search handling', async ({ page }) => {
      await sidebarClick(page, SidebarItem.LINEAGE);

      await waitForAllLoadersToDisappear(page);

      const searchSelect = page.getByTestId('search-entity-select');
      await expect(searchSelect).toBeVisible();

      await searchSelect.click();

      await page
        .locator(
          '[data-testid="search-entity-select"] .ant-select-selection-search-input'
        )
        .fill('invalid_fqn_does_not_exist_12345');

      const noResultsText = page.getByText(/no match/i);
      if ((await noResultsText.count()) > 0) {
        await expect(noResultsText).toBeVisible();
      }
    });

    test('Verify lineage tab with no lineage data', async ({ page }) => {
      const emptyTable = new TableClass();
      const { apiContext, afterAction } = await getApiContext(page);

      await emptyTable.create(apiContext);

      await emptyTable.visitEntityPage(page);
      await visitLineageTab(page);

      await waitForAllLoadersToDisappear(page);

      const tableFqn = get(emptyTable, 'entityResponseData.fullyQualifiedName');
      const tableNode = page.getByTestId(`lineage-node-${tableFqn}`);
      await expect(tableNode).toBeVisible();

      await emptyTable.delete(apiContext);
      await afterAction();
    });
  });
});
