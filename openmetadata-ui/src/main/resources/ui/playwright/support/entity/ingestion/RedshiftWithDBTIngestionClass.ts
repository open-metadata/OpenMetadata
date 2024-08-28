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
import { REDSHIFT } from '../../../constant/service';
import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class RedshiftWithDBTIngestionClass extends ServiceBaseClass {
  name: string;
  filterPattern: string;
  dbtEntityFqn: string;

  constructor() {
    super(
      Services.Database,
      REDSHIFT.serviceName,
      REDSHIFT.serviceType,
      REDSHIFT.tableName
    );

    const redshiftDatabase = process.env.PLAYWRIGHT_REDSHIFT_DATABASE ?? '';

    this.filterPattern = 'sales';
    this.dbtEntityFqn = `${REDSHIFT.serviceName}.${redshiftDatabase}.dbt_jaffle.${REDSHIFT.DBTTable}`;
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const redshiftUsername = process.env.PLAYWRIGHT_REDSHIFT_USERNAME ?? '';
    const redshiftPassword = process.env.PLAYWRIGHT_REDSHIFT_PASSWORD ?? '';
    const redshiftHost = process.env.PLAYWRIGHT_REDSHIFT_HOST ?? '';
    const redshiftDatabase = process.env.PLAYWRIGHT_REDSHIFT_DATABASE ?? '';

    await page.fill('#root\\/username', redshiftUsername);
    await checkServiceFieldSectionHighlighting(page, 'username');
    await page.fill('#root\\/password', redshiftPassword);
    await checkServiceFieldSectionHighlighting(page, 'password');
    await page.fill('#root\\/hostPort', redshiftHost);
    await checkServiceFieldSectionHighlighting(page, 'hostPort');
    await page.fill('#root\\/database', redshiftDatabase);
    await checkServiceFieldSectionHighlighting(page, 'database');
  }

  async fillIngestionDetails(page: Page) {
    // no schema or database filters
    await page
      .locator('#root\\/schemaFilterPattern\\/includes')
      .fill('dbt_jaffle');

    await page.locator('#root\\/schemaFilterPattern\\/includes').press('Enter');

    await page.click('#root\\/includeViews');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default RedshiftWithDBTIngestionClass;
