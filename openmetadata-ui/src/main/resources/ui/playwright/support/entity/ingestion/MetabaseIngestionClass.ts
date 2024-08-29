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
  name: string;
  tableName = 'jaffle_shop dashboard';
  constructor() {
    super(
      Services.Dashboard,
      `pw-Metabase-${uuid()}`,
      'Metabase',
      // for Metadabase name will be actual id  cc: @OnkarVO7
      '1'
    );
    this.tableName = 'jaffle_shop dashboard';
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
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
