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
import { expect, Page } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { toastNotification } from './common';

export const deleteTestCase = async (page: Page, testCaseName: string) => {
  await page.getByTestId(`action-dropdown-${testCaseName}`).click();
  await page.getByTestId(`delete-${testCaseName}`).click();
  await page.fill('#deleteTextInput', 'DELETE');

  await expect(page.getByTestId('confirm-button')).toBeEnabled();

  const deleteResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/*?hardDelete=true&recursive=true'
  );
  await page.getByTestId('confirm-button').click();
  await deleteResponse;

  await toastNotification(page, /deleted successfully!/);
};

export const visitDataQualityTab = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  await page.getByTestId('profiler').click();
  const testCaseResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list?*fields=*'
  );
  await page.getByRole('tab', { name: 'Data Quality' }).click();
  await testCaseResponse;
};

export const verifyIncidentBreadcrumbsFromTablePageRedirect = async (
  page: Page,
  table: TableClass,
  testCaseName: string
) => {
  await page
    .getByRole('link', {
      name: testCaseName,
    })
    .click();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('breadcrumb-link').nth(0)).toHaveText(
    `${table.entityResponseData.service.displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(1)).toHaveText(
    `${table.entityResponseData?.['database'].displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(2)).toHaveText(
    `${table.entityResponseData?.['databaseSchema'].displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(3)).toHaveText(
    `${table.entityResponseData?.displayName}/`
  );

  await page.getByTestId('breadcrumb-link').nth(3).click();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const findSystemTestDefinition = async (page: Page) => {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
  );

  await page.goto('/rules-library');
  let response = await responsePromise;
  let data = await response.json();

  while (true) {
    const systemTest = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTest) {
      return systemTest;
    }

    const nextButton = page.getByTestId('next');

    if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
      const nextResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'GET'
      );
      await nextButton.click();
      response = await nextResponsePromise;
      data = await response.json();
      await page.waitForSelector('[data-testid="test-definition-table"]', {
        state: 'visible',
      });
    } else {
      throw new Error('System test definition not found');
    }
  }
};
