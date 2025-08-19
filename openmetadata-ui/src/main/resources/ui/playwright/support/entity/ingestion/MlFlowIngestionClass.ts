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

class MlFlowIngestionClass extends ServiceBaseClass {
  constructor(extraParams?: {
    shouldTestConnection?: boolean;
    shouldAddIngestion?: boolean;
    shouldAddDefaultFilters?: boolean;
  }) {
    const {
      shouldTestConnection = true,
      shouldAddIngestion = false,
      shouldAddDefaultFilters = false,
    } = extraParams ?? {};

    super(
      Services.MLModels,
      `pw-Ml-Model-with-%-${uuid()}`,
      'Mlflow',
      'ElasticnetWineModel',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService() {
    // Do nothing here
  }

  async updateScheduleOptions() {
    // Do nothing here as we are not ingesting anything here
  }

  async fillConnectionDetails(page: Page) {
    await page.fill('#root\\/trackingUri', 'mlModelTrackingUri');
    await checkServiceFieldSectionHighlighting(page, 'trackingUri');
    await page.fill('#root\\/registryUri', 'mlModelRegistryUri');
    await checkServiceFieldSectionHighlighting(page, 'registryUri');
  }

  async fillIngestionDetails(page: Page) {
    await page
      .locator('#root\\/mlModelFilterPattern\\/includes')
      .fill(this.entityName);

    await page
      .locator('#root\\/mlModelFilterPattern\\/includes')
      .press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default MlFlowIngestionClass;
