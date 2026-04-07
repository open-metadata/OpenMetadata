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
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../../support/entity/ChartClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../../support/entity/service/PipelineServiceClass';
import { StorageServiceClass } from '../../../support/entity/service/StorageServiceClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { clickLineageNode, visitLineageTab } from '../../../utils/lineage';
import { sidebarClick } from '../../../utils/sidebar';
import { test } from '../../fixtures/pages';

test.describe('Verify custom properties tab visibility logic for supported entity types lineage', () => {
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
        entity.entityResponseData?.['fullyQualifiedName'] || entity.entity.name;

      await entity.visitEntityPage(page, searchTerm);
      await visitLineageTab(page);

      const nodeFqn = entity.entityResponseData?.['fullyQualifiedName'] ?? '';

      await clickLineageNode(page, nodeFqn);

      const lineagePanel = page.getByTestId('lineage-entity-panel');
      await expect(lineagePanel).toBeVisible();
      await waitForAllLoadersToDisappear(page);

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
});

test.describe('Verify custom properties tab is NOT visible for unsupported entity types in platform lineage', () => {
  const unsupportedServices = [
    { service: new DatabaseServiceClass(), type: 'databaseService' },
    { service: new MessagingServiceClass(), type: 'messagingService' },
    { service: new DashboardServiceClass(), type: 'dashboardService' },
    { service: new PipelineServiceClass(), type: 'pipelineService' },
    { service: new MlmodelServiceClass(), type: 'mlmodelService' },
    { service: new StorageServiceClass(), type: 'storageService' },
    { service: new ApiServiceClass(), type: 'apiService' },
  ];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    const createEntityArray: Promise<unknown>[] = [];
    for (const { service } of unsupportedServices) {
      createEntityArray.push(service.create(apiContext));
    }
    await Promise.all(createEntityArray);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  for (const { service, type } of unsupportedServices) {
    test(`Verify custom properties tab is NOT visible for ${type} in platform lineage`, async ({
      page,
    }) => {
      const serviceFqn = get(service, 'entityResponseData.fullyQualifiedName');

      await sidebarClick(page, SidebarItem.LINEAGE);

      const searchEntitySelect = page.getByTestId('search-entity-select');
      await expect(searchEntitySelect).toBeVisible();
      await searchEntitySelect.click();

      const searchInput = page
        .getByTestId('search-entity-select')
        .locator('.ant-select-selection-search-input');

      const searchResponse = page.waitForResponse((response) =>
        response.url().includes('/api/v1/search/query')
      );
      await searchInput.fill(service.entity.name);

      const searchResponseResult = await searchResponse;
      expect(searchResponseResult.status()).toBe(200);

      const nodeSuggestion = page.getByTestId(`node-suggestion-${serviceFqn}`);
      //small timeout to wait for the node suggestion to be visible in dropdown
      await expect(nodeSuggestion).toBeVisible();

      const lineageResponse = page.waitForResponse((response) =>
        response.url().includes('/api/v1/lineage/getLineage')
      );

      await nodeSuggestion.click();

      const lineageResponseResult = await lineageResponse;
      expect(lineageResponseResult.status()).toBe(200);

      await expect(
        page.getByTestId(`lineage-node-${serviceFqn}`)
      ).toBeVisible();

      await clickLineageNode(page, serviceFqn);

      const lineagePanel = page.getByTestId('lineage-entity-panel');
      await expect(lineagePanel).toBeVisible();
      await waitForAllLoadersToDisappear(page);

      const customPropertiesTab = lineagePanel.getByTestId(
        'custom-properties-tab'
      );
      const customPropertiesTabByRole = lineagePanel.getByRole('menuitem', {
        name: /custom propert/i,
      });

      await expect(customPropertiesTab).not.toBeVisible();
      await expect(customPropertiesTabByRole).not.toBeVisible();

      const closeButton = lineagePanel.getByTestId('drawer-close-icon');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(lineagePanel).not.toBeVisible();
      }
    });
  }
});
