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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../../support/entity/ChartClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import {
  clickLineageNode,
  dismissLineageMapOnboarding,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

test.describe(
  'Verify custom properties tab visibility logic for supported entity types lineage',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.describe.configure({ mode: 'default' });

    const supportedEntities = [
      { entity: new TableClass(), type: 'table' },
      { entity: new TopicClass(), type: 'topic' },
      { entity: new DashboardClass(), type: 'dashboard' },
      { entity: new PipelineClass(), type: 'pipeline' },
      { entity: new MlModelClass(), type: 'mlmodel' },
      { entity: new ContainerClass(), type: 'container' },
      { entity: new SearchIndexClass(), type: 'searchIndex' },
      { entity: new ApiEndpointClass(), type: 'apiEndpoint' },
      { entity: new MetricClass(), type: 'metric' },
      { entity: new ChartClass(), type: 'chart' },
    ];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      const createEntityArray: Promise<unknown>[] = [];

      supportedEntities.forEach(({ entity }) => {
        createEntityArray.push(entity.create(apiContext));
      });

      await Promise.all(createEntityArray);

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    for (const { entity, type } of supportedEntities) {
      test(`Verify custom properties tab IS visible for supported type: ${type}`, async ({
        page,
      }) => {
        const searchTerm =
          entity.entityResponseData?.['fullyQualifiedName'] ||
          entity.entity.name;

        await entity.visitEntityPage(page, searchTerm);
        await visitLineageTab(page);

        const nodeFqn =
          entity.entityResponseData?.['fullyQualifiedName'] || searchTerm;

        await clickLineageNode(page, nodeFqn);

        const lineagePanel = page.getByTestId('lineage-entity-panel');
        await expect(lineagePanel).toBeVisible();
        await expect(lineagePanel.getByTestId('overview-tab')).toBeVisible();

        const customPropertiesTab = lineagePanel.getByTestId(
          'custom-properties-tab'
        );
        await expect(customPropertiesTab).toBeVisible();

        const closeButton = lineagePanel.getByTestId('drawer-close-icon');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await expect(lineagePanel).not.toBeVisible();
        }
      });
    }
  }
);

test.describe(
  'Hierarchical lineage node details interaction',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );

      await table.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('drills into asset details from the main Lineage page instead of opening the legacy right panel', async ({
      page,
    }) => {
      const tableFqn = table.entityResponseData.fullyQualifiedName;
      const serviceFqn = table.serviceResponseData.fullyQualifiedName;

      // Hierarchy drilling lives on the main Lineage page, so open it at the
      // Layer band focused on this table, as the asset tab used to.
      const search = new URLSearchParams({
        lineageLens: 'service',
        lineageBand: 'LAYER',
        lineageFocus: tableFqn,
        lineageEntityType: 'table',
      });
      const sceneResponse = page.waitForResponse('**/api/v1/lineage/scene?*');
      await page.goto(`/lineage?${search.toString()}`);
      expect((await sceneResponse).ok()).toBeTruthy();
      await dismissLineageMapOnboarding(page);

      await expect(
        page
          .getByTestId('lineage-map-band-LAYER')
          .locator('.lineage-map-rail-dot.active')
      ).toBeVisible();

      const serviceNode = page.getByTestId(`lineage-node-${serviceFqn}`);
      await expect(serviceNode).toBeVisible();
      await serviceNode.getByRole('button', { name: 'Zoom In' }).click();

      await expect
        .poll(() => new URL(page.url()).searchParams.get('lineageBand'))
        .toBe('ASSET');
      await expect(page.getByTestId('lineage-map-band-ASSET')).toBeVisible();

      const lineagePanel = page.getByTestId('lineage-entity-panel');
      await expect(lineagePanel).not.toBeVisible();
      await expect(
        lineagePanel.getByTestId('custom-properties-tab')
      ).not.toBeVisible();
    });
  }
);
