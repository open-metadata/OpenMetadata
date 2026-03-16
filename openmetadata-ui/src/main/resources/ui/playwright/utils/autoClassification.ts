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

import { Page } from '@playwright/test';
import MysqlIngestionClass from '../support/entity/ingestion/MySqlIngestionClass';
import { getApiContext, toastNotification } from './common';
import { visitServiceDetailsPage } from './service';
import { waitForAllLoadersToDisappear } from './entity';

export const addAndTriggerAutoClassificationPipeline = async (
  page: Page,
  mysqlService: MysqlIngestionClass
) => {
  const { apiContext } = await getApiContext(page);

  await visitServiceDetailsPage(
    page,
    {
      type: mysqlService.category,
      name: mysqlService.name,
      displayName: mysqlService.name,
    },
    true
  );

  // Add auto classification ingestion
  await page.click('[data-testid="agents"]');

  const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
  if (await metadataTab.isVisible()) {
    await metadataTab.click();
  }

  await page.click('[data-testid="add-new-ingestion-button"]');

  await page
    .locator('.ant-dropdown:visible [data-menu-id*="autoClassification"]')
    .waitFor();

  await page.locator('[data-menu-id*="autoClassification"]').waitFor();

  await page.click('[data-menu-id*="autoClassification"]');

  // Fill the auto classification form details
  await page.locator('#root\\/tableFilterPattern\\/includes').waitFor();

  await mysqlService.fillIngestionDetails(page);

  await page.click('[data-testid="submit-btn"]');

  // Make sure we create ingestion with None schedule to avoid conflict between Airflow and Argo behavior
  await mysqlService.scheduleIngestion(page);

  await page.click('[data-testid="view-service-button"]');

  // Header available once page loads
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('agents').click();
  const metadataTab2 = page.locator('[data-testid="metadata-sub-tab"]');
  if (await metadataTab2.isVisible()) {
    await metadataTab2.click();
  }
  await page
    .getByLabel('agents')
    .getByTestId('loader')
    .waitFor({ state: 'detached' });

  const response = await apiContext
    .get(
      `/api/v1/services/ingestionPipelines?service=${encodeURIComponent(
        mysqlService.name
      )}&pipelineType=autoClassification&serviceType=databaseService&limit=1`
    )
    .then((res) => res.json());

  // eslint-disable-next-line playwright/no-wait-for-timeout -- pipeline deployment settling time
  await page.waitForTimeout(3000);

  await page.click(
    `[data-row-key*="${response.data[0].name}"] [data-testid="more-actions"]`
  );
  await page.getByTestId('run-button').click();

  await toastNotification(page, `Pipeline triggered successfully!`);

  // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for latest pipeline run results
  await page.waitForTimeout(2000);

  await mysqlService.handleIngestionRetry('autoClassification', page);
};
