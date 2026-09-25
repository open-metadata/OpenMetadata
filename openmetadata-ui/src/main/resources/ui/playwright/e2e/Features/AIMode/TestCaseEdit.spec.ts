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
import { expect, Page, Response, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode, redirectToAiModeHomePage } from '../../Utils/appMode';

// The AI observability pages open the shared TestCaseFormDrawer in
// `variant="modal"` WITHOUT a `table` prop, so the table's columns load
// asynchronously via getTableDetailsByFQN. These specs cover the migrated form
// end-to-end in that AI-modal context: the edit-prefill regressions the async
// path is prone to (a react-aria Select dropping a selectedKey before its
// options load), the edit save round-trip, and the full create flow (table +
// searchable test-type dropdown + parameters + submit).
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const openEditModal = async (page: Page, testCaseFqn: string) => {
  await page.goto(
    `/observability/test-case/${encodeURIComponent(
      testCaseFqn
    )}/test-case-results`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('test-case-detail-page')).toBeVisible();

  // manage dropdown -> Dimensions (edit-dimensions) opens the prefilled form.
  // The label renders data-testid="profiler-setting-button".
  await page.getByTestId('manage-button').click();
  await page.getByTestId('profiler-setting-button').click();
};

test.describe('AI Observability - test case edit modal', () => {
  const table = new TableClass();
  let columnTestCaseFqn = '';
  let editTestCaseFqn = '';
  let columnName = '';

  test.beforeAll(async ({ browser }) => {
    const setupPage = await browser.newPage();
    await redirectToAiModeHomePage(setupPage);
    const { apiContext, afterAction } = await getApiContext(setupPage);

    await table.create(apiContext);
    await table.createTestSuiteAndPipelines(apiContext);

    columnName = table.columnsName[0];
    const columnTestCase = await table.createTestCase(apiContext, {
      entityLink: `<#E::table::${table.entityResponseData?.['fullyQualifiedName']}::columns::${columnName}>`,
      testDefinition: 'columnValueMaxToBeBetween',
      parameterValues: [
        { name: 'minValueForMaxInCol', value: '50' },
        { name: 'maxValueForMaxInCol', value: '100' },
      ],
    });
    columnTestCaseFqn = columnTestCase?.fullyQualifiedName;

    // A second, dedicated column-level test case so the save round-trip can
    // mutate parameters without affecting the read-only prefill assertions.
    const editTestCase = await table.createTestCase(apiContext, {
      entityLink: `<#E::table::${table.entityResponseData?.['fullyQualifiedName']}::columns::${columnName}>`,
      testDefinition: 'columnValueMaxToBeBetween',
      parameterValues: [
        { name: 'minValueForMaxInCol', value: '50' },
        { name: 'maxValueForMaxInCol', value: '100' },
      ],
    });
    editTestCaseFqn = editTestCase?.fullyQualifiedName;

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

  test('edit modal prefills the column-level test case', async ({ page }) => {
    await openEditModal(page, columnTestCaseFqn);

    // REGRESSION GUARD: the column select must display the prefilled column,
    // not a blank placeholder, even though its options load asynchronously.
    const columnSelectTrigger = page
      .getByTestId('selectedColumn')
      .getByRole('button');
    await expect(columnSelectTrigger).toContainText(columnName);

    // Parameters must render and carry their saved values.
    await expect(
      page.locator('#testCaseFormV1_params_minValueForMaxInCol')
    ).toHaveValue('50');
    await expect(
      page.locator('#testCaseFormV1_params_maxValueForMaxInCol')
    ).toHaveValue('100');
  });

  test('keeps the prefilled column visible while table columns are still loading', async ({
    page,
  }) => {
    await page.goto(
      `/observability/test-case/${encodeURIComponent(
        columnTestCaseFqn
      )}/test-case-results`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForAllLoadersToDisappear(page);

    // Hold the table-details fetch open so the column-options list stays empty
    // for the whole assertion window. The column select must still show the
    // prefilled value because the form folds the selected value into its
    // options; without that it would render the placeholder until this
    // 30s-delayed response arrives, well past the 10s assertion timeout.
    await page.route('**/api/v1/tables/name/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await route.continue();
    });

    await page.getByTestId('manage-button').click();
    await page.getByTestId('profiler-setting-button').click();

    const columnSelectTrigger = page
      .getByTestId('selectedColumn')
      .getByRole('button');
    await expect(columnSelectTrigger).toContainText(columnName, {
      timeout: 10000,
    });
  });

  test('saves an edited parameter (edit round-trip)', async ({ page }) => {
    await openEditModal(page, editTestCaseFqn);

    const maxParam = page.locator('#testCaseFormV1_params_maxValueForMaxInCol');
    await expect(maxParam).toHaveValue('100');
    await maxParam.fill('200');

    const patchResponse = page.waitForResponse(
      (response: Response) =>
        response.url().includes('/api/v1/dataQuality/testCases') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('create-btn').click();
    const response = await patchResponse;

    expect(response.status()).toBe(200);
    // The persisted patch must carry the new parameter value.
    const patched = await response.json();
    const savedMax = (patched?.parameterValues ?? []).find(
      (param: { name: string }) => param.name === 'maxValueForMaxInCol'
    );
    expect(savedMax?.value).toBe('200');
  });

  test('renders parameters immediately while the test-definition list loads', async ({
    page,
  }) => {
    await page.goto(
      `/observability/test-case/${encodeURIComponent(
        columnTestCaseFqn
      )}/test-case-results`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForAllLoadersToDisappear(page);

    // Delay only the test-definition LIST (used for the type dropdown); the
    // targeted getTestDefinitionById the drawer uses for edit stays fast. With
    // the flicker fix the parameter section renders from that resolved
    // definition; without it, params stay unmounted until this 30s-delayed list
    // resolves, well past the 10s assertion.
    await page.route(
      (url) => /\/api\/v1\/dataQuality\/testDefinitions\?/.test(url.toString()),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        await route.continue();
      }
    );

    await page.getByTestId('manage-button').click();
    await page.getByTestId('profiler-setting-button').click();

    await expect(
      page.locator('#testCaseFormV1_params_maxValueForMaxInCol')
    ).toHaveValue('100', { timeout: 10000 });
  });

  test('creates a table-level test case from the data-quality page', async ({
    page,
  }) => {
    await page.goto('/observability/data-quality/test-cases', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('add-test-case-btn').click();
    await page.getByTestId('test-case-form-v1').waitFor({ state: 'visible' });

    // Select the table (async search) — the form opens without a table prop.
    await page.click('[id="root\\/table"]');
    const tableSearch = page.waitForResponse(
      '/api/v1/search/query?*index=table*'
    );
    await page.fill('[id="root\\/table"]', table.entity.name);
    await tableSearch;
    // eslint-disable-next-line om-playwright/no-positional-locator -- already narrowed by FQN; .first() only guards against a longer FQN that contains this one as a prefix
    await page
      .getByRole('option')
      .filter({ hasText: table.entityResponseData.fullyQualifiedName })
      .first()
      .click();

    const testCaseName = `pw_ai_create_${uuid()}`;
    await page
      .getByTestId('test-case-name')
      .locator('input')
      .fill(testCaseName);

    // Searchable test-type dropdown: type to filter, then pick the option.
    await page.click('[id="root\\/testType"]');
    await page.fill('[id="root\\/testType"]', 'Table Row Count To Be Between');
    // eslint-disable-next-line om-playwright/no-positional-locator -- already narrowed by name; .first() guards against sibling definitions sharing this prefix
    await page
      .getByRole('option')
      .filter({ hasText: 'Table Row Count To Be Between' })
      .first()
      .click();

    await page.fill('#testCaseFormV1_params_minValue', '5');
    await page.fill('#testCaseFormV1_params_maxValue', '50');

    const createResponse = page.waitForResponse(
      (response: Response) =>
        response.url().includes('/api/v1/dataQuality/testCases') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('create-btn').click();
    const response = await createResponse;

    expect(response.status()).toBe(201);
    const created = await response.json();
    expect(created?.name).toBe(testCaseName);
  });
});
