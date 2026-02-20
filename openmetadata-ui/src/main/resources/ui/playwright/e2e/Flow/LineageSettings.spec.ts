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
import { expect } from '@playwright/test';
import { get } from 'lodash';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addPipelineBetweenNodes,
  fillLineageConfigForm,
  performCollapse,
  performExpand,
  performZoomOut,
  verifyColumnLayerActive,
  verifyExpandHandleHover,
  verifyNodePresent,
  visitLineageTab,
} from '../../utils/lineage';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Lineage Settings Tests', () => {
  const table = new TableClass();
  const topic = new TopicClass();
  const dashboard = new DashboardClass();
  const mlModel = new MlModelClass();
  const searchIndex = new SearchIndexClass();
  const container = new ContainerClass();
  const metric = new MetricClass();
  const pipeline = new PipelineClass();

  test.beforeAll('setup lineage settings', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await Promise.all([
      table.create(apiContext),
      topic.create(apiContext),
      dashboard.create(apiContext),
      mlModel.create(apiContext),
      searchIndex.create(apiContext),
      container.create(apiContext),
      metric.create(apiContext),
      pipeline.create(apiContext),
    ]);

    await afterAction();
  });

  test.afterAll('cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await Promise.all([
      table.delete(apiContext),
      topic.delete(apiContext),
      dashboard.delete(apiContext),
      mlModel.delete(apiContext),
      searchIndex.delete(apiContext),
      container.delete(apiContext),
      metric.delete(apiContext),
      pipeline.delete(apiContext),
    ]);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify global lineage config', async ({ page }) => {
    test.slow(true);

    await addPipelineBetweenNodes(page, table, topic);
    await addPipelineBetweenNodes(page, topic, dashboard);
    await addPipelineBetweenNodes(page, dashboard, mlModel);
    await addPipelineBetweenNodes(page, mlModel, searchIndex);
    await addPipelineBetweenNodes(page, searchIndex, container);
    await addPipelineBetweenNodes(page, container, metric);
    await addPipelineBetweenNodes(page, metric, pipeline);

    await test.step(
      'Lineage config should throw error if upstream depth is less than 0',
      async () => {
        await settingClick(page, GlobalSettingOptions.LINEAGE_CONFIG);

        await page.getByTestId('field-upstream').fill('-1');
        await page.getByTestId('field-downstream').fill('-1');
        await page.getByTestId('save-button').click();

        await expect(
          page.getByText('Upstream Depth size cannot be less than 0')
        ).toBeVisible();
        await expect(
          page.getByText('Downstream Depth size cannot be less than 0')
        ).toBeVisible();

        await page.getByTestId('field-upstream').fill('0');
        await page.getByTestId('field-downstream').fill('0');

        const saveRes = page.waitForResponse('/api/v1/system/settings');
        await page.getByTestId('save-button').click();
        await saveRes;

        await toastNotification(page, /Lineage Config updated successfully/);
      }
    );

    await test.step(
      'Update global lineage config and verify lineage for column layer',
      async () => {
        await settingClick(page, GlobalSettingOptions.LINEAGE_CONFIG);
        await fillLineageConfigForm(page, {
          upstreamDepth: 1,
          downstreamDepth: 1,
          layer: 'Column Level Lineage',
        });

        await topic.visitEntityPage(page);
        await visitLineageTab(page);
        await verifyNodePresent(page, table);
        await verifyNodePresent(page, dashboard);
        const mlModelFqn = get(
          mlModel,
          'entityResponseData.fullyQualifiedName'
        );
        const mlModelNode = page.locator(
          `[data-testid="lineage-node-${mlModelFqn}"]`
        );

        await expect(mlModelNode).not.toBeVisible();

        await verifyColumnLayerActive(page);
      }
    );

    await test.step(
      'Update global lineage config and verify lineage for entity layer',
      async () => {
        await settingClick(page, GlobalSettingOptions.LINEAGE_CONFIG);
        await fillLineageConfigForm(page, {
          upstreamDepth: 1,
          downstreamDepth: 1,
          layer: 'Entity Lineage',
        });

        await dashboard.visitEntityPage(page);
        await visitLineageTab(page);

        await verifyNodePresent(page, dashboard);
        await verifyNodePresent(page, mlModel);
        await verifyNodePresent(page, topic);

        const tableNode = page.locator(
          `[data-testid="lineage-node-${get(
            table,
            'entityResponseData.fullyQualifiedName'
          )}"]`
        );

        const searchIndexNode = page.locator(
          `[data-testid="lineage-node-${get(
            searchIndex,
            'entityResponseData.fullyQualifiedName'
          )}"]`
        );

        await expect(tableNode).not.toBeVisible();
        await expect(searchIndexNode).not.toBeVisible();
      }
    );

    await test.step(
      'Verify Upstream and Downstream expand collapse buttons',
      async () => {
        await redirectToHomePage(page);
        await dashboard.visitEntityPage(page);
        await visitLineageTab(page);
        const closeIcon = page.getByTestId('entity-panel-close-icon');
        if (await closeIcon.isVisible()) {
          await closeIcon.click();
        }
        await performZoomOut(page);
        await verifyNodePresent(page, topic);
        await verifyNodePresent(page, mlModel);

        await verifyExpandHandleHover(page, mlModel, false);
        await clickOutside(page);
        await verifyExpandHandleHover(page, topic, true);

        await performExpand(page, mlModel, false, searchIndex);
        await performExpand(page, searchIndex, false, container);
        await performExpand(page, container, false, metric);
        await performExpand(page, topic, true, table);

        await performCollapse(page, mlModel, false, [
          searchIndex,
          container,
          metric,
        ]);
        await performCollapse(page, dashboard, true, [table, topic]);
      }
    );

    await test.step(
      'Reset global lineage config and verify lineage',
      async () => {
        await settingClick(page, GlobalSettingOptions.LINEAGE_CONFIG);
        await fillLineageConfigForm(page, {
          upstreamDepth: 2,
          downstreamDepth: 2,
          layer: 'Entity Lineage',
        });

        await dashboard.visitEntityPage(page);
        await visitLineageTab(page);

        await verifyNodePresent(page, table);
        await verifyNodePresent(page, dashboard);
        await verifyNodePresent(page, mlModel);
        await verifyNodePresent(page, searchIndex);
        await verifyNodePresent(page, topic);
      }
    );
  });

  test('Verify lineage settings for PipelineViewMode as Edge', async ({
    page,
    dataStewardPage,
  }) => {
    test.slow();

    // Update setting to show pipeline as Edge
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.SETTINGS);
    await page.getByTestId('preferences').click();
    await page.getByTestId('preferences.lineageConfig').click();
    await page.getByTestId('field-pipeline-view-mode').click();

    await page.getByTitle('Edge').filter({ visible: true }).click();
    const lineageSettingUpdate = page.waitForResponse(
      '/api/v1/system/settings'
    );
    await page.getByTestId('save-button').click();
    await lineageSettingUpdate;

    await redirectToHomePage(dataStewardPage);

    await addPipelineBetweenNodes(
      dataStewardPage,
      table,
      topic,
      pipeline,
      true
    );
    await pipeline.visitEntityPage(dataStewardPage);
    await dataStewardPage.getByRole('tab', { name: 'Lineage' }).click();
    await dataStewardPage.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(dataStewardPage);
    await dataStewardPage.getByTestId('fit-screen').click();

    // Pipeline should be shown as Edge and not as Node
    await expect(
      dataStewardPage.getByTestId(
        `pipeline-label-${table.entityResponseData.fullyQualifiedName}-${topic.entityResponseData.fullyQualifiedName}`
      )
    ).toBeVisible();

    // update pipeline view mode to Node
    await page.getByTestId('field-pipeline-view-mode').click();
    await page.getByTitle('Node').filter({ visible: true }).click();
    const settingsUpdate = page.waitForResponse('/api/v1/system/settings');
    await page.getByTestId('save-button').click();
    await settingsUpdate;

    await dataStewardPage.reload();
    await dataStewardPage.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(dataStewardPage);
    await dataStewardPage.getByTestId('fit-screen').click();

    // Pipeline should be shown as Node and not as Edge
    await expect(
      dataStewardPage.getByTestId(
        `pipeline-label-${table.entityResponseData.fullyQualifiedName}-${topic.entityResponseData.fullyQualifiedName}`
      )
    ).not.toBeVisible();

    await expect(
      dataStewardPage.getByTestId(
        `lineage-node-${pipeline.entityResponseData.fullyQualifiedName}`
      )
    ).toBeVisible();
  });
});
