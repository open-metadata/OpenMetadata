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

class BigQueryIngestionClass extends ServiceBaseClass {
  name = '';
  filterPattern: string;

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
      `pw-bigquery-with-%-${uuid()}`,
      'BigQuery',
      'testtable',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );

    this.filterPattern = 'testschema';
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const clientEmail = process.env.PLAYWRIGHT_BQ_CLIENT_EMAIL ?? '';
    const projectId = process.env.PLAYWRIGHT_BQ_PROJECT_ID ?? '';
    const privateKeyId = process.env.PLAYWRIGHT_BQ_PRIVATE_KEY_ID ?? '';
    const privateKey = process.env.PLAYWRIGHT_BQ_PRIVATE_KEY ?? '';
    const clientId = process.env.PLAYWRIGHT_BQ_CLIENT_ID ?? '';
    const projectIdTaxonomy =
      process.env.PLAYWRIGHT_BQ_PROJECT_ID_TAXONOMY ?? '';

    await page.selectOption(
      '#root\\/credentials\\/gcpConfig__oneof_select',
      'GCP Credentials Values'
    );
    await page.fill('#root\\/credentials\\/gcpConfig\\/projectId', projectId);
    await checkServiceFieldSectionHighlighting(page, 'projectId');
    await page.fill(
      '#root\\/credentials\\/gcpConfig\\/privateKeyId',
      privateKeyId
    );
    await checkServiceFieldSectionHighlighting(page, 'privateKeyId');
    await page.fill('#root\\/credentials\\/gcpConfig\\/privateKey', privateKey);
    await checkServiceFieldSectionHighlighting(page, 'privateKey');
    await page.fill(
      '#root\\/credentials\\/gcpConfig\\/clientEmail',
      clientEmail
    );
    await checkServiceFieldSectionHighlighting(page, 'clientEmail');
    await page.fill('#root\\/credentials\\/gcpConfig\\/clientId', clientId);
    await checkServiceFieldSectionHighlighting(page, 'clientId');
    await page.fill(
      '#root\\/credentials\\/gcpConfig\\/clientX509CertUrl',
      `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
        clientEmail
      )}`
    );
    await checkServiceFieldSectionHighlighting(page, 'clientX509CertUrl');

    await page.fill(`#root\\/taxonomyProjectID`, projectIdTaxonomy);
    await page.locator(`#root\\/taxonomyProjectID`).press('Enter');
  }

  async fillIngestionDetails(page: Page) {
    await page.fill(
      '#root\\/schemaFilterPattern\\/includes',
      `${this.filterPattern}`
    );
    await page.locator('#root\\/schemaFilterPattern\\/includes').press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default BigQueryIngestionClass;
