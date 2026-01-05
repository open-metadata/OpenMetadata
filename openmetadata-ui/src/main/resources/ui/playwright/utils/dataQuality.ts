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
import { expect, Page, Response } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';

export const clickUpdateButton = async (page: Page) => {
  const updateTestCaseResponse = page.waitForResponse(
    (response: Response) =>
      response.url().includes('/api/v1/dataQuality/testCases') &&
      response.request().method() === 'PATCH'
  );
  await page.getByTestId('update-btn').click();
  const response = await updateTestCaseResponse;

  expect(response.status()).toBe(200);
};

export const clickEditTestCaseButton = async (page: Page, testCaseName: string) => {

  const testCaseDoc = page.waitForResponse(
    '/locales/en-US/OpenMetadata/TestCaseForm.md'
  );
  const testDefinitionResponse = page.waitForResponse("/api/v1/dataQuality/testDefinitions/*")
  await page.getByTestId(`action-dropdown-${testCaseName}`).click();
  await page.getByTestId(`edit-${testCaseName}`).click();
  await testCaseDoc;
  await testDefinitionResponse;
};

export const clickCreateTestCaseButton = async (page: Page, testCaseName: string) => {
  const createTestCaseResponse = page.waitForResponse(
    (response: Response) =>
      response.url().includes('/api/v1/dataQuality/testCases') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('create-btn').click();
  const response = await createTestCaseResponse;

  expect(response.status()).toBe(201);

  const testCaseResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list?*fields=*'
  );
  await page.getByRole('tab', { name: 'Data Quality' }).click();
  await testCaseResponse;

  await expect(page.getByTestId(testCaseName)).toBeVisible();
};

export const visitCreateTestCasePanelFromEntityPage = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('tab', { name: 'Table Profile' }).click();

  await page.getByTestId('profiler-add-table-test-btn').click();
  const testCaseDoc = page.waitForResponse(
    '/locales/en-US/OpenMetadata/TestCaseForm.md'
  );
  await page.getByTestId('test-case').click();
  await testCaseDoc;
}
