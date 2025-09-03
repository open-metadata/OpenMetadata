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
  await page
    .getByTestId('profiler-tab-left-panel')
    .getByText('Data Quality')
    .click();
  await testCaseResponse;
};
