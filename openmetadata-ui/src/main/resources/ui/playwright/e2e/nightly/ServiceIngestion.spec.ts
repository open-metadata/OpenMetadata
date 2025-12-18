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

import test, { expect } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { MYSQL, POSTGRES, REDSHIFT } from '../../constant/service';
import { GlobalSettingOptions } from '../../constant/settings';
import AirflowIngestionClass from '../../support/entity/ingestion/AirflowIngestionClass';
import ApiIngestionClass from '../../support/entity/ingestion/ApiIngestionClass';
import BigQueryIngestionClass from '../../support/entity/ingestion/BigQueryIngestionClass';
import KafkaIngestionClass from '../../support/entity/ingestion/KafkaIngestionClass';
import MetabaseIngestionClass from '../../support/entity/ingestion/MetabaseIngestionClass';
import MlFlowIngestionClass from '../../support/entity/ingestion/MlFlowIngestionClass';
import MysqlIngestionClass from '../../support/entity/ingestion/MySqlIngestionClass';
import PostgresIngestionClass from '../../support/entity/ingestion/PostgresIngestionClass';
import RedshiftWithDBTIngestionClass from '../../support/entity/ingestion/RedshiftWithDBTIngestionClass';
import SnowflakeIngestionClass from '../../support/entity/ingestion/SnowflakeIngestionClass';
import SupersetIngestionClass from '../../support/entity/ingestion/SupersetIngestionClass';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  INVALID_NAMES,
  redirectToHomePage,
} from '../../utils/common';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

const table = new TableClass();
const services: Record<string, typeof ApiIngestionClass> = {
  'Api Service': ApiIngestionClass,
  // Skipping S3 as it is failing intermittently in CI
  // Remove the comment when fixed: https://github.com/open-metadata/OpenMetadata/issues/23727
  // S3IngestionClass,
  'Metabase Service': MetabaseIngestionClass,
  'Mysql Service': MysqlIngestionClass,
  'BigQuery Service': BigQueryIngestionClass,
  'Kafka Service': KafkaIngestionClass,
  'MlFlow Service': MlFlowIngestionClass,
  'Snowflake Service': SnowflakeIngestionClass,
  'Superset Service': SupersetIngestionClass,
  'Postgres Service': PostgresIngestionClass,
  'Redshift Service': RedshiftWithDBTIngestionClass,
};

if (process.env.PLAYWRIGHT_IS_OSS) {
  services['Airflow Service'] = AirflowIngestionClass;
}

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  trace: process.env.PLAYWRIGHT_IS_OSS ? 'off' : 'retain-on-failure',
  video: process.env.PLAYWRIGHT_IS_OSS ? 'on' : 'off',
});

Object.entries(services).forEach(([key, ServiceClass]) => {
  const service = new ServiceClass();

  test.describe.configure({
    // 11 minutes max for ingestion tests
    timeout: 11 * 60 * 1000,
  });

  test.describe.serial(key, PLAYWRIGHT_INGESTION_TAG_OBJ, async () => {
    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await settingClick(
        page,
        service.category as unknown as SettingOptionsType
      );
    });

    /**
     * Tests service creation and first ingestion run
     * @description Creates the service and triggers ingestion
     */
    test(`Create & Ingest ${key} service`, async ({ page }) => {
      await service.createService(page);
    });

    /**
     * Tests description update persistence across reruns
     * @description Updates service description and verifies it after rerun
     */
    test(`Update description and verify description after re-run`, async ({
      page,
    }) => {
      await service.updateService(page);
    });

    /**
     * Tests schedule option updates
     * @description Updates ingestion schedule options and verifies they persist
     */
    test(`Update schedule options and verify`, async ({ page }) => {
      await service.updateScheduleOptions(page);
    });

    if (
      [POSTGRES.serviceType, REDSHIFT.serviceType, MYSQL].includes(
        service.serviceType
      )
    ) {
      /**
       * Tests database-specific ingestion behaviors
       * @description Runs additional checks for Postgres, Redshift, and MySQL services
       */
      test(`Service specific tests`, async ({ page }) => {
        await service.runAdditionalTests(page, test);
      });
    }

    /**
     * Tests service deletion flow
     * @description Deletes the service and validates removal
     */
    test(`Delete ${key} service`, async ({ page }) => {
      await service.deleteService(page);
    });
  });
});

test.describe('Service form', () => {
  /**
   * Tests validation for invalid service names
   * @description Ensures required and character constraints surface errors on the name field
   */
  test('name field should throw error for invalid name', async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.DATABASES);
    await page.click('[data-testid="add-service-button"]');
    await page.click('[data-testid="Mysql"]');
    await page.click('[data-testid="next-button"]');

    await page.waitForSelector('[data-testid="service-name"]');
    await page.click('[data-testid="next-button"]');

    await expect(page.locator('#name_help')).toBeVisible();
    await expect(page.locator('#name_help')).toHaveText('Name is required');

    await page.fill(
      '[data-testid="service-name"]',
      INVALID_NAMES.WITH_SPECIAL_CHARS
    );

    await expect(page.locator('#name_help')).toBeVisible();
    await expect(page.locator('#name_help')).toHaveText(
      'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.'
    );

    await page.fill('[data-testid="service-name"]', 'test-service');

    await page.click('[data-testid="next-button"]');

    await expect(page.getByTestId('step-icon-3')).toHaveClass(/active/);
  });
});

test.describe('Service Ingestion Pagination', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
  });

  /**
   * Tests default ingestion pagination size
   * @description Verifies ingestion pipelines load with a default page size of 15
   */
  test('Default Pagination size should be 15', async ({ page }) => {
    const servicePageResponse = page.waitForResponse(
      '/api/v1/services/databaseServices/name/*'
    );
    const validateIngestionPipelineLimitSize = page.waitForResponse(
      '/api/v1/services/ingestionPipelines?fields=**&limit=15'
    );

    await page.getByText(table.service.name).click();
    await servicePageResponse;
    await validateIngestionPipelineLimitSize;
  });
});
