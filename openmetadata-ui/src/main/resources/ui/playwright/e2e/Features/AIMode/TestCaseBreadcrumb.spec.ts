/*
 *  Copyright 2026 Collate.
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
import { expect, Page, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext } from '../../../utils/common';
import { enableAiAppMode, redirectToAiModeHomePage } from '../../Utils/appMode';

// REGRESSION GUARD for the AI-mode test-case/incident detail breadcrumb.
//
// The origin trail travels in react-router navigation state as
// `location.state.breadcrumbData`. The AI renderer (TestCaseDetailAi) must give
// it precedence over the FQN-derived asset trail, so the breadcrumb reflects
// where the user came from rather than always showing service > db > schema >
// table. The asset trail is only the fallback for deep links and refreshes.
//
// Breadcrumbs are per-renderer chrome, which is exactly why this regressed in
// AI mode after OSS fixed it — hence an AI-specific spec.

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const BREADCRUMB = 'breadcrumb';
const OBSERVABILITY_CRUMB = 'Observability';

/**
 * MUST stay scoped to the detail header: `data-testid="breadcrumb"` is not
 * unique on this page — the surrounding page shell renders one too. An
 * unscoped locator is a strict-mode violation at best, and at worst silently
 * reads the wrong trail depending on which shell has rendered yet.
 */
const detailBreadcrumb = (page: Page) =>
  page.getByTestId('test-case-header-container').getByTestId(BREADCRUMB);

/**
 * Every AI-mode observability breadcrumb is headed by an icon-only module crumb
 * linking to /observability. So the *first trail crumb* — the one this fix is
 * about — is always link index 1.
 *
 * Using the link role (not text) keeps this stable against the 256px label
 * truncation, and skips the collapse "..." control, which renders as a button.
 * We deliberately do NOT assert `href`: HeaderBreadcrumb always passes
 * `onAction`, and the core component drops `href` when it does, navigating via
 * onPress instead.
 */
const firstTrailCrumb = (page: Page) =>
  // eslint-disable-next-line om-playwright/no-positional-locator -- position IS the assertion: index 0 is the fixed observability crumb, so index 1 is whatever origin the trail led with
  detailBreadcrumb(page).getByRole('link').nth(1);

const currentCrumb = (page: Page) =>
  detailBreadcrumb(page).locator('[aria-current="page"]');

// The detail route is code-split and fetches before it paints, so the default
// 5s expect timeout is a little tight on a cold chunk. Measured render is
// 1-3s; 15s is ample headroom without turning a real breakage into a long
// stall. Gate on the URL first (deterministic), then wait on the render.
const DETAIL_PAGE_TIMEOUT = 15_000;

const expectDetailPageLoaded = async (page: Page) => {
  await page.waitForURL(/\/observability\/test-case\//, {
    timeout: DETAIL_PAGE_TIMEOUT,
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('test-case-detail-page')).toBeVisible({
    timeout: DETAIL_PAGE_TIMEOUT,
  });
  await expect(detailBreadcrumb(page)).toBeVisible({
    timeout: DETAIL_PAGE_TIMEOUT,
  });
};

const gotoTestCaseDirectly = async (page: Page, testCaseFqn: string) => {
  await page.goto(
    `/observability/test-case/${encodeURIComponent(
      testCaseFqn
    )}/test-case-results`,
    { waitUntil: 'domcontentloaded' }
  );
  await expectDetailPageLoaded(page);
};

const openTestCaseFromDataQualityList = async (
  page: Page,
  testCaseName: string
) => {
  await page.goto('/observability/data-quality/test-cases', {
    waitUntil: 'domcontentloaded',
  });

  // Filter so the row can never be pushed onto a later page by unrelated test
  // cases left behind by other specs. The input is debounced by 500ms.
  await page
    .getByTestId('searchbar-component')
    .locator('input')
    .fill(testCaseName);

  // The listing is search-backed, so a just-created test case is not queryable
  // the instant the create call returns. Wait on the *filtered row* rather than
  // polling the search API: the input above narrows to this unique name, so
  // this is unaffected by how many test cases the instance holds.
  const row = page.getByTestId(testCaseName).getByRole('link');
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expectDetailPageLoaded(page);
};

const openTestCaseFromIncidentList = async (
  page: Page,
  testCaseName: string
) => {
  await page.goto('/observability/incident-manager', {
    waitUntil: 'domcontentloaded',
  });

  // Same as above, but this listing also waits on the resolution-status
  // pipeline, which lags the plain test-case index — hence the larger bound.
  const row = page.getByTestId(`test-case-${testCaseName}`);
  await expect(row).toBeVisible({ timeout: 40_000 });
  await row.click();
  await expectDetailPageLoaded(page);
};

test.describe('AI Observability - test case detail breadcrumb origin', () => {
  const table = new TableClass();

  let testCaseName = '';
  let testCaseFqn = '';
  let incidentTestCaseName = '';
  let tableName = '';

  test.beforeAll(async ({ browser }) => {
    // Creating the table, its test suite + pipelines, two test cases and a
    // result has been measured past the default 60s hook timeout on a loaded
    // backend. This covers entity setup only — the tests themselves run on the
    // default timeout.
    test.setTimeout(120_000);

    const setupPage = await browser.newPage();
    await redirectToAiModeHomePage(setupPage);
    const { apiContext, afterAction } = await getApiContext(setupPage);

    await table.create(apiContext);
    await table.createTestSuiteAndPipelines(apiContext);

    tableName = table.entity.name;

    // Test case used for the Data Quality origin, the deep-link fallback and
    // the in-page navigation guard.
    const testCase = await table.createTestCase(apiContext);
    testCaseName = testCase?.name;
    testCaseFqn = testCase?.fullyQualifiedName;

    // A second, dedicated test case driven to Failed so it surfaces on the
    // incident listing. Kept separate so the incident does not alter the
    // status of the test case used by the other assertions.
    const incidentTestCase = await table.createTestCase(apiContext);
    incidentTestCaseName = incidentTestCase?.name;

    await table.addTestCaseResult(
      apiContext,
      incidentTestCase?.fullyQualifiedName,
      {
        result: 'breadcrumb origin regression guard',
        testCaseStatus: 'Failed',
        timestamp: Date.now(),
      }
    );

    await afterAction();
    await setupPage.close();
  });

  test.afterAll(async ({ browser }) => {
    const teardownPage = await browser.newPage();
    const { apiContext, afterAction } = await getApiContext(teardownPage);

    await table.delete(apiContext);

    await afterAction();
    await teardownPage.close();
  });

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  test('leads with Data Quality when opened from the test cases tab', async ({
    page,
  }) => {
    await openTestCaseFromDataQualityList(page, testCaseName);

    // THE REGRESSION: before the fix this was the table asset trail regardless
    // of where the user came from.
    await expect(firstTrailCrumb(page)).toHaveAccessibleName('Data Quality');
    await expect(currentCrumb(page)).toHaveText(testCaseName);
  });

  test('keeps the Data Quality origin when switching tabs on the detail page', async ({
    page,
  }) => {
    await openTestCaseFromDataQualityList(page, testCaseName);
    await expect(firstTrailCrumb(page)).toHaveAccessibleName('Data Quality');

    // Tab navigation must forward location.state, otherwise the origin crumb is
    // lost on the very first tab switch and the trail silently reverts to the
    // asset path. Index 1 rather than a fixed id so the guard holds whichever
    // optional tabs this test case exposes.
    // eslint-disable-next-line om-playwright/no-positional-locator -- index rather than a fixed id so the guard holds whichever optional tabs this test case exposes
    const secondTab = page.getByTestId('tabs').getByRole('tab').nth(1);
    await secondTab.click();

    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
    await expect(firstTrailCrumb(page)).toHaveAccessibleName('Data Quality');
  });

  test('leads with Incident Manager when opened from the incident listing', async ({
    page,
  }) => {
    // 40s row bound + navigation can top the 60s default. Sized from that
    // bound, not guessed.
    test.setTimeout(90_000);

    await openTestCaseFromIncidentList(page, incidentTestCaseName);

    await expect(firstTrailCrumb(page)).toHaveAccessibleName(
      'Incident Manager'
    );
    await expect(currentCrumb(page)).toHaveText(incidentTestCaseName);
  });

  test('falls back to the table asset trail on a deep link', async ({
    page,
  }) => {
    await gotoTestCaseDirectly(page, testCaseFqn);

    // No origin context exists, so the trail is derived from the test case FQN.
    // With maxItems=3 the middle crumbs collapse behind a "..." control, which
    // leaves the table as the first visible trail crumb.
    await expect(firstTrailCrumb(page)).toHaveAccessibleName(tableName);
    await expect(currentCrumb(page)).toHaveText(testCaseName);

    await expect(
      detailBreadcrumb(page).getByRole('link', { name: 'Data Quality' })
    ).toHaveCount(0);
    await expect(
      detailBreadcrumb(page).getByRole('link', { name: 'Incident Manager' })
    ).toHaveCount(0);
  });

  test('keeps the origin across a reload, since history state survives', async ({
    page,
  }) => {
    // 30s row bound plus a second full page load after the reload.
    test.setTimeout(90_000);

    await openTestCaseFromDataQualityList(page, testCaseName);
    await expect(firstTrailCrumb(page)).toHaveAccessibleName('Data Quality');

    // A reload does NOT lose the origin: `location.state` is backed by
    // `history.state`, which the browser persists on the session-history entry,
    // so react-router restores it. Only a genuinely fresh navigation (the
    // deep-link case above) has no origin. Asserted explicitly because it is
    // easy to assume the opposite and "fix" the fallback in the wrong
    // direction.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectDetailPageLoaded(page);

    await expect(firstTrailCrumb(page)).toHaveAccessibleName('Data Quality');
  });

  test('always heads the trail with the observability module crumb', async ({
    page,
  }) => {
    await gotoTestCaseDirectly(page, testCaseFqn);

    await expect(
      // eslint-disable-next-line om-playwright/no-positional-locator -- the trail head is defined by position; that it is the observability crumb is the assertion
      detailBreadcrumb(page).getByRole('link').first()
    ).toHaveAccessibleName(OBSERVABILITY_CRUMB);
  });
});
