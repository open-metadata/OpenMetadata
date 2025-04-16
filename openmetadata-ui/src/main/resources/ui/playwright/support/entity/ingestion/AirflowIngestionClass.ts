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

class AirflowIngestionClass extends ServiceBaseClass {
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
      Services.Pipeline,
      `pw-airflow-with-%-${uuid()}`,
      'Airflow',
      'sample_lineage',
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
    const airflowHostPort = process.env.PLAYWRIGHT_AIRFLOW_HOST_PORT ?? '';

    await page.locator('#root\\/hostPort').fill(airflowHostPort);

    await page
      .locator('#root\\/connection__oneof_select')
      .selectOption('BackendConnection');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default AirflowIngestionClass;
