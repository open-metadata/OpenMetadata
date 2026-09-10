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
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';

const CONTRACT_SUCCESS_STATUS = 'Success';
const TERMINAL_CONTRACT_STATUSES = new Set([
  CONTRACT_SUCCESS_STATUS,
  'Aborted',
  'Failed',
  'PartialSuccess',
]);

/**
 * Distinguishes a "the contract really failed" throw from a "we could not
 * observe the result in time" throw. `waitForContractExecutionWithFallback`
 * routes only the latter to the bundle-suite fallback; the former surfaces
 * immediately so a genuine failure lands at its cause instead of being
 * papered over by a broader match downstream.
 */
export class ContractExecutionFailedError extends Error {
  readonly terminalStatus: string;

  constructor(contractId: string, terminalStatus: string) {
    super(
      `Data contract ${contractId} execution ended in "${terminalStatus}" instead of "${CONTRACT_SUCCESS_STATUS}" — the contract check actually failed; inspect the contract's latestResult in the backend for the failing rule.`
    );
    this.name = 'ContractExecutionFailedError';
    this.terminalStatus = terminalStatus;
  }
}

/**
 * Wait for the data-contract validation to reach a terminal state, then
 * assert that state is `Success`.
 *
 * Matching any terminal state as poll-satisfying (the previous behaviour)
 * meant a `Failed` / `Aborted` / `PartialSuccess` validation passed this
 * helper and only surfaced later as an unrelated UI assertion — the report
 * blamed the wrong thing. Splitting the wait (reach terminal) from the
 * assertion (terminal was `Success`) puts the failure on the actual cause.
 */
const pollContractStatus = async (
  page: Page,
  contractId: string,
  timeoutMs = 180_000
): Promise<void> => {
  const { apiContext } = await getApiContext(page);
  let terminalStatus: string | undefined;

  await expect
    .poll(
      async () => {
        const contract = await apiContext
          .get(`/api/v1/dataContracts/${contractId}`)
          .then((r) => (r.ok() ? r.json() : null))
          .catch(() => null);

        const status = contract?.latestResult?.status;
        if (status && TERMINAL_CONTRACT_STATUSES.has(status)) {
          terminalStatus = status;

          return true;
        }

        return false;
      },
      {
        message: `Wait for contract ${contractId} validation to reach a terminal state`,
        timeout: timeoutMs,
        intervals: [3_000, 5_000, 5_000, 10_000, 15_000, 20_000],
      }
    )
    .toBe(true);

  if (terminalStatus !== CONTRACT_SUCCESS_STATUS) {
    throw new ContractExecutionFailedError(contractId, terminalStatus ?? '');
  }
};

export const saveAndTriggerDataContractValidation = async (
  page: Page,
  isContractStatusNotVisible?: boolean
): Promise<object | undefined> => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  const response = await saveContractResponse;
  expect(
    response.ok(),
    `Data contract save failed with status ${response.status()}`
  ).toBe(true);
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

  await page
    .getByTestId('contract-run-now-button')
    .waitFor({ state: 'visible' });

  await page.getByTestId('contract-run-now-button').click();
  await runNowResponse;

  // Poll the API until the validation result reaches a terminal state before
  // reloading the page. Without this, the UI status check immediately after
  // the reload is racy: the backend may still be processing the result.
  if (responseData?.id) {
    await waitForContractExecutionWithFallback(
      page,
      responseData.id,
      responseData.name
    );
  }

  await page.reload();

  await waitForAllLoadersToDisappear(page);

  return responseData;
};

export const validateDataContractInsideBundleTestSuites = async (
  page: Page,
  contractName?: string
) => {
  await sidebarClick(page, SidebarItem.DATA_QUALITY);

  const testSuiteResponse = page.waitForResponse(
    '/api/v1/dataQuality/testSuites/search/list?*'
  );
  await page.getByTestId('test-suites').click();
  await testSuiteResponse;

  const bundleSuitesResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testSuites/search/list') &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );

  await page.getByTestId('bundle-suite-radio-btn').click();

  await bundleSuitesResponse;

  await expect(page.getByTestId('test-suite-table')).toBeVisible();

  // Search by the contract name so the suite row is guaranteed on the first
  // page regardless of how many bundle suites exist (avoids pagination misses).
  if (contractName) {
    const suiteSearchResponse = page.waitForResponse(
      '/api/v1/dataQuality/testSuites/search/list?*'
    );
    await page
      .getByTestId('searchbar-component')
      .locator('input')
      .fill(contractName);
    await suiteSearchResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page
        .getByTestId('test-suite-table')
        .getByRole('rowheader', { name: `Data Contract - ${contractName}` })
    ).toBeVisible();
  }
};

export const waitForDataContractExecution = async (
  page: Page,
  contractId: string,
  maxConsecutiveErrors = 3
) => {
  const { apiContext } = await getApiContext(page);
  let consecutiveErrors = 0;
  let terminalStatus: string | undefined;
  // Note: `Queued` was in the prior terminal-status pattern; it is NOT
  // terminal (the run has not started), so treating it as such let a not-yet-
  // executed contract pass this helper. Removed from the terminal set.

  await expect
    .poll(
      async () => {
        try {
          // Poll the contract entity — latestResult.status is what the backend updates
          // and what the UI reads. Avoids coupling to a resultId that may be stale.
          const contractResponse = await apiContext
            .get(`/api/v1/dataContracts/${contractId}`)
            .then((res) => (res.ok() ? res.json() : null))
            .catch(() => null);

          consecutiveErrors = 0;

          const status = contractResponse?.latestResult?.status;
          if (status && TERMINAL_CONTRACT_STATUSES.has(status)) {
            terminalStatus = status;

            return true;
          }

          return false;
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
        message: `Wait for data contract ${contractId} execution to reach a terminal state`,
        timeout: 600_000,
        intervals: [30_000, 20_000, 10_000],
      }
    )
    .toBe(true);

  if (terminalStatus !== CONTRACT_SUCCESS_STATUS) {
    throw new ContractExecutionFailedError(contractId, terminalStatus ?? '');
  }
};

/**
 * Waits for the data contract execution to complete. If the contract's latestResult
 * is not updated in time (the test suite takes significant time and the contract result
 * propagation lags), falls back to the DataQuality page to verify the test suite results
 * directly from the Bundle Suites list.
 *
 * Returns true if the contract's own result was available, false if the DQ fallback was used.
 */
export const waitForContractExecutionWithFallback = async (
  page: Page,
  contractId: string,
  contractName: string
): Promise<boolean> => {
  try {
    await waitForDataContractExecution(page, contractId);

    return true;
  } catch (error) {
    // A genuine non-success terminal state is not "propagation lag" — the
    // contract actually failed. Rethrow so the assertion lands at its cause
    // instead of getting rerouted into the bundle-suite fallback (whose own
    // status assertion previously accepted the same failure values).
    if (error instanceof ContractExecutionFailedError) {
      throw error;
    }

    // Anything else (poll timeout, transport error) means we could not observe
    // the result in time. Fall back to the DataQuality Bundle Suites page to
    // verify execution status directly.
    await validateDataContractInsideBundleTestSuites(page, contractName);

    const suiteNameCell = page
      .getByTestId('test-suite-table')
      .getByRole('rowheader', {
        name: `Data Contract - ${contractName}`,
      });

    await expect(suiteNameCell).toBeVisible();

    const testCaseListResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list*'
    );
    await suiteNameCell.locator('a').first().click();
    const testCasesJson = await (await testCaseListResponse).json();
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('manage-button')).toBeVisible();

    type TestCaseEntry = { testCaseResult?: { testCaseStatus?: string } };

    const testCases = testCasesJson?.data ?? [];
    const hasFailure = testCases.some(
      (tc: TestCaseEntry) => tc.testCaseResult?.testCaseStatus === 'Failed'
    );
    const hasAborted = testCases.some(
      (tc: TestCaseEntry) => tc.testCaseResult?.testCaseStatus === 'Aborted'
    );
    const hasSuccess = testCases.some(
      (tc: TestCaseEntry) => tc.testCaseResult?.testCaseStatus === 'Success'
    );

    let suiteStatus = 'Running';

    if (hasFailure) {
      suiteStatus = 'Failed';
    } else if (hasAborted) {
      suiteStatus = 'Aborted';
    } else if (hasSuccess) {
      suiteStatus = 'Success';
    }

    // Defence in depth against the same anti-pattern the primary poll fixed:
    // the fallback verifies via the bundle-suite test cases, so its assertion
    // must also require Success rather than merely "reached a terminal state".
    // The previous broad match hid genuine `Failed`/`Aborted`/`PartialSuccess`
    // suites on the fallback path even after the primary path was tightened.
    expect(
      suiteStatus,
      `Data contract "${contractName}" bundle-suite ended in "${suiteStatus}" instead of "${CONTRACT_SUCCESS_STATUS}" — the test suite actually failed; open the suite in the DataQuality UI for the failing test cases.`
    ).toBe(CONTRACT_SUCCESS_STATUS);

    return false;
  }
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

  await page.locator('.ant-picker-dropdown').waitFor({
    state: 'attached',
  });

  await page.getByTestId('availability').fill(data.availability);

  await page.locator('.ant-picker-ok .ant-btn').click();

  await page.locator('#timezone').fill(data.timezone);
  await page.locator('#timezone').press('Enter');

  await page.getByTestId('refresh-frequency-unit-select').click();
  await expect(
    page.locator(
      `.refresh-frequency-unit-select [title*='${data.refreshFrequencyUnitSelect}']`
    )
  ).toBeVisible();
  await page
    .locator(
      `.refresh-frequency-unit-select [title*='${data.refreshFrequencyUnitSelect}']`
    )
    .click();

  await page.getByTestId('max-latency-unit-select').click();
  await expect(
    page.locator(
      `.max-latency-unit-select [title*='${data.maxLatencyUnitSelect}']`
    )
  ).toBeVisible();
  await page
    .locator(`.max-latency-unit-select [title*='${data.maxLatencyUnitSelect}']`)
    .click();

  await page.getByTestId('retention-unit-select').click();
  await expect(
    page.locator(
      `.retention-unit-select [title*='${data.retentionUnitSelect}']`
    )
  ).toBeVisible();
  await page
    .locator(`.retention-unit-select [title*='${data.retentionUnitSelect}']`)
    .click();

  await page
    .locator('#columnName-select')
    .fill(tableData.columnsName[isUpdate ? 1 : 0]);
  await page.locator('#columnName-select').press('Enter');

  await expect(page.getByTestId('save-contract-btn')).not.toBeDisabled();

  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await waitForAllLoadersToDisappear(page);
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
  await waitForAllLoadersToDisappear(page);

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
  await waitForAllLoadersToDisappear(page);
};

export const openContractActionsDropdown = async (page: Page) => {
  await page.getByTestId('manage-contract-actions').click();
  await page.getByTestId('contract-action-dropdown').waitFor({
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
      page.getByTestId('modal-header').getByText(contractName)
    ).toBeVisible();
  } else {
    await expect(page.getByTestId('modal-header')).toBeVisible();
  }

  await page.getByTestId('confirm-button').click();
  await deleteContractResponse;
};

export const saveContractAndWait = async (page: Page): Promise<void> => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts/*');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await waitForAllLoadersToDisappear(page);
};

export const triggerContractValidation = async (
  page: Page,
  contractId?: string
): Promise<void> => {
  const runNowResponse = page.waitForResponse(
    '/api/v1/dataContracts/*/validate'
  );

  await openContractActionsDropdown(page);
  await page.getByTestId('contract-run-now-button').click();
  await runNowResponse;

  // If a contractId is supplied, poll until the validation reaches a terminal
  // state so callers can safely assert on the UI status after a reload.
  if (contractId) {
    await pollContractStatus(page, contractId);
  }
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
