/*
 *  Copyright 2025 Collate.
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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';

export const navigateToSampleDataTab = async (
  page: Page,
  table: TableClass
) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  const sampleDataResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(`/api/v1/tables/${table.entityResponseData.id}/sampleData`) &&
      response.request().method() === 'GET'
  );

  await page.getByRole('tab', { name: 'Sample Data' }).click();
  await sampleDataResponse;
  await waitForAllLoadersToDisappear(page);
};

export const addSampleDataViaApi = async (
  apiContext: APIRequestContext,
  table: TableClass
) => {
  const columns = (table.entityResponseData.columns ?? [])
    .map((col) => col.name ?? '')
    .filter(Boolean);

  const rows = Array.from({ length: 3 }, (_, rowIdx) =>
    columns.map((_, colIdx) => `sample_value_${colIdx}_${rowIdx}`)
  );

  const response = await apiContext.put(
    `/api/v1/tables/${table.entityResponseData.id}/sampleData`,
    { data: { columns, rows } }
  );
  expect(response.status()).toBe(200);
};
