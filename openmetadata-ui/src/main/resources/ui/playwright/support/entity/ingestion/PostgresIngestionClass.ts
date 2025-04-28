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

import {
  Page,
  PlaywrightTestArgs,
  PlaywrightWorkerArgs,
  TestType,
} from '@playwright/test';
import { POSTGRES } from '../../../constant/service';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../../utils/common';
import { visitEntityPage } from '../../../utils/entity';
import { visitServiceDetailsPage } from '../../../utils/service';
import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class PostgresIngestionClass extends ServiceBaseClass {
  name = '';
  filterPattern: string;
  queryLogFilePath: string;

  constructor(extraParams?: {
    shouldTestConnection?: boolean;
    shouldAddIngestion?: boolean;
    shouldAddDefaultFilters?: boolean;
  }) {
    const {
      shouldTestConnection = true,
      shouldAddIngestion = true,
      shouldAddDefaultFilters = false,
    } = extraParams ?? {};

    super(
      Services.Database,
      POSTGRES.serviceName,
      POSTGRES.serviceType,
      POSTGRES.tableName,
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );

    this.filterPattern = 'sales';
    this.queryLogFilePath =
      '/home/airflow/ingestion/examples/sample_data/usage/query_log.csv';
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const postgresUsername = process.env.PLAYWRIGHT_POSTGRES_USERNAME ?? '';
    const postgresPassword = process.env.PLAYWRIGHT_POSTGRES_PASSWORD ?? '';
    const postgresHostPort = process.env.PLAYWRIGHT_POSTGRES_HOST_PORT ?? '';
    const postgresDatabase = process.env.PLAYWRIGHT_POSTGRES_DATABASE ?? '';

    await page.fill('#root\\/username', postgresUsername);
    await checkServiceFieldSectionHighlighting(page, 'username');
    await page.fill('#root\\/authType\\/password', postgresPassword);
    await checkServiceFieldSectionHighlighting(page, 'password');
    await page.fill('#root\\/hostPort', postgresHostPort);
    await checkServiceFieldSectionHighlighting(page, 'hostPort');
    await page.fill('#root\\/database', postgresDatabase);
    await checkServiceFieldSectionHighlighting(page, 'database');
  }

  async fillIngestionDetails(page: Page) {
    await page
      .locator('#root\\/schemaFilterPattern\\/includes')
      .fill(this.filterPattern);

    await page.locator('#root\\/schemaFilterPattern\\/includes').press('Enter');
  }

  async runAdditionalTests(
    page: Page,
    test: TestType<PlaywrightTestArgs, PlaywrightWorkerArgs>
  ) {
    if (process.env.PLAYWRIGHT_IS_OSS) {
      await test.step('Add Usage ingestion', async () => {
        const { apiContext } = await getApiContext(page);
        await redirectToHomePage(page);
        await visitServiceDetailsPage(
          page,
          {
            type: this.category,
            name: this.serviceName,
            displayName: this.serviceName,
          },
          true
        );

        await page.click('[data-testid="agents"]');
        await page.waitForSelector(
          '[data-testid="ingestion-details-container"]'
        );

        const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
        if (await metadataTab.isVisible()) {
          await metadataTab.click();
        }
        await page.waitForLoadState('networkidle');
        await page.click('[data-testid="add-new-ingestion-button"]');
        await page.waitForSelector(
          '.ant-dropdown:visible [data-menu-id*="usage"]'
        );
        await page.click('[data-menu-id*="usage"]');
        await page.fill('#root\\/queryLogFilePath', this.queryLogFilePath);

        await page.click('[data-testid="submit-btn"]');
        // Make sure we create ingestion with None schedule to avoid conflict between Airflow and Argo behavior
        await this.scheduleIngestion(page);

        await page.click('[data-testid="view-service-button"]');

        // Header available once page loads
        await page.waitForSelector('[data-testid="data-assets-header"]');
        await page.getByTestId('loader').waitFor({ state: 'detached' });
        await page.getByTestId('agents').click();
        const metadataTab2 = page.locator('[data-testid="metadata-sub-tab"]');
        if (await metadataTab2.isVisible()) {
          await metadataTab2.click();
        }
        await page.waitForLoadState('networkidle');
        await page
          .getByLabel('agents')
          .getByTestId('loader')
          .waitFor({ state: 'detached' });

        const response = await apiContext
          .get(
            `/api/v1/services/ingestionPipelines?service=${encodeURIComponent(
              this.serviceName
            )}&pipelineType=usage&serviceType=databaseService&limit=1`
          )
          .then((res) => res.json());

        // need manual wait to settle down the deployed pipeline, before triggering the pipeline
        await page.waitForTimeout(3000);
        await page.click(
          `[data-row-key*="${response.data[0].name}"] [data-testid="more-actions"]`
        );

        await page.getByTestId('run-button').click();

        await toastNotification(page, `Pipeline triggered successfully!`);

        // need manual wait to make sure we are awaiting on latest run results
        await page.waitForTimeout(2000);

        await this.handleIngestionRetry('usage', page);
      });

      await test.step('Verify if usage is ingested properly', async () => {
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'hidden',
        });
        const entityResponse = page.waitForResponse(
          `/api/v1/tables/name/*.order_items?**`
        );

        await visitEntityPage({
          page,
          searchTerm: this.entityName,
          dataTestId: `${this.serviceName}-${this.entityName}`,
        });

        await entityResponse;

        await page.getByRole('tab', { name: 'Queries' }).click();

        // Need to connect to postgres db to get the query log
        // await page.waitForSelector(
        //   '[data-testid="queries-container"] >> text=selectQuery'
        // );

        await page.click('[data-testid="schema"]');
        await page.waitForSelector('[data-testid="related-tables-data"]');
        await page.waitForSelector('[data-testid="frequently-joined-columns"]');
      });
    }
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

// eslint-disable-next-line jest/no-export
export default PostgresIngestionClass;
