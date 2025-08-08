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
import { expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { toastNotification } from './common';
import { sidebarClick } from './sidebar';

export const saveAndTriggerDataContractValidation = async (
  page: Page,
  isContractStatusNotVisible?: boolean
) => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await toastNotification(page, 'Data contract saved successfully');

  if (isContractStatusNotVisible) {
    await expect(
      page
        .getByTestId('contract-card-title-container')
        .filter({ hasText: 'Contract Status' })
    ).not.toBeVisible();
  }

  const runNowResponse = page.waitForResponse(
    '/api/v1/dataContracts/*/validate'
  );
  await page.getByTestId('contract-run-now-button').click();
  await runNowResponse;

  await toastNotification(page, 'Contract validation trigger successfully.');

  await page.reload();
};

export const validateDataContractInsideBundleTestSuites = async (
  page: Page
) => {
  await sidebarClick(page, SidebarItem.DATA_QUALITY);

  const testSuiteResponse = page.waitForResponse(
    '/api/v1/dataQuality/testSuites/search/list?*'
  );
  await page.getByTestId('test-suites').click();
  await testSuiteResponse;

  await page.waitForLoadState('networkidle');

  await page
    .locator('.ant-radio-button-wrapper')
    .filter({ hasText: 'Bundle Suites' })
    .click();

  await expect(page.getByTestId('test-suite-table')).toBeVisible();
};
