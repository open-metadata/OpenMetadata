/*
 *  Copyright 2024 Collate.
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

import { expect, test } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import AirflowIngestionClass from '../../support/entity/ingestion/AirflowIngestionClass';
import ApiIngestionClass from '../../support/entity/ingestion/ApiIngestionClass';
import KafkaIngestionClass from '../../support/entity/ingestion/KafkaIngestionClass';
import MetabaseIngestionClass from '../../support/entity/ingestion/MetabaseIngestionClass';
import MlFlowIngestionClass from '../../support/entity/ingestion/MlFlowIngestionClass';
import MysqlIngestionClass from '../../support/entity/ingestion/MySqlIngestionClass';
import S3IngestionClass from '../../support/entity/ingestion/S3IngestionClass';
import { UserClass } from '../../support/user/UserClass';
import { checkAutoPilotStatus } from '../../utils/AutoPilot';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  reloadAndWaitForNetworkIdle,
} from '../../utils/common';
import { getServiceCategoryFromService } from '../../utils/serviceIngestion';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const user = new UserClass();

const services = [
  ApiIngestionClass,
  S3IngestionClass,
  MetabaseIngestionClass,
  MysqlIngestionClass,
  KafkaIngestionClass,
  MlFlowIngestionClass,
];

if (process.env.PLAYWRIGHT_IS_OSS) {
  services.push(AirflowIngestionClass);
}

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  trace: process.env.PLAYWRIGHT_IS_OSS ? 'off' : 'on-first-retry',
  video: process.env.PLAYWRIGHT_IS_OSS ? 'on' : 'off',
});

test.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);

  await user.create(apiContext);
  await user.setDataStewardRole(apiContext);

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);

  await user.delete(apiContext);

  await afterAction();
});

services.forEach((ServiceClass) => {
  const service = new ServiceClass({
    shouldAddIngestion: false,
    shouldAddDefaultFilters: true,
  });

  test.describe.serial(
    service.serviceType,
    PLAYWRIGHT_INGESTION_TAG_OBJ,
    () => {
      const testData = {
        service: {
          name: '',
          id: '',
          fullyQualifiedName: '',
        },
      };

      test.beforeEach('Visit entity details page', async ({ page }) => {
        await redirectToHomePage(page);
      });

      test('Create Service and check the AutoPilot status', async ({
        page,
      }) => {
        // 8 minutes max for AutoPilot tests to complete agents running.
        test.setTimeout(8 * 60 * 1000);

        await settingClick(
          page,
          service.category as unknown as SettingOptionsType
        );

        // Create service
        await service.createService(page);

        testData.service = service.serviceResponseData;

        // Wait for the service details page to load
        await page.waitForURL('**/service/**');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Reload the page and wait for the network to be idle
        await reloadAndWaitForNetworkIdle(page);

        // Wait for the auto pilot status banner to be visible
        await page.waitForSelector(
          '[data-testid="auto-pilot-status-banner"] [data-testid="status-banner-icon-RUNNING"] ',
          {
            state: 'visible',
          }
        );

        // Click the close icon to hide the banner
        await page.click('[data-testid="status-banner-close-icon"]');

        // Reload the page and wait for the network to be idle
        await reloadAndWaitForNetworkIdle(page);

        // Check if the auto pilot status banner is hidden
        await expect(
          page
            .getByTestId('auto-pilot-status-banner')
            .getByTestId('status-banner-icon-RUNNING')
        ).toBeHidden();

        // Check the auto pilot status
        await checkAutoPilotStatus(page, service);

        // Reload the page and wait for the network to be idle
        await reloadAndWaitForNetworkIdle(page);

        // Wait for the auto pilot status banner to be visible
        await expect(
          page
            .getByTestId('auto-pilot-status-banner')
            .getByTestId('status-banner-icon-FINISHED')
        ).toBeVisible();

        // Click the close icon to hide the banner
        await page.click('[data-testid="status-banner-close-icon"]');

        // Reload the page and wait for the network to be idle
        await reloadAndWaitForNetworkIdle(page);

        // Check if the auto pilot status banner is hidden
        await expect(
          page
            .getByTestId('auto-pilot-status-banner')
            .getByTestId('status-banner-icon-FINISHED')
        ).toBeHidden();
      });

      test('Agents created by AutoPilot should be deleted', async ({
        page,
      }) => {
        const { apiContext } = await getApiContext(page);

        // Get the agents created by AutoPilot
        const getAgents = await apiContext.get(
          `/api/v1/services/ingestionPipelines?fields=owners%2CpipelineStatuses&service=${
            testData.service.name
          }&pipelineType=metadata%2Cusage%2Clineage%2Cprofiler%2CautoClassification%2Cdbt&serviceType=${getServiceCategoryFromService(
            service.category
          )}&limit=15`
        );

        const agentsList = (await getAgents.json()).data;

        // Check if the agents are created
        expect(agentsList.length).toBeGreaterThan(0);

        // Delete the service
        await service.deleteService(page);

        // Get the agents after deleting the service
        const getAfterDeletingAgents = await apiContext.get(
          `/api/v1/services/ingestionPipelines?fields=owners%2CpipelineStatuses&service=${
            testData.service.name
          }&pipelineType=metadata%2Cusage%2Clineage%2Cprofiler%2CautoClassification%2Cdbt&serviceType=${getServiceCategoryFromService(
            service.category
          )}&limit=15`
        );

        const agentsListAfterDeleting = (await getAfterDeletingAgents.json())
          .data;

        // Check if the agents are deleted
        expect(agentsListAfterDeleting).toHaveLength(0);
      });
    }
  );
});
