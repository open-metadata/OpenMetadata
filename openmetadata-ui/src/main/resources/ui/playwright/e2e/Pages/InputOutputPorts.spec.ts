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
import { DataProduct } from '../../support/domain/DataProduct';
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
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

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
    const { apiContext, afterAction } = await performAdminLogin(browser);

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

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const table of tables) {
      await table.delete(apiContext);
    }
    for (const topic of topics) {
      await topic.delete(apiContext);
    }
    for (const dashboard of dashboards) {
      await dashboard.delete(apiContext);
    }
    await domain.delete(apiContext);

    await afterAction();
  });

  test.describe('Section 1: Tab Initialization & Empty States', () => {
    test('Tab renders with empty state when no ports exist', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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
      });

      await test.step('Verify lineage section shows zero counts', async () => {
        await expect(
          page.locator('text=0 input').first()
        ).toBeVisible();
        await expect(
          page.locator('text=0 output').first()
        ).toBeVisible();
      });

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Tab displays correct port counts', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

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

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage section is collapsed by default', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 2: Adding Ports', () => {
    test('Add single input port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Add single output port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Add multiple input ports at once', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Add different entity types as ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Cancel adding port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Setup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);
        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 3: Port List Display', () => {
    test('Input ports list displays entity cards', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
          { id: tables[1].entityResponseData.id, type: 'table' },
          { id: tables[2].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Output ports list displays entity cards', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
          { id: dashboards[1].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Port action dropdown visible with EditAll permission', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 4: Removing Ports', () => {
    test('Remove single input port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
          { id: tables[1].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Remove single output port', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
          { id: dashboards[1].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Cancel port removal', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input port via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Remove last port shows empty state', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with single input port via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 5: Lineage Visualization', () => {
    test('Lineage loads on expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);
        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage displays data product center node', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage displays input and output ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input and output ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
          { id: tables[1].entityResponseData.id, type: 'table' },
        ]);

        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
          { id: dashboards[1].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage with only input ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with only input ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage with only output ports', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with only output ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Lineage controls work', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 6: Collapse/Expand Behavior', () => {
    test('Lineage section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Input ports section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with input port', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Output ports section collapse/expand', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with output port', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Multiple sections can be collapsed independently', async ({
      page,
    }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);
        await dataProduct.addOutputPorts(apiContext, [
          { id: dashboards[0].entityResponseData.id, type: 'dashboard' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 7: Fullscreen Mode', () => {
    test('Toggle fullscreen mode', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Exit fullscreen with button', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Exit fullscreen with Escape key', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });

    test('Fullscreen lineage is interactive', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with ports', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        await dataProduct.addInputPorts(apiContext, [
          { id: tables[0].entityResponseData.id, type: 'table' },
        ]);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });

  test.describe('Section 8: Pagination', () => {
    test('Input ports list pagination', async ({ page }) => {
      const dataProduct = new DataProduct([domain]);

      await test.step('Create data product with many input ports via API', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.create(apiContext);

        const portAssets = tables.map((table) => ({
          id: table.entityResponseData.id,
          type: 'table',
        }));

        await dataProduct.addInputPorts(apiContext, portAssets);

        await afterAction();
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

      await test.step('Cleanup', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        await dataProduct.delete(apiContext);
        await afterAction();
      });
    });
  });
});
