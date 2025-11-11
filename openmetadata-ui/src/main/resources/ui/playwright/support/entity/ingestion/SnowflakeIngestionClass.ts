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

class SnowflakeIngestionClass extends ServiceBaseClass {
  schema: string;
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
      `pw-snowflake-with-%-${uuid()}`,
      'Snowflake',
      'CUSTOMER',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
    this.schema = 'TPCH_SF1000';
    const database = process.env.PLAYWRIGHT_SNOWFLAKE_DATABASE ?? '';
    this.entityFQN = `${this.serviceName}.${database}.${this.schema}.${this.entityName} `;
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async fillConnectionDetails(page: Page) {
    const username = process.env.PLAYWRIGHT_SNOWFLAKE_USERNAME ?? '';
    const password = process.env.PLAYWRIGHT_SNOWFLAKE_PASSWORD ?? '';
    const account = process.env.PLAYWRIGHT_SNOWFLAKE_ACCOUNT ?? '';
    const database = process.env.PLAYWRIGHT_SNOWFLAKE_DATABASE ?? '';
    const warehouse = process.env.PLAYWRIGHT_SNOWFLAKE_WAREHOUSE ?? '';
    const passphrase = process.env.PLAYWRIGHT_SNOWFLAKE_PASSPHRASE ?? '';

    await page.fill('#root\\/username', username);
    await checkServiceFieldSectionHighlighting(page, 'username');
    await page.fill('#root\\/privateKey', password);
    await checkServiceFieldSectionHighlighting(page, 'privateKey');
    await page.fill('#root\\/account', account);
    await checkServiceFieldSectionHighlighting(page, 'account');
    await page.fill('#root\\/database', database);
    await checkServiceFieldSectionHighlighting(page, 'database');
    await page.fill('#root\\/warehouse', warehouse);
    await checkServiceFieldSectionHighlighting(page, 'warehouse');
    await page.fill('#root\\/snowflakePrivatekeyPassphrase', passphrase);
    await checkServiceFieldSectionHighlighting(
      page,
      'snowflakePrivatekeyPassphrase'
    );
  }

  async fillIngestionDetails(page: Page) {
    await page.fill('#root\\/schemaFilterPattern\\/includes', `${this.schema}`);
    await page.locator('#root\\/schemaFilterPattern\\/includes').press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default SnowflakeIngestionClass;
