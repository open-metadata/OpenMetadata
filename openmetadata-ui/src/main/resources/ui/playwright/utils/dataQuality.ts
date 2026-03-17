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

export enum ObservabilityFeature {
  TEST_CASE = 'Test case',
  CUSTOM_METRIC = 'Custom Metric',
}

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

export const selectAddObservabilityFeature = async (
  page: Page,
  featureName: ObservabilityFeature
) => {
  await page.getByRole('menuitemradio', { name: featureName }).click();
};

export const clickEditTestCaseButton = async (
  page: Page,
  testCaseName: string
) => {
  const testCaseDoc = page.waitForResponse(
    '/locales/en-US/OpenMetadata/TestCaseForm.md'
  );
  const testDefinitionResponse = page.waitForResponse(
    '/api/v1/dataQuality/testDefinitions/*'
  );
  await page.getByTestId(`action-dropdown-${testCaseName}`).click();
  await page.getByTestId(`edit-${testCaseName}`).click();
  await testCaseDoc;
  await testDefinitionResponse;
};

export const clickCreateTestCaseButton = async (
  page: Page,
  testCaseName: string
) => {
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

export const visitCreateTestCasePanelFromEntityPage = async (
  page: Page,
  table: TableClass
) => {
  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName'] ?? ''
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('tab', { name: 'Table Profile' }).click();

  await page.getByTestId('profiler-add-table-test-btn').click();
  const testCaseDoc = page.waitForResponse(
    '/locales/en-US/OpenMetadata/TestCaseForm.md'
  );
  await selectAddObservabilityFeature(page, ObservabilityFeature.TEST_CASE);
  await testCaseDoc;
};

export const addTestCaseToLogicalTestSuite = async (
  page: Page,
  testSuiteName: string,
  testCaseName: string
) => {
  await page.goto(`test-suites/${testSuiteName}`);
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  const testCaseResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.click('[data-testid="add-test-case-btn"]');
  await testCaseResponse;
  await page.waitForSelector(
    "[data-testid='test-case-selection-card'] [data-testid='loader']",
    { state: 'detached' }
  );

  const getTestCase = page.waitForResponse(
    `/api/v1/dataQuality/testCases/search/list?*`
  );
  await page.fill('[data-testid="searchbar"]', testCaseName);
  await getTestCase;

  await page.click(`[data-testid="${testCaseName}"]`);
  const updateTestCase = page.waitForResponse(
    '/api/v1/dataQuality/testCases/logicalTestCases'
  );
  await page.click('[data-testid="submit"]');
  await updateTestCase;
  await page.waitForSelector('[data-testid="test-case-selection-card"]', {
    state: 'detached',
  });
};

export const removeTestCasesFromLogicalTestSuite = async (
  page: Page,
  testCaseNames: string[]
) => {
  for (const name of testCaseNames) {
    await page.getByTestId(`action-dropdown-${name}`).click();
    await page.click(`[data-testid="remove-${name}"]`);
    const removeResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
    );
    await page.click('[data-testid="save-button"]');
    await removeResponse;
  }
};

export const addTestSuitePipeline = async (page: Page) => {
  const pipelineTab = page.getByRole('tab', { name: 'Pipeline' });
  await expect(pipelineTab).toBeVisible();
  await pipelineTab.click();
  const testSuiteByNameResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/dataQuality/testSuites/name/') &&
      res.url().includes('fields=owners') &&
      res.status() === 200
  );
  const addPlaceholderButton = page.getByTestId('add-placeholder-button');
  const addPipelineButton = page.getByTestId('add-pipeline-button');
  const addButton = addPlaceholderButton.or(addPipelineButton);
  await expect(addButton).toBeVisible();
  await addButton.click();
  await testSuiteByNameResponse;

  const selectAllTestCases = page
    .getByTestId('select-all-test-cases')
    .and(page.getByRole('switch'));
  await expect(selectAllTestCases).toBeVisible();
  await selectAllTestCases.click();

  await expect(page.getByTestId('cron-type').getByText('Day')).toBeAttached();

  const deployResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/services/ingestionPipelines/deploy') &&
      res.request().method() === 'POST' &&
      res.status() === 200
  );
  await page.getByTestId('deploy-button').click();
  await deployResponse;

  await expect(page.getByTestId('view-service-button')).toBeVisible();
  await expect(page.getByTestId('success-line')).toContainText(
    /has been created and deployed successfully/
  );

  const testSuiteDetailsResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/dataQuality/testSuites/name/') &&
      res.status() === 200
  );
  await page.getByTestId('view-service-button').click();
  await testSuiteDetailsResponse;
};
