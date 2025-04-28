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

import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class MetabaseIngestionClass extends ServiceBaseClass {
  name = '';
  tableName = 'jaffle_shop dashboard';
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
      `pw-Metabase-with-%-${uuid()}`,
      'Metabase',
      'jaffle_shop dashboard',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
    this.tableName = 'jaffle_shop dashboard';
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    // For dashboards name will be ID and displayName will be name so updating testID for it
    const testId = `${this.serviceName}-1`;
    await this.updateDescriptionForIngestedTables(page, testId);
  }

  async fillConnectionDetails(page: Page) {
    const metabaseUsername = process.env.PLAYWRIGHT_METABASE_USERNAME ?? '';
    const metabasePassword = process.env.PLAYWRIGHT_METABASE_PASSWORD ?? '';
    const metabaseHostPort = process.env.PLAYWRIGHT_METABASE_HOST_PORT ?? '';

    await page.fill('#root\\/username', metabaseUsername);
    await checkServiceFieldSectionHighlighting(page, 'username');
    await page.fill('#root\\/password', metabasePassword);
    await checkServiceFieldSectionHighlighting(page, 'password');
    await page.fill('#root\\/hostPort', metabaseHostPort);
    await checkServiceFieldSectionHighlighting(page, 'hostPort');
  }

  async fillIngestionDetails(page: Page) {
    await page
      .locator('#root\\/dashboardFilterPattern\\/includes')
      .fill(this.tableName);

    await page
      .locator('#root\\/dashboardFilterPattern\\/includes')
      .press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default MetabaseIngestionClass;
