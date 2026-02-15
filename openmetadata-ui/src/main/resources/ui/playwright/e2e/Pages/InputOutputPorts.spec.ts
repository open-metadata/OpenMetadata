/*
 *  Copyright 2025 Collate.
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

import base, { expect, Page } from '@playwright/test';
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { AssetReference, DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification
} from '../../utils/common';
import {
  addInputPortToDataProduct,
  addOutputPortToDataProduct,
  expandLineageSection,
  navigateToPortsTab,
  selectDataProduct,
  verifyPortCounts,
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

const createAssetRef = (
  entity: TableClass | TopicClass | DashboardClass,
  type: string
): AssetReference => ({
  id: entity.entityResponseData.id,
  type,
  name: entity.entityResponseData.name,
  displayName: entity.entityResponseData.displayName,
  fullyQualifiedName: entity.entityResponseData.fullyQualifiedName,
  description: entity.entityResponseData.description,
});

const domain = new Domain();

const test = base.extend<{
  page: Page;
}>({
  page: async ({ browser }, setPage) => {
    const { page } = await performAdminLogin(browser);
    await setPage(page);
    await page.close();
  },
});

test.describe('Input Output Ports', () => {

  const tables: TableClass[] = [];
  const topics: TopicClass[] = [];
  const dashboards: DashboardClass[] = [];

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext } = await performAdminLogin(browser);

    await domain.create(apiContext);

    for (let i = 0; i < 5; i++) {
      const table = new TableClass();
      await table.create(apiContext);
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: domain.responseData.id, type: 'domain' },
          },
        ],
      });
      tables.push(table);
    }

    for (let i = 0; i < 2; i++) {
      const topic = new TopicClass();
      await topic.create(apiContext);
      await topic.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: domain.responseData.id, type: 'domain' },
          },
        ],
      });
      topics.push(topic);
    }

    for (let i = 0; i < 2; i++) {
      const dashboard = new DashboardClass();
      await dashboard.create(apiContext);
      await dashboard.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: { id: domain.responseData.id, type: 'domain' },
          },
        ],
      });
      dashboards.push(dashboard);
    }
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });


  test.describe('Section 1: Tab Initialization & Empty States', () => {
    test('Input port button visible, output port button hidden when no assets', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);
      await test.step('Create data product via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

      });

      await test.step('Navigate to data product ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify button states', async () => {
        // Input port button should be visible in empty state (can add from any asset in system)
        await expect(page.getByTestId('add-input-port-button')).toBeVisible();
        await expect(page.getByTestId('add-input-port-button')).toBeEnabled();
        // Output port button should NOT be visible (requires data product assets first)
        await expect(page.getByTestId('add-output-port-button')).not.toBeVisible();
      });
    });

    test('Tab renders with empty state when no ports exist', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with assets via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to data product', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Navigate to ports tab', async () => {
        await navigateToPortsTab(page);
      });

      await test.step('Verify empty states', async () => {
        await expect(
          page.getByTestId('input-output-ports-tab')
        ).toBeVisible();

        await expect(
          page.getByTestId('no-input-ports-placeholder')
        ).toBeVisible();
        await expect(
          page.getByTestId('no-output-ports-placeholder')
        ).toBeVisible();

        await expect(page.getByTestId('add-input-port-button')).toBeVisible();
        await expect(page.getByTestId('add-output-port-button')).toBeVisible();
        await expect(page.getByTestId('add-input-port-button')).toBeEnabled();
        await expect(page.getByTestId('add-output-port-button')).toBeEnabled();
      });

      await test.step('Verify lineage section shows zero counts', async () => {
        await expect(
          page.locator('text=0 input').first()
        ).toBeVisible();
        await expect(
          page.locator('text=0 output').first()
        ).toBeVisible();
      });
    });

    test('Tab displays correct port counts', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
          createAssetRef(topics[0], 'topic'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          {
            id: tables[0].entityResponseData.id,
            type: 'table',
          },
          {
            id: tables[1].entityResponseData.id,
            type: 'table',
          },
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          {
            id: dashboards[0].entityResponseData.id,
            type: 'dashboard',
          },
          {
            id: dashboards[1].entityResponseData.id,
            type: 'dashboard',
          },
          {
            id: topics[0].entityResponseData.id,
            type: 'topic',
          },
        ]);


      });

      await test.step('Navigate to data product ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify port counts', async () => {
        await expect(page.locator('text=(2)').first()).toBeVisible();
        await expect(page.locator('text=(3)').first()).toBeVisible();

        await expect(page.locator('text=2 input').first()).toBeVisible();
        await expect(page.locator('text=3 output').first()).toBeVisible();
      }); 
    });

    test('Lineage section is collapsed by default', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

      });

      await test.step('Navigate to data product', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify lineage is collapsed', async () => {
        await expect(
          page.getByTestId('toggle-lineage-collapse')
        ).toBeVisible();
        await expect(page.getByTestId('ports-lineage-view')).not.toBeVisible();
      });
    });
  });

  test.describe('Section 2: Adding Ports', () => {
    test('Add single input port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Add input port', async () => {
        await addInputPortToDataProduct(page, tables[0]);
      });

      await test.step('Verify port was added', async () => {
        await expect(page.locator('text=(1)').first()).toBeVisible();
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
      });
    });

    test('Add single output port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Add output port', async () => {
        await addOutputPortToDataProduct(page, dashboards[0]);
      });

      await test.step('Verify port was added', async () => {
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
      });

    
    });

    test('Add multiple input ports at once', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Add multiple input ports', async () => {
        await page.getByTestId('add-input-port-button').click();

        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          state: 'visible',
        });

        await waitForAllLoadersToDisappear(page);

        const table1Name = get(tables[0], 'entityResponseData.name');
        const table1Fqn = get(tables[0], 'entityResponseData.fullyQualifiedName');
        const table2Name = get(tables[1], 'entityResponseData.name');
        const table2Fqn = get(tables[1], 'entityResponseData.fullyQualifiedName');

        const searchBar = page
          .getByTestId('asset-selection-modal')
          .getByTestId('searchbar');

        const searchRes1 = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.request().method() === 'GET'
        );
        await searchBar.fill(table1Name);
        await searchRes1;

        await page.locator(`[data-testid="table-data-card_${table1Fqn}"] input`).check();

        const searchRes2 = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.request().method() === 'GET'
        );
        await searchBar.fill(table2Name);
        await searchRes2;

        await page.locator(`[data-testid="table-data-card_${table2Fqn}"] input`).check();

        const addRes = page.waitForResponse(
          (res) => res.url().includes('/inputPorts/add') && res.request().method() === 'PUT'
        );
        await page.getByTestId('save-btn').click();
        await addRes;
      });

      await test.step('Verify both ports were added', async () => {
        await expect(page.locator('text=(2)').first()).toBeVisible();
      });
    });

    test('Add different entity types as ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[2], 'table'),
          createAssetRef(topics[1], 'topic'),
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Add table as input port', async () => {
        await addInputPortToDataProduct(page, tables[2]);
      });

      await test.step('Add topic as input port', async () => {
        await addInputPortToDataProduct(page, topics[1]);
      });

      await test.step('Add dashboard as output port', async () => {
        await addOutputPortToDataProduct(page, dashboards[0]);
      });

      await test.step('Verify different entity types are shown', async () => {
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
      });

    
    });

    test('Cancel adding port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[3], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open and cancel input port drawer', async () => {
        await page.getByTestId('add-input-port-button').click();
        await expect(
          page.getByTestId('asset-selection-modal')
        ).toBeVisible();
        await page.getByTestId('cancel-btn').click();
        await expect(
          page.getByTestId('asset-selection-modal')
        ).not.toBeVisible();
      });

      await test.step('Verify empty state still shown', async () => {
        await expect(
          page.getByTestId('no-input-ports-placeholder')
        ).toBeVisible();
      });


    });

    test('Input port drawer shows assets from outside data product', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ONE asset', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open input port drawer and verify unfiltered assets', async () => {
        await page.getByTestId('add-input-port-button').click();
        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          state: 'visible',
        });

        await waitForAllLoadersToDisappear(page);

        // Search for an asset NOT in the data product (tables[1])
        const searchBar = page
          .getByTestId('asset-selection-modal')
          .getByTestId('searchbar');
        const table2Name = get(tables[1], 'entityResponseData.name');

        const searchRes = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.request().method() === 'GET'
        );
        await searchBar.fill(table2Name);
        await searchRes;

        // Asset should be visible even though it's not in the data product
        const table2Fqn = get(tables[1], 'entityResponseData.fullyQualifiedName');
        await expect(
          page.locator(`[data-testid="table-data-card_${table2Fqn}"]`)
        ).toBeVisible();
      });
    });

    test('Add input port from asset not in data product', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product WITHOUT any assets', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);
        // Note: NOT adding any assets to data product
      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Add input port from external asset', async () => {
        // tables[0] is NOT a data product asset, but should still be addable as input port
        await addInputPortToDataProduct(page, tables[0]);
      });

      await test.step('Verify port was added', async () => {
        await expect(page.locator('text=(1)').first()).toBeVisible();
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
      });
    });

    test('Output port drawer shows info banner about data product assets', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with assets', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open output port drawer and verify info banner', async () => {
        await page.getByTestId('add-output-port-button').click();
        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          state: 'visible',
        });

        // Verify info banner is visible with correct message
        await expect(page.locator('.ant-alert-info')).toBeVisible();
        await expect(
          page.locator(
            'text=Output ports can only be added from assets that belong to this Data Product'
          )
        ).toBeVisible();
      });
    });

    test('Input port drawer does not show info banner', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);
      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open input port drawer and verify no info banner', async () => {
        await page.getByTestId('add-input-port-button').click();
        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          state: 'visible',
        });

        // Info banner should NOT be visible for input ports
        await expect(page.locator('.ant-alert-info')).not.toBeVisible();
      });
    });

    test('Output port drawer only shows data product assets', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with specific assets', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);
        // Only add tables[0] as data product asset
        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open output port drawer and verify filtering', async () => {
        await page.getByTestId('add-output-port-button').click();
        await page.waitForSelector('[data-testid="asset-selection-modal"]', {
          state: 'visible',
        });

        await waitForAllLoadersToDisappear(page);

        // Search for asset NOT in data product - should not appear
        const searchBar = page
          .getByTestId('asset-selection-modal')
          .getByTestId('searchbar');
        const table2Name = get(tables[1], 'entityResponseData.name');

        const searchRes = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/search/query') &&
            res.request().method() === 'GET'
        );
        await searchBar.fill(table2Name);
        await searchRes;

        // Asset should NOT be visible (filtered out)
        const table2Fqn = get(tables[1], 'entityResponseData.fullyQualifiedName');
        await expect(
          page.locator(`[data-testid="table-data-card_${table2Fqn}"]`)
        ).not.toBeVisible();
      });
    });
  });

  test.describe('Section 3: Port List Display', () => {
    test('Input ports list displays entity cards', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
          createAssetRef(tables[2], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
          createAssetRef(tables[2], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify input ports list', async () => {
        await expect(page.getByTestId('input-ports-list')).toBeVisible();

        const table1Name = get(tables[0], 'entityResponseData.name');
        const table2Name = get(tables[1], 'entityResponseData.name');
        const table3Name = get(tables[2], 'entityResponseData.name');

        await expect(page.locator(`text=${table1Name}`).first()).toBeVisible();
        await expect(page.locator(`text=${table2Name}`).first()).toBeVisible();
        await expect(page.locator(`text=${table3Name}`).first()).toBeVisible();
      });

    
    });

    test('Output ports list displays entity cards', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify output ports list', async () => {
        await expect(page.getByTestId('output-ports-list')).toBeVisible();

        const dashboard1Name = get(
          dashboards[0],
          'entityResponseData.displayName'
        );
        const dashboard2Name = get(
          dashboards[1],
          'entityResponseData.displayName'
        );

        await expect(
          page.locator(`text=${dashboard1Name}`).first()
        ).toBeVisible();
        await expect(
          page.locator(`text=${dashboard2Name}`).first()
        ).toBeVisible();
      });

    
    });

    test('Port action dropdown visible with EditAll permission', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify action dropdown is visible', async () => {
        const portId = tables[0].entityResponseData.id;
        await expect(
          page.getByTestId(`port-actions-${portId}`)
        ).toBeVisible();

        await page.getByTestId(`port-actions-${portId}`).click();
        await expect(
          page.getByRole('menuitem', { name: 'Remove' })
        ).toBeVisible();
      });

    
    });
  });

  test.describe('Section 4: Removing Ports', () => {
    test('Remove single input port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Remove first input port', async () => {
        const portId = tables[0].entityResponseData.id;

        await page.getByTestId(`port-actions-${portId}`).click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();

        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
          page.getByText('Are you sure you want to remove')
        ).toBeVisible();

        const removeRes = page.waitForResponse(
          (res) =>
            res.url().includes('/inputPorts/remove') &&
            res.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: 'Remove' }).click();
        await removeRes;
      });

      await test.step('Verify port was removed', async () => {
        await expect(page.locator('text=(1)').first()).toBeVisible();
      });

    
    });

    test('Remove single output port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Remove first output port', async () => {
        const portId = dashboards[0].entityResponseData.id;

        await page.getByTestId(`port-actions-${portId}`).click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();

        const removeRes = page.waitForResponse(
          (res) =>
            res.url().includes('/outputPorts/remove') &&
            res.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: 'Remove' }).click();
        await removeRes;
      });

      await test.step('Verify port was removed', async () => {
        await toastNotification(page, /deleted successfully/i);
      });

    
    });

    test('Cancel port removal', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input port via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Open and cancel removal dialog', async () => {
        const portId = tables[0].entityResponseData.id;

        await page.getByTestId(`port-actions-${portId}`).click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();

        await expect(page.getByRole('dialog')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel' }).click();

        await expect(page.getByRole('dialog')).not.toBeVisible();
      });

      await test.step('Verify port still exists', async () => {
        await expect(page.locator('text=(1)').first()).toBeVisible();
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
      });

    
    });

    test('Remove last port shows empty state', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with single input port via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Remove the only input port', async () => {
        const portId = tables[0].entityResponseData.id;

        await page.getByTestId(`port-actions-${portId}`).click();
        await page.getByRole('menuitem', { name: 'Remove' }).click();

        const removeRes = page.waitForResponse(
          (res) =>
            res.url().includes('/inputPorts/remove') &&
            res.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: 'Remove' }).click();
        await removeRes;
      });

      await test.step('Verify empty state appears', async () => {
        await toastNotification(page, /deleted successfully/i);
        await expect(
          page.getByTestId('no-input-ports-placeholder')
        ).toBeVisible();
        await expect(page.locator('text=(0)').first()).toBeVisible();
      });

    
    });
  });

  test.describe('Section 5: Lineage Visualization', () => {
    test('Lineage loads on expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(dashboards[0], 'dashboard'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Expand lineage section', async () => {
        await expandLineageSection(page);
      });

      await test.step('Verify lineage view is visible', async () => {
        await expect(page.getByTestId('ports-lineage-view')).toBeVisible();
      });

    
    });

    test('Lineage displays data product center node', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Verify data product node is visible', async () => {
        await expect(page.locator('text=Data Product').first()).toBeVisible();
        await expect(
          page.locator(`text=${dataProduct.data.displayName}`).first()
        ).toBeVisible();
      });

    
    });

    test('Lineage displays input and output ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input and output ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
          createAssetRef(dashboards[1], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Verify input port nodes are visible', async () => {
        const table1Name = get(tables[0], 'entityResponseData.name');
        const table2Name = get(tables[1], 'entityResponseData.name');

        await expect(page.locator(`text=${table1Name}`).first()).toBeVisible();
        await expect(page.locator(`text=${table2Name}`).first()).toBeVisible();
      });

      await test.step('Verify output port nodes are visible', async () => {
        const dashboard1Name = get(
          dashboards[0],
          'entityResponseData.displayName'
        );
        const dashboard2Name = get(
          dashboards[1],
          'entityResponseData.displayName'
        );

        await expect(
          page.locator(`text=${dashboard1Name}`).first()
        ).toBeVisible();
        await expect(
          page.locator(`text=${dashboard2Name}`).first()
        ).toBeVisible();
      });

    });

    test('Lineage with only input ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with only input ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Verify only input port is shown', async () => {
        await expect(page.getByTestId('ports-lineage-view')).toBeVisible();
        const tableName = get(tables[0], 'entityResponseData.name');
        await expect(page.locator(`text=${tableName}`).first()).toBeVisible();
      });

    });

    test('Lineage with only output ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with only output ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Verify only output port is shown', async () => {
        await expect(page.getByTestId('ports-lineage-view')).toBeVisible();
        const dashboardName = get(
          dashboards[0],
          'entityResponseData.displayName'
        );
        await expect(
          page.locator(`text=${dashboardName}`).first()
        ).toBeVisible();
      });
    });

    test('Lineage controls work', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Verify ReactFlow controls are visible', async () => {
        await expect(
          page.locator('.react-flow__controls')
        ).toBeVisible();
      });
    });
  });

  test.describe('Section 6: Collapse/Expand Behavior', () => {
    test('Lineage section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify initially collapsed', async () => {
        await expect(page.getByTestId('ports-lineage-view')).not.toBeVisible();
      });

      await test.step('Expand lineage', async () => {
        await expandLineageSection(page);
        await expect(page.getByTestId('ports-lineage-view')).toBeVisible();
      });

      await test.step('Collapse lineage', async () => {
        await page.getByTestId('toggle-lineage-collapse').click();
        await expect(page.getByTestId('ports-lineage-view')).not.toBeVisible();
      });
    });

    test('Input ports section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input port', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify initially expanded', async () => {
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
        await expect(page.getByTestId('add-input-port-button')).toBeVisible();
      });

      await test.step('Collapse input ports section', async () => {
        await page.getByTestId('toggle-input-ports-collapse').click();
        await expect(page.getByTestId('input-ports-list')).not.toBeVisible();
        await expect(
          page.getByTestId('add-input-port-button')
        ).not.toBeVisible();
      });

      await test.step('Expand input ports section', async () => {
        await page.getByTestId('toggle-input-ports-collapse').click();
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
        await expect(page.getByTestId('add-input-port-button')).toBeVisible();
      });
    });

    test('Output ports section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output port', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify initially expanded', async () => {
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
        await expect(page.getByTestId('add-output-port-button')).toBeVisible();
      });

      await test.step('Collapse output ports section', async () => {
        await page.getByTestId('toggle-output-ports-collapse').click();
        await expect(page.getByTestId('output-ports-list')).not.toBeVisible();
        await expect(
          page.getByTestId('add-output-port-button')
        ).not.toBeVisible();
      });

      await test.step('Expand output ports section', async () => {
        await page.getByTestId('toggle-output-ports-collapse').click();
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
        await expect(page.getByTestId('add-output-port-button')).toBeVisible();
      });
    });

    test('Multiple sections can be collapsed independently', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(dashboards[0], 'dashboard'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(dashboards[0], 'dashboard'),
        ]);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Collapse input ports only', async () => {
        await page.getByTestId('toggle-input-ports-collapse').click();
        await expect(page.getByTestId('input-ports-list')).not.toBeVisible();
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
      });

      await test.step('Expand lineage while keeping input collapsed', async () => {
        await expandLineageSection(page);
        await expect(page.getByTestId('ports-lineage-view')).toBeVisible();
        await expect(page.getByTestId('input-ports-list')).not.toBeVisible();
        await expect(page.getByTestId('output-ports-list')).toBeVisible();
      });

    
    });
  });

  test.describe('Section 7: Fullscreen Mode', () => {
    test('Toggle fullscreen mode', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Enter fullscreen mode', async () => {
        await page.getByTestId('toggle-fullscreen-btn').click();

        const lineageView = page.getByTestId('ports-lineage-view');
        await expect(lineageView).toHaveCSS('position', 'fixed');
      });

    
    });

    test('Exit fullscreen with button', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Enter and exit fullscreen mode', async () => {
        await page.getByTestId('toggle-fullscreen-btn').click();

        const lineageView = page.getByTestId('ports-lineage-view');
        await expect(lineageView).toHaveCSS('position', 'fixed');

        await page.getByTestId('toggle-fullscreen-btn').click();
        await expect(lineageView).toHaveCSS('position', 'relative');
      });

    
    });

    test('Exit fullscreen with Escape key', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Enter fullscreen and exit with Escape', async () => {
      await page.getByTestId('toggle-fullscreen-btn').click();

        const lineageView = page.getByTestId('ports-lineage-view');
        await expect(lineageView).toHaveCSS('position', 'fixed');

        await page.keyboard.press('Escape');
        await expect(lineageView).toHaveCSS('position', 'relative');
      });

    
    });

    test('Fullscreen lineage is interactive', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addInputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);


      });

      await test.step('Navigate and expand lineage', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await expandLineageSection(page);
      });

      await test.step('Enter fullscreen and verify controls', async () => {
        await page.getByTestId('toggle-fullscreen-btn').click();

        await expect(page.locator('.react-flow__controls')).toBeVisible();
      });

    
    });
  });

  test.describe('Section 8: Pagination', () => {
    test('Input ports list pagination', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with many input ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        const portAssets = tables.map((table) => createAssetRef(table, 'table'));

        await dataProduct.addAssets(apiContext, portAssets);
        await dataProduct.addInputPorts(apiContext, portAssets);


      });

      await test.step('Navigate to ports tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
      });

      await test.step('Verify ports list displays', async () => {
        await expect(page.getByTestId('input-ports-list')).toBeVisible();
      });


    });
  });

  test.describe('Section 9: Asset Removal Warning for Output Ports', () => {
    test('Warning shown when removing asset that is also an output port', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with asset as output port via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
      });

      await test.step('Navigate to data product assets tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        const assetsTab = page.getByTestId('assets');
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Delete asset and verify warning', async () => {
        const tableFqn = get(
          tables[0],
          'entityResponseData.fullyQualifiedName'
        );
        await page.getByTestId(`manage-button-${tableFqn}`).click();
        await page.getByTestId('delete-button').click();

        await expect(page.locator('.ant-alert-warning')).toBeVisible();
        await expect(
          page.locator(
            'text=This asset is also configured as an Output Port'
          )
        ).toBeVisible();
      });
    });

    test('No warning when removing asset that is NOT an output port', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with asset (not output port) via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(tables[1], 'table'),
        ]);
      });

      await test.step('Navigate to data product assets tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        const assetsTab = page.getByTestId('assets');
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Delete asset that is NOT an output port', async () => {
        const tableFqn = get(
          tables[0],
          'entityResponseData.fullyQualifiedName'
        );
        await page.getByTestId(`manage-button-${tableFqn}`).click();
        await page.getByTestId('delete-button').click();

        await expect(page.locator('.ant-alert-warning')).not.toBeVisible();
        await expect(
          page.getByText('Are you sure you want to remove')
        ).toBeVisible();
      });
    });

    test('Bulk delete shows warning listing only assets in output ports', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with mixed assets via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
          createAssetRef(tables[2], 'table'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);
      });

      await test.step('Navigate to data product assets tab', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        const assetsTab = page.getByTestId('assets');
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Select all assets and click bulk delete', async () => {
        await page.getByRole('checkbox', { name: 'Select All' }).click();

        await page.getByTestId('delete-all-button').click();

        await expect(page.locator('.ant-alert-warning')).toBeVisible();
        await expect(
          page.locator(
            'text=The following asset(s) are also configured as Output Ports'
          )
        ).toBeVisible();

        const table1Name = get(tables[0], 'entityResponseData.displayName');
        const table2Name = get(tables[1], 'entityResponseData.displayName');
        const table3Name = get(tables[2], 'entityResponseData.displayName');

        const warningAlert = page.locator('.ant-alert-warning');

        await expect(
          warningAlert.locator(`li:has-text("${table1Name}")`)
        ).toBeVisible();
        await expect(
          warningAlert.locator(`li:has-text("${table2Name}")`)
        ).toBeVisible();
        await expect(
          warningAlert.locator(`li:has-text("${table3Name}")`)
        ).not.toBeVisible();
      });
    });

    test('No warning when data product has no output ports', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with assets but no output ports', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
        ]);
      });

      await test.step('Navigate and delete asset', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        const assetsTab = page.getByTestId('assets');
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);

        const tableFqn = get(
          tables[0],
          'entityResponseData.fullyQualifiedName'
        );
        await page.getByTestId(`manage-button-${tableFqn}`).click();
        await page.getByTestId('delete-button').click();

        await expect(page.locator('.ant-alert-warning')).not.toBeVisible();
      });
    });

    test('Removing asset from data product also removes it from output ports', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with two assets as output ports via API', async () => {
        const { apiContext } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addAssets(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          createAssetRef(tables[0], 'table'),
          createAssetRef(tables[1], 'table'),
        ]);
      });

      await test.step('Navigate to data product and verify output ports', async () => {
        await sidebarClick(page, SidebarItem.DATA_PRODUCT);
        await selectDataProduct(page, dataProduct.data);
        await page.waitForLoadState('networkidle');
        await navigateToPortsTab(page);
        await verifyPortCounts(page, 0, 2);
      });

      await test.step('Go to assets tab and remove one asset', async () => {
        const assetsTab = page.getByTestId('assets');
        await assetsTab.click();
        await waitForAllLoadersToDisappear(page);

        const tableFqn = get(
          tables[0],
          'entityResponseData.fullyQualifiedName'
        );
        await page
          .locator(`[data-testid="table-data-card_${tableFqn}"] input`)
          .check();

        await page.getByTestId('delete-all-button').click();

        // Confirmation modal with output port warning should appear
        await expect(page.locator('.ant-alert-warning')).toBeVisible();

        const removeRes = page.waitForResponse(
          (res) =>
            res.url().includes('/assets/remove') &&
            res.request().method() === 'PUT'
        );
        await page.getByTestId('save-button').click();
        await removeRes;
      });

      await test.step('Verify output port was also removed', async () => {
        await navigateToPortsTab(page);
        await verifyPortCounts(page, 0, 1);
      });
    });
  });
});
