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

import test from '@playwright/test';
import AirflowIngestionClass from '../../support/entity/ingestion/AirflowIngestionClass';
import BigQueryIngestionClass from '../../support/entity/ingestion/BigQueryIngestionClass';
import KafkaIngestionClass from '../../support/entity/ingestion/KafkaIngestionClass';
import MetabaseIngestionClass from '../../support/entity/ingestion/MetabaseIngestionClass';
import MlFlowIngestionClass from '../../support/entity/ingestion/MlFlowIngestionClass';
import MysqlIngestionClass from '../../support/entity/ingestion/MySqlIngestionClass';
import PostgresIngestionClass from '../../support/entity/ingestion/PostgresIngestionClass';
import RedshiftWithDBTIngestionClass from '../../support/entity/ingestion/RedshiftWithDBTIngestionClass';
import S3IngestionClass from '../../support/entity/ingestion/S3IngestionClass';
import SnowflakeIngestionClass from '../../support/entity/ingestion/SnowflakeIngestionClass';
import SupersetIngestionClass from '../../support/entity/ingestion/SupersetIngestionClass';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const services = [
  S3IngestionClass,
  MetabaseIngestionClass,
  MysqlIngestionClass,
  BigQueryIngestionClass,
  KafkaIngestionClass,
  MlFlowIngestionClass,
  SnowflakeIngestionClass,
  SupersetIngestionClass,
  PostgresIngestionClass,
  RedshiftWithDBTIngestionClass,
];

if (process.env.PLAYWRIGHT_IS_OSS) {
  services.push(AirflowIngestionClass);
}

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

services.forEach((ServiceClass) => {
  const service = new ServiceClass();

  test.describe.configure({
    timeout: 300000,
  });

  test.describe.serial(service.serviceType, { tag: '@ingestion' }, async () => {
    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await settingClick(page, service.category);
    });

    test(`Create & Ingest ${service.serviceType} service`, async ({ page }) => {
      await service.createService(page);
    });

    test(`Update description and verify description after re-run`, async ({
      page,
    }) => {
      await service.updateService(page);
    });

    test(`Update schedule options and verify`, async ({ page }) => {
      await service.updateScheduleOptions(page);
    });

    await service.runAdditionalTests(test);

    test(`Delete ${service.serviceType} service`, async ({ page }) => {
      await service.deleteService(page);
    });
  });
});
