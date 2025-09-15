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
import { DataContractSecuritySlaData } from '../constant/dataContracts';
import { SidebarItem } from '../constant/sidebar';
import { getApiContext } from './common';
import { sidebarClick } from './sidebar';

export const saveAndTriggerDataContractValidation = async (
  page: Page,
  isContractStatusNotVisible?: boolean
): Promise<string | undefined> => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  const response = await saveContractResponse;
  const responseData = await response.json();

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

  await page.reload();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  return responseData;
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

export const waitForDataContractExecution = async (
  page: Page,
  contractId: string,
  resultId: string,
  maxConsecutiveErrors = 3
) => {
  const { apiContext } = await getApiContext(page);
  let consecutiveErrors = 0;

  await expect
    .poll(
      async () => {
        try {
          const response = await apiContext
            .get(`/api/v1/dataContracts/${contractId}/results/${resultId}`)
            .then((res) => res.json());

          consecutiveErrors = 0; // Reset error counter on success

          return response.contractExecutionStatus;
        } catch (error) {
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(
              `Failed to get contract execution status after ${maxConsecutiveErrors} consecutive attempts: ${error}`
            );
          }

          throw error;
        }
      },
      {
        message: 'Wait for data contract execution to complete',
        timeout: 300_000,
        intervals: [30_000, 20_000, 10_000],
      }
    )
    .toEqual(
      expect.stringMatching(/(Aborted|Success|Failed|PartialSuccess|Queued)/)
    );
};

export const saveSecurityAndSLADetails = async (
  page: Page,
  data: DataContractSecuritySlaData
) => {
  await page.getByRole('tab', { name: 'Security' }).click();

  await page.getByTestId('access-policy-input').fill(data.accessPolicyName);
  await page
    .getByTestId('data-classification-input')
    .fill(data.dataClassificationName);

  await page.getByRole('tab', { name: 'SLA' }).click();

  await page
    .getByTestId('refresh-frequency-interval-input')
    .fill(data.refreshFrequencyIntervalInput);
  await page
    .getByTestId('max-latency-value-input')
    .fill(data.maxLatencyValueInput);
  await page
    .getByTestId('retention-period-input')
    .fill(data.retentionPeriodInput);

  await page.locator('.availability-time-picker').click();

  await page.waitForSelector('.ant-picker-dropdown', {
    state: 'attached',
  });

  await page.getByTestId('availability').fill(data.availability);

  await page.locator('.ant-picker-ok .ant-btn').click();

  await page.getByTestId('refresh-frequency-unit-select').click();
  await page
    .locator(
      `.refresh-frequency-unit-select [title=${data.refreshFrequencyUnitSelect}]`
    )
    .click();

  await page.getByTestId('max-latency-unit-select').click();
  await page
    .locator(`.max-latency-unit-select [title=${data.maxLatencyUnitSelect}]`)
    .click();

  await page.getByTestId('retention-unit-select').click();
  await page
    .locator(`.retention-unit-select [title=${data.retentionUnitSelect}]`)
    .click();

  await expect(page.getByTestId('save-contract-btn')).not.toBeDisabled();

  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const validateSecurityAndSLADetails = async (
  page: Page,
  data: DataContractSecuritySlaData
) => {
  await page.getByRole('tab', { name: 'Security' }).click();

  await expect(page.getByTestId('access-policy-input')).toHaveValue(
    data.accessPolicyName
  );
  await expect(page.getByTestId('data-classification-input')).toHaveValue(
    data.dataClassificationName
  );

  await page.getByRole('tab', { name: 'SLA' }).click();

  await expect(
    page.getByTestId('refresh-frequency-interval-input')
  ).toHaveValue(data.refreshFrequencyIntervalInput);

  await expect(page.getByTestId('max-latency-value-input')).toHaveValue(
    data.maxLatencyValueInput
  );

  await expect(page.getByTestId('retention-period-input')).toHaveValue(
    data.retentionPeriodInput
  );

  await expect(page.getByTestId('availability')).toHaveValue(data.availability);

  await expect(page.getByTestId('refresh-frequency-unit-select')).toContainText(
    data.refreshFrequencyUnitSelect
  );

  await expect(page.getByTestId('max-latency-unit-select')).toContainText(
    data.maxLatencyUnitSelect
  );

  await expect(page.getByTestId('retention-unit-select')).toContainText(
    data.retentionUnitSelect
  );
};
