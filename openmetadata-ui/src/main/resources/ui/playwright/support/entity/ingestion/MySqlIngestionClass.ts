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
import { expect, Page } from '@playwright/test';
import { env } from 'process';
import { uuid } from '../../../utils/common';
import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class MysqlIngestionClass extends ServiceBaseClass {
  name: string;
  tableFilter: string[];
  constructor() {
    super(Services.Database, `pw-mysql-${uuid()}`, 'Mysql', 'bot_entity');
    this.tableFilter = ['bot_entity', 'alert_entity', 'chart_entity'];
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const username = env.PLAYWRIGHT_MYSQL_USERNAME ?? '';
    const password = env.PLAYWRIGHT_MYSQL_PASSWORD ?? '';
    const hostPort = env.PLAYWRIGHT_MYSQL_HOST_PORT ?? '';

    await page.fill('#root\\/username', username);
    await checkServiceFieldSectionHighlighting(page, 'username');
    await page.fill('#root\\/authType\\/password', password);
    await checkServiceFieldSectionHighlighting(page, 'password');
    await page.fill('#root\\/hostPort', hostPort);
    await checkServiceFieldSectionHighlighting(page, 'hostPort');
  }

  async fillIngestionDetails(page: Page) {
    for (const filter of this.tableFilter) {
      await page.fill('#root\\/tableFilterPattern\\/includes', filter);
      await page
        .locator('#root\\/tableFilterPattern\\/includes')
        .press('Enter');
    }
  }

  async validateIngestionDetails(page: Page) {
    await page.waitForSelector('.ant-select-selection-item-content');

    expect(page.locator('.ant-select-selection-item-content')).toHaveText(
      this.tableFilter
    );
  }
}

export default MysqlIngestionClass;
