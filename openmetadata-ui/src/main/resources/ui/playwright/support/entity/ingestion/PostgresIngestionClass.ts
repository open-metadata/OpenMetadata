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
import { POSTGRES } from '../../../constant/service';
import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class PostgresIngestionClass extends ServiceBaseClass {
  name: string;
  filterPattern: string;
  queryLogFilePath: string;

  constructor() {
    super(
      Services.Database,
      POSTGRES.serviceName,
      POSTGRES.serviceType,
      POSTGRES.tableName
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

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default PostgresIngestionClass;
