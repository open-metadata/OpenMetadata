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
        value: {
          type: 'domain',
          id: EntityDataClass.domain1.responseData.id,
        },
        path: '/domains/0',
      },
    ],
  });

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await table.visitEntityPage(page);
  await visitLineageTab(page);
  await performZoomOut(page);
});

test('Verify table search with special characters as handled', async ({
  page,
}) => {
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
  await page
    .locator(`[data-testid="node-suggestion-${nodeFqn}"]`)
    .dispatchEvent('click');

  await page.waitForResponse('/api/v1/lineage/getLineage?*');

  await expect(page.locator('[data-testid="lineage-details"]')).toBeVisible();

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
  await page.getByTestId(`node-suggestion-${dbFqn}`).dispatchEvent('click');
  await page.waitForResponse('/api/v1/lineage/getLineage?*');

  await expect(page.getByTestId('lineage-details')).toBeVisible();

  await clickLineageNode(page, dbFqn);

  await expect(
    page.locator('.lineage-entity-panel').getByTestId('entity-header-title')
  ).toBeVisible();
});

test('Verify service platform view', async ({ page }) => {
  await page.getByTestId('lineage-layer-btn').click();

  const serviceBtn = page.getByTestId('lineage-layer-service-btn');
  await expect(serviceBtn).toBeVisible();

  await serviceBtn.click();
  await page.keyboard.press('Escape');

  await page.getByTestId('lineage-layer-btn').click();
  await expect(serviceBtn).toHaveClass(/Mui-selected/);
});

test('Verify domain platform view', async ({ page }) => {
  await page.getByTestId('lineage-layer-btn').click();

  const domainBtn = page.getByTestId('lineage-layer-domain-btn');
  await expect(domainBtn).toBeVisible();

  await domainBtn.click();
  await page.keyboard.press('Escape');

  await page.getByTestId('lineage-layer-btn').click();
  await expect(domainBtn).toHaveClass(/Mui-selected/);

  await page.keyboard.press('Escape');

  await waitForAllLoadersToDisappear(page);
});

test('Verify platform view switching', async ({ page }) => {
  await page.getByTestId('lineage-layer-btn').click();

  const serviceBtn = page.getByTestId('lineage-layer-service-btn');
  const domainBtn = page.getByTestId('lineage-layer-domain-btn');

  await serviceBtn.click();
  await page.keyboard.press('Escape');

  await page.getByTestId('lineage-layer-btn').click();
  await expect(serviceBtn).toHaveClass(/Mui-selected/);
  await expect(domainBtn).not.toHaveClass(/Mui-selected/);

  await domainBtn.click();
  await page.keyboard.press('Escape');

  await page.getByTestId('lineage-layer-btn').click();
  await expect(domainBtn).toHaveClass(/Mui-selected/);
  await expect(serviceBtn).not.toHaveClass(/Mui-selected/);
});
