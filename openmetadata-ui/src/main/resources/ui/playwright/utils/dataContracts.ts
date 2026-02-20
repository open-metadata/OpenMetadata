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
import {
  DataContractSecuritySlaData,
  DATA_CONTRACT_DETAILS,
  DATA_CONTRACT_SECURITY_CONSUMER_DETAILS,
} from '../constant/dataContracts';
import { SidebarItem } from '../constant/sidebar';
import { TableClass } from '../support/entity/TableClass';
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
  await page.getByTestId('manage-contract-actions').click();

  await page.waitForSelector('.contract-action-dropdown', {
    state: 'visible',
  });

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

  const bundleSuitesResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testSuites/search/list') &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );

  await page
    .locator('.ant-radio-button-wrapper')
    .filter({ hasText: 'Bundle Suites' })
    .click();

  await bundleSuitesResponse;

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
  data: DataContractSecuritySlaData,
  tableData: TableClass,
  addAnotherConsumer?: boolean,
  isUpdate?: boolean
) => {
  await page.getByRole('tab', { name: 'Security' }).click();

  await page
    .getByTestId('data-classification-input')
    .fill(data.dataClassificationName);

  await expect(page.getByTestId('add-policy-button')).toBeDisabled();

  await page
    .getByTestId('access-policy-input-0')
    .fill(data.consumers.accessPolicyName);

  for (const identity of data.consumers.identities) {
    await page.locator('#identities-input-0').fill(identity);
    await page.locator('#identities-input-0').press('Enter');
  }

  // Add Column Information
  for (const filter of data.consumers.row_filters) {
    await page
      .locator(`#columnName-input-0-${filter.index}`)
      .fill(tableData.columnsName[filter.index]);
    await page.locator(`#columnName-input-0-${filter.index}`).press('Enter');

    for (const value of filter.values) {
      await page.locator(`#values-0-${filter.index}`).fill(value);
      await page.locator(`#values-0-${filter.index}`).press('Enter');
    }

    if (filter.index === 0) {
      await page.getByTestId('add-row-filter-button-0').click();
    }
  }

  await page.getByTestId('save-policy-button').click();

  await expect(page.getByTestId('add-policy-button')).not.toBeDisabled();
  await expect(page.getByTestId('edit-policy-0')).toBeVisible();
  await expect(page.getByTestId('delete-policy-0')).toBeVisible();
  await expect(page.getByText(data.consumers.accessPolicyName)).toBeVisible();

  if (addAnotherConsumer) {
    await page.getByTestId('add-policy-button').click();

    await page
      .getByTestId('access-policy-input-1')
      .fill(DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.accessPolicyName);

    for (const identity of DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.identities) {
      await page.locator('#identities-input-1').fill(identity);
      await page.locator('#identities-input-1').press('Enter');
    }

    // Add Column Information
    for (const filter of DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.row_filters) {
      await page
        .locator(`#columnName-input-1-${filter.index}`)
        .fill(tableData.columnsName[1]);
      await page.locator(`#columnName-input-1-${filter.index}`).press('Enter');

      for (const value of filter.values) {
        await page.locator(`#values-1-${filter.index}`).fill(value);
        await page.locator(`#values-1-${filter.index}`).press('Enter');
      }

      if (filter.index === 0) {
        await page.getByTestId('add-row-filter-button-1').click();
      }
    }

    await page.getByTestId('save-policy-button').click();

    await expect(
      page.getByText(DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.accessPolicyName)
    ).toBeVisible();

    await page.getByTestId('edit-policy-1').click();

    // identities value check
    await expect(
      page.getByText(
        DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.identities.join('')
      )
    ).toBeVisible();

    await page.getByTestId('cancel-policy-button').click();

    await page.getByTestId('delete-policy-1').click();

    await expect(
      page.getByText(DATA_CONTRACT_SECURITY_CONSUMER_DETAILS.accessPolicyName)
    ).not.toBeVisible();
  }

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

  await page.locator('#timezone').fill(data.timezone);
  await page.locator('#timezone').press('Enter');

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

  await page
    .locator('#columnName-select')
    .fill(tableData.columnsName[isUpdate ? 1 : 0]);
  await page.locator('#columnName-select').press('Enter');

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
  data: DataContractSecuritySlaData,
  table: TableClass,
  isUpdate?: boolean
) => {
  await page.getByRole('tab', { name: 'Security' }).click();

  await expect(page.getByTestId('add-policy-button')).toBeDisabled();
  await expect(page.getByTestId('data-classification-input')).toHaveValue(
    data.dataClassificationName
  );

  await expect(page.getByTestId('access-policy-input-0')).toHaveValue(
    data.consumers.accessPolicyName
  );

  // identities value check
  await expect(
    page.getByText(data.consumers.identities.join(''))
  ).toBeVisible();

  //   Verify Consumer information
  for (const filter of data.consumers.row_filters) {
    await expect(
      page
        .getByTestId(`columnName-input-0-${filter.index}`)
        .getByText(table.columnsName[filter.index])
    ).toBeVisible();

    await expect(page.getByText(filter.values.join(''))).toBeVisible();
  }

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

  await expect(page.getByText(data.timezone)).toBeVisible();

  await expect(
    page
      .getByTestId('columnName-select')
      .getByText(table.columnsName[isUpdate ? 1 : 0])
  ).toBeVisible();

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

export const performInitialStepForRules = async (page: Page) => {
  await page.click('[data-testid="contract"]');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
  await expect(page.getByTestId('add-contract-button')).toBeVisible();

  await page.getByTestId('add-contract-button').click();

  await expect(page.getByTestId('add-contract-menu')).toBeVisible();
  await page.getByTestId('create-contract-button').click();

  await expect(page.getByTestId('add-contract-card')).toBeVisible();

  await page.getByTestId('contract-name').fill(DATA_CONTRACT_DETAILS.name);
};

export const navigateToContractTab = async (page: Page) => {
  await page.click('[data-testid="contract"]');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const openContractActionsDropdown = async (page: Page) => {
  await page.getByTestId('manage-contract-actions').click();
  await page.waitForSelector('.contract-action-dropdown', {
    state: 'visible',
  });
};

export const clickAddContractButton = async (page: Page) => {
  await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
  await expect(page.getByTestId('add-contract-button')).toBeVisible();
  await page.getByTestId('add-contract-button').click();
  await expect(page.getByTestId('add-contract-menu')).toBeVisible();
  await page.getByTestId('create-contract-button').click();
  await expect(page.getByTestId('add-contract-card')).toBeVisible();
};

export const clickEditContractButton = async (page: Page) => {
  await openContractActionsDropdown(page);
  await page.getByTestId('contract-edit-button').click();
};

export const deleteContract = async (
  page: Page,
  contractName?: string
): Promise<void> => {
  const deleteContractResponse = page.waitForResponse(
    'api/v1/dataContracts/*?hardDelete=true&recursive=true'
  );

  await openContractActionsDropdown(page);
  await page.getByTestId('delete-contract-button').click();

  if (contractName) {
    await expect(
      page
        .locator('.ant-modal-title')
        .getByText(`Delete dataContract "${contractName}"`)
    ).toBeVisible();
  } else {
    await expect(page.locator('.ant-modal-title')).toBeVisible();
  }

  await page.getByTestId('confirmation-text-input').click();
  await page.getByTestId('confirmation-text-input').fill('DELETE');
  await expect(page.getByTestId('confirm-button')).toBeEnabled();
  await page.getByTestId('confirm-button').click();
  await deleteContractResponse;
};

export const saveContractAndWait = async (page: Page): Promise<void> => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const triggerContractValidation = async (page: Page): Promise<void> => {
  const runNowResponse = page.waitForResponse(
    '/api/v1/dataContracts/*/validate'
  );

  await openContractActionsDropdown(page);
  await page.getByTestId('contract-run-now-button').click();
  await runNowResponse;
};

export const exportContractYaml = async (
  page: Page,
  type: 'native' | 'odcs' = 'native'
): Promise<string> => {
  const downloadPromise = page.waitForEvent('download');

  await openContractActionsDropdown(page);

  if (type === 'odcs') {
    await page.getByTestId('export-odcs-contract-button').click();
  } else {
    await page.getByTestId('export-contract-button').click();
  }

  const download = await downloadPromise;

  return download.suggestedFilename();
};

export const importOdcsViaDropdown = async (
  page: Page,
  yamlContent: string,
  filename: string
): Promise<void> => {
  await page.getByTestId('add-contract-button').click();

  await page.getByTestId('import-odcs-contract-button').click();

  // const importResponse = page.waitForResponse(
  //   '/api/v1/dataContracts/odcs/yaml**'
  // );

  const fileInput = page.getByTestId('file-upload-input');
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'application/yaml',
    buffer: Buffer.from(yamlContent),
  });

  await page.getByTestId('import-button').click();
  // await importResponse;
};

export const importOMViaDropdown = async (
  page: Page,
  yamlContent: string,
  filename: string
): Promise<void> => {
  await page.getByTestId('add-contract-button').click();

  await page.getByTestId('import-openmetadata-contract-button').click();

  const fileInput = page.getByTestId('file-upload-input');
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'application/yaml',
    buffer: Buffer.from(yamlContent),
  });

  await page.getByTestId('import-button').click();
};
