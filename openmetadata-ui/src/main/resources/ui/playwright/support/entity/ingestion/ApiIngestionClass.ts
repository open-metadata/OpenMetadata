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

class ApiIngestionClass extends ServiceBaseClass {
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
      Services.API,
      `pw-api-with-%-${uuid()}`,
      'Rest',
      'store',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
    this.entityFQN = `${this.serviceName}.${this.entityName} `;
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    // Use the bundled OpenAPI fixture instead of an external URL to keep the test hermetic.
    const openAPISchemaFilePath =
      '/home/airflow/ingestion/examples/openapi/sample.json';

    await page
      .getByTestId('select-widget-root/openAPISchemaConnection__oneof_select')
      .getByRole('combobox')
      // eslint-disable-next-line playwright/no-force-option -- element obscured by overlay
      .click({ force: true });
    await page.click(
      '.ant-select-dropdown:visible [title="OpenAPISchemaFilePath"]'
    );

    await page
      .locator('#root\\/openAPISchemaConnection\\/openAPISchemaFilePath')
      .fill(openAPISchemaFilePath);
  }

  async deleteService(page: Page): Promise<void> {
    await super.deleteService(page);
  }
}

export default ApiIngestionClass;
