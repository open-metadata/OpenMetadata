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
import { uuid } from '../../../utils/common';

import { Services } from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class SupersetIngestionClass extends ServiceBaseClass {
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
      Services.Dashboard,
      `pw-Superset-with-%-${uuid()}`,
      'Superset',
      "World Bank's Data",
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    const testId = `${this.serviceName}-1`;
    await this.updateDescriptionForIngestedTables(page, testId);
  }

  async fillConnectionDetails(page: Page) {
    const username = process.env.PLAYWRIGHT_SUPERSET_USERNAME ?? '';
    const password = process.env.PLAYWRIGHT_SUPERSET_PASSWORD ?? '';
    const hostPort = process.env.PLAYWRIGHT_SUPERSET_HOST_PORT ?? '';

    await page.fill('#root\\/connection\\/username', username);
    await page.fill('#root\\/connection\\/password', password);
    await page.fill('#root\\/hostPort', hostPort);
  }

  async fillIngestionDetails(page: Page) {
    await page.fill(
      '#root\\/dashboardFilterPattern\\/includes',
      `${this.entityName}`
    );
    await page
      .locator('#root\\/dashboardFilterPattern\\/includes')
      .press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default SupersetIngestionClass;
