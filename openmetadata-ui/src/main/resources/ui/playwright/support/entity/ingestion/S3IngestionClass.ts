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

class S3IngestionClass extends ServiceBaseClass {
  name = '';
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
      Services.Storage,
      `pw-s3-storage-with-%-${uuid()}`,
      'S3',
      'awsathena-database',
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
    const s3StorageAccessKeyId =
      process.env.PLAYWRIGHT_S3_STORAGE_ACCESS_KEY_ID ?? '';
    const s3StorageSecretAccessKey =
      process.env.PLAYWRIGHT_S3_STORAGE_SECRET_ACCESS_KEY ?? '';

    await page.fill('#root\\/awsConfig\\/awsAccessKeyId', s3StorageAccessKeyId);
    await checkServiceFieldSectionHighlighting(page, 'awsAccessKeyId');
    await page.fill(
      '#root\\/awsConfig\\/awsSecretAccessKey',
      s3StorageSecretAccessKey
    );
    await checkServiceFieldSectionHighlighting(page, 'awsSecretAccessKey');
    await page.fill('#root\\/awsConfig\\/awsRegion', 'us-east-2');
    await checkServiceFieldSectionHighlighting(page, 'awsRegion');

    // to reduce ingestion time
    await page.fill('#root\\/bucketNames', this.entityName);
    await page.locator('#root\\/bucketNames').press('Enter');
  }

  async fillIngestionDetails(page: Page) {
    await page.fill(
      '#root\\/containerFilterPattern\\/includes',
      `${this.entityName}`
    );
    await page
      .locator('#root\\/containerFilterPattern\\/includes')
      .press('Enter');
  }

  async deleteService(page: Page): Promise<void> {
    await super.deleteService(page);
  }
}

export default S3IngestionClass;
