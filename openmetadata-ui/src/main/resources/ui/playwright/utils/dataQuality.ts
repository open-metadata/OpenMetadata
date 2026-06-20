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
import { APIRequestContext, expect, Page, Response } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { TableClass } from '../support/entity/TableClass';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';
import { submitTestCaseForm } from './testCases';

/** Recharts PieChart id for the Test Case Result pie on the Data Quality dashboard. */
export const TEST_CASE_STATUS_PIE_CHART_TEST_ID = 'test-case-result-pie-chart';

/** Recharts PieChart id for the Entity Health Status pie on the Data Quality dashboard. */
export const ENTITY_HEALTH_PIE_CHART_TEST_ID = 'healthy-data-assets-pie-chart';

/** Recharts PieChart id for the Data Assets Coverage pie on the Data Quality dashboard. */
export const DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID =
  'data-assets-coverage-pie-chart';

/**
 * Matches the batched `dataQualityReport` POST the dashboard now fires instead
 * of one GET per widget. The per-aggregation filter (`q`, `index`, ...) lives in
 * the POST body, so pass `bodyToken` (a raw, non-URL-encoded substring) to assert
 * a specific filter reached the API.
 */
export function isDashboardReportBatchResponse(
  res: Response,
  bodyToken?: string
): boolean {
  const request = res.request();
  const isBatch =
    request.url().includes('/dataQuality/testSuites/dataQualityReport/batch') &&
    request.method() === 'POST';
  let matches = isBatch && !bodyToken;

  if (isBatch && bodyToken) {
    const body = request.postData() ?? '';
    matches = body.includes(bodyToken);
    if (!matches) {
      // Dotted FQNs are quoted (e.g. `"x.y"`); their quotes are JSON-escaped in
      // the raw body, so fall back to matching parsed request field values.
      try {
        const parsed = JSON.parse(body) as {
          requests?: Array<{ q?: string; domain?: string }>;
        };
        matches = (parsed.requests ?? []).some(
          (item) =>
            (item.q ?? '').includes(bodyToken) ||
            (item.domain ?? '').includes(bodyToken)
        );
      } catch {
        matches = false;
      }
    }
  }

  return matches;
}

/**
 * Navigate to the Data Quality dashboard (Dashboard sub-tab under Data Quality).
 */
export async function goToDataQualityDashboard(page: Page): Promise<void> {
  await redirectToHomePage(page);
  const dataQualityReportResponse = page.waitForResponse((res) =>
    isDashboardReportBatchResponse(res)
  );
  await sidebarClick(page, SidebarItem.DATA_QUALITY);
  await page.getByTestId('dashboard').click();
  await dataQualityReportResponse;
}

/** Clicks a segment by 0-based index (targets .custom-pie-chart-clickable path). */
export async function clickPieChartSegmentByIndex(
  page: Page,
  chartTestId: string,
  segmentIndex: number
): Promise<void> {
  const chart = page.locator(`#${chartTestId}`);
  await expect(chart).toBeVisible();
  const segmentPath = chart
    .locator('.custom-pie-chart-clickable path')
    .nth(segmentIndex);
  await expect(segmentPath).toBeVisible();
  await segmentPath.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

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
  await submitTestCaseForm(page);

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
  await waitForAllLoadersToDisappear(page);
  const testCaseResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.click('[data-testid="add-test-case-btn"]');
  await testCaseResponse;
  await page
    .locator("[data-testid='test-case-selection-card'] [data-testid='loader']")
    .waitFor({ state: 'detached' });

  const getTestCase = page.waitForResponse(
    `/api/v1/dataQuality/testCases/search/list?*`
  );
  await page.fill('[data-testid="searchbar"]', testCaseName);
  await getTestCase;

  await page.click(`[data-testid="${testCaseName}"]`);
  const updateTestCase = page.waitForResponse(
    '/api/v1/dataQuality/testCases/logicalTestCases/bulk'
  );
  await page.click('[data-testid="submit"]');
  await updateTestCase;
  await page
    .locator('[data-testid="test-case-selection-card"]')
    .waitFor({ state: 'detached' });
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

const ACTION_DROPDOWN_PREFIX = 'action-dropdown-';

export const removeFirstNTestCasesFromLogicalTestSuite = async (
  page: Page,
  count: number
) => {
  const rowActionDropdown = page
    .locator('[data-testid="test-case-table"] tbody')
    .locator(`[data-testid^="${ACTION_DROPDOWN_PREFIX}"]`);

  for (let i = 0; i < count; i++) {
    const trigger = rowActionDropdown.first();
    await trigger.waitFor({ state: 'visible' });
    const fullTestId = await trigger.getAttribute('data-testid');
    const name = fullTestId?.slice(ACTION_DROPDOWN_PREFIX.length) ?? '';

    await trigger.click();
    await page.getByTestId(`remove-${name}`).click();
    const removeResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/logicalTestCases/*/*'
    );
    await page.getByTestId('save-button').click();
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

export const navigateToDataQualityTestCases = async (page: Page) => {
  await sidebarClick(page, SidebarItem.DATA_QUALITY);
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list?*fields=*'
  );
  await page.getByTestId('test-cases').click();
  await listResponse;
  await page.locator('[data-testid="test-case-container"]').waitFor();
};

export const selectTestCasesByCheckbox = async (
  page: Page,
  count: number = 1
) => {
  const rows = page.locator(
    '[data-testid="test-case-table"] tbody tr[data-key]'
  );
  await expect(rows.first()).toBeVisible();

  for (let i = 0; i < count; i++) {
    const checkboxLabel = rows.nth(i).locator('label[slot="selection"]');
    await checkboxLabel.click();
  }
};

export const verifyTestCaseSelectionCount = async (
  page: Page,
  count: number
) => {
  await expect(page.getByText(`${count} test case(s) selected`)).toBeVisible();
  await expect(page.getByTestId('add-selected-to-bundle-suite')).toBeVisible();
};

export const openCreateNewBundleSuiteForm = async (page: Page) => {
  await page.getByTestId('add-selected-to-bundle-suite').click();
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list?*'
  );
  await page.getByTestId('create-new-bundle-suite').click();
  await listResponse;
  await page.locator('form.bundle-suite-form').waitFor();
};

export const fillAndSubmitBundleSuiteForm = async (
  page: Page,
  name: string
) => {
  await page.getByTestId('test-suite-name').fill(name);
  const createResponse = page.waitForResponse('/api/v1/dataQuality/testSuites');
  await page.getByTestId('submit-button').click();
  await createResponse;
};

export const openAddToExistingBundleSuiteModal = async (page: Page) => {
  await page.getByTestId('add-selected-to-bundle-suite').click();
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testSuites/search/list?*'
  );
  await page.getByTestId('add-to-existing-bundle-suite').click();
  await listResponse;
};

export const selectExistingBundleSuite = async (
  page: Page,
  suiteName: string
) => {
  const modal = page.getByRole('dialog', {
    name: 'Add test cases to Bundle Suite',
  });

  await expect(modal).toBeVisible();

  const dropdownInput = modal.getByRole('combobox').first();
  await dropdownInput.click();
  await dropdownInput.fill(suiteName);

  const dropdown = page.locator('.ant-select-dropdown:visible');
  const option = dropdown.locator('.ant-select-item-option', {
    hasText: suiteName,
  });

  await expect(option).toBeVisible();
  await option.click();
};

export const submitAddToExistingBundleSuite = async (page: Page) => {
  const modal = page.getByRole('dialog', {
    name: 'Add test cases to Bundle Suite',
  });

  const addResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/logicalTestCases/bulk'
  );

  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await addResponse;
};

export const verifyBundleSuitePageLoaded = async (
  page: Page,
  suiteName: string,
  expectedTestCaseCount: number
) => {
  await expect(page).toHaveURL(new RegExp(`.*test-suites.*${suiteName}.*`));

  await expect
    .poll(
      async () => {
        const listTestCasesResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.reload();
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId('entity-header-name')).toBeVisible();
        await listTestCasesResponse;

        const rows = await page
          .locator('[data-testid="test-case-table"] tbody tr[data-key]')
          .count();

        return rows;
      },
      {
        timeout: 15000,
        intervals: [3000],
      }
    )
    .toBe(expectedTestCaseCount);
};

/** A `dataQualityReport` call captured for assertion in tests. */
export type CapturedReport = { url: string; q: string; index: string };

/**
 * Subscribes to every `/dataQualityReport` request fired by the page and
 * returns a live array of (url, q, index). Useful for asserting which
 * indices were queried and what filter the dashboard sent.
 */
export function captureReports(page: Page): CapturedReport[] {
  const captured: CapturedReport[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/dataQualityReport')) {
      return;
    }

    // The dashboard batches every aggregation into one POST body; flatten each
    // item back into a CapturedReport so callers keep asserting on q/index.
    if (url.includes('/dataQualityReport/batch')) {
      const body = req.postData();
      if (!body) {
        return;
      }
      const parsed = JSON.parse(body) as {
        requests?: Array<{ q?: string; index?: string }>;
      };
      for (const item of parsed.requests ?? []) {
        captured.push({ url, q: item.q ?? '', index: item.index ?? '' });
      }

      return;
    }

    const u = new URL(url);
    captured.push({
      url,
      q: u.searchParams.get('q') ?? '',
      index: u.searchParams.get('index') ?? '',
    });
  });

  return captured;
}

async function applyDashboardTagBasedFilter(
  page: Page,
  options: {
    buttonName: 'Tier' | 'Tag' | 'Certification';
    searchText: string;
    optionFqn: string;
  }
): Promise<void> {
  const { buttonName, searchText, optionFqn } = options;

  await page.getByRole('button', { name: buttonName }).click();
  await page.getByTestId('search-input').click();

  const searchRes = page.waitForResponse((res) => {
    if (!res.url().includes('/api/v1/search/query')) {
      return false;
    }
    const parsed = new URL(res.url());
    return (
      parsed.searchParams.get('index') === 'tag' &&
      (parsed.searchParams.get('q') ?? '').includes(`*${searchText}*`)
    );
  });
  await page.getByTestId('search-input').fill(searchText);
  await searchRes;

  await page.getByTestId(optionFqn).click();

  const reportRes = page.waitForResponse((res) =>
    isDashboardReportBatchResponse(res, optionFqn)
  );
  await page.getByTestId('update-btn').click();
  await reportRes;
}

export async function applyDashboardTierFilter(
  page: Page,
  tierFqn: string
): Promise<void> {
  await applyDashboardTagBasedFilter(page, {
    buttonName: 'Tier',
    searchText: tierFqn,
    optionFqn: tierFqn,
  });
}

export async function applyDashboardTagFilter(
  page: Page,
  tagName: string,
  tagFqn: string
): Promise<void> {
  await applyDashboardTagBasedFilter(page, {
    buttonName: 'Tag',
    searchText: tagName,
    optionFqn: tagFqn,
  });
}

export async function applyDashboardCertificationFilter(
  page: Page,
  certName: string,
  certFqn: string
): Promise<void> {
  await applyDashboardTagBasedFilter(page, {
    buttonName: 'Certification',
    searchText: certName,
    optionFqn: certFqn,
  });
}

/**
 * Polls the incident status API until an incident for `testCaseFqn` appears
 * within the [failTs-60s, failTs+120s] window.
 * Call this immediately after `addTestCaseResult` to guarantee the incident
 * document is indexed before any UI assertions.
 * Pass `expectedStatus` to also wait until the incident reaches that resolution
 * status (e.g. "Resolved") — useful after posting a status transition.
 */
export async function waitForIncidentToBeIndexed(
  apiContext: APIRequestContext,
  testCaseFqn: string,
  failTs: number,
  expectedStatus?: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true` +
            `&startTs=${failTs - 60_000}` +
            `&endTs=${failTs + 120_000}`
        );
        const body = await res.json();

        return (body.data ?? []).some(
          (i: {
            testCaseReference?: { fullyQualifiedName?: string };
            testCaseResolutionStatusType?: string;
          }) => {
            if (i.testCaseReference?.fullyQualifiedName !== testCaseFqn) {
              return false;
            }

            return expectedStatus
              ? i.testCaseResolutionStatusType === expectedStatus
              : true;
          }
        );
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toBe(true);
}

/**
 * Asserts that a dimension card (StatusCardWidget) on the Data Quality dashboard
 * shows the expected total, success, failed, and aborted counts.
 * Uses a generous timeout on total-value to accommodate ES indexing lag; the
 * subsequent count assertions run immediately once data is loaded.
 */
export async function assertDimensionCard(
  page: Page,
  dimension: string,
  expected: {
    total: string;
    success: string;
    failed: string;
    aborted: string;
  }
): Promise<void> {
  const card = page.locator('[data-testid="status-data-widget"]').filter({
    has: page
      .locator('[data-testid="status-title"]')
      .filter({ hasText: dimension }),
  });
  await expect(card.getByTestId('total-value')).toHaveText(expected.total);
  await expect(card.getByTestId('success-count')).toHaveText(expected.success);
  await expect(card.getByTestId('failed-count')).toHaveText(expected.failed);
  await expect(card.getByTestId('aborted-count')).toHaveText(expected.aborted);
}

/**
 * Asserts the legend counts inside a pie chart widget.
 * `legendCounts` maps the legend item name (lowercase) to the expected count
 * string, e.g. `{ success: '4', failed: '4', aborted: '4' }`.
 * Uses the `data-testid="legend-count-{name}"` attribute added to
 * CustomPieChart legend items.
 */
export async function assertPieChartLegendCounts(
  page: Page,
  widgetTestId: string,
  legendCounts: Record<string, string>
): Promise<void> {
  const widget = page.locator(`[data-testid="${widgetTestId}"]`);
  for (const [name, count] of Object.entries(legendCounts)) {
    await expect(
      widget.getByTestId(`legend-count-${name.toLowerCase()}`)
    ).toHaveText(count);
  }
}

/**
 * Asserts that captured dataQualityReport requests referencing `filterFqn`
 * contain `expectedField` in the ES query JSON.
 * Pass `notExpectedPattern` to guard against a field that must NOT appear
 * (e.g. a regression check for an old wrong field path).
 */
export function assertEsFieldInReports(
  reports: CapturedReport[],
  filterFqn: string,
  expectedField: string,
  notExpectedPattern?: string
): void {
  const matching = reports.filter((r) => r.q.includes(filterFqn));

  expect(matching.length).toBeGreaterThan(0);

  for (const report of matching) {
    const queryStr = JSON.stringify(JSON.parse(report.q));

    expect(queryStr).toContain(expectedField);
    if (notExpectedPattern) {
      expect(queryStr).not.toContain(notExpectedPattern);
    }
  }
}
