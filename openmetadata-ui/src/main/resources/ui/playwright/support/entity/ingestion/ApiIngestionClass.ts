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
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const openAPISchemaURL = 'https://petstore3.swagger.io/api/v3/openapi.json';

    await page.locator('#root\\/openAPISchemaURL').fill(openAPISchemaURL);
    await checkServiceFieldSectionHighlighting(page, 'openAPISchemaURL');
  }

  async deleteService(page: Page): Promise<void> {
    await super.deleteService(page);
  }
}

export default ApiIngestionClass;
