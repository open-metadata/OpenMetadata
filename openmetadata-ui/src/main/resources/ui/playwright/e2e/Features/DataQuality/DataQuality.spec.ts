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
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_INGESTION_TAG_OBJ,
} from '../../../constant/config';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  assignSingleSelectDomain,
  clickOutside,
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
  waitForToastToDisappear,
} from '../../../utils/common';
import {
  dismissTagSuggestions,
  ObservabilityFeature,
  selectAddObservabilityFeature,
  selectTestType,
  waitForIncidentToBeIndexed,
} from '../../../utils/dataQuality';
import {
  customFormatDateTime,
  getCurrentMillis,
} from '../../../utils/dateTime';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';
import {
  deleteTestCase,
  submitTestCaseForm,
  verifyIncidentBreadcrumbsFromTablePageRedirect,
  verifyTestCaseLastRunBanner,
  visitDataQualityTab,
  waitForTestCaseDetailsResponse,
} from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

// Test data for tags and glossary terms
const testClassification = new ClassificationClass();
const testTag1 = new TagClass({
  classification: testClassification.data.name,
});
const testTag2 = new TagClass({
  classification: testClassification.data.name,
});
const testGlossary = new Glossary();
const testGlossaryTerm1 = new GlossaryTerm(testGlossary);
const testGlossaryTerm2 = new GlossaryTerm(testGlossary);

const testCaseResult = {
  result: 'Found min=10001, max=27809 vs. the expected min=90001, max=96162.',
  testCaseStatus: 'Failed',
  testResultValue: [
    {
      name: 'minValueForMaxInCol',
      value: '10001',
    },
    {
      name: 'maxValueForMaxInCol',
      value: '27809',
    },
  ],
  timestamp: getCurrentMillis(),
};

test.describe(
  'Data Quality',
  {
    tag: [
      `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`,
      PLAYWRIGHT_INGESTION_TAG_OBJ.tag,
    ],
  },
  () => {
    let table1: TableClass;
    let table2: TableClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      table1 = new TableClass();
      table2 = new TableClass();
      await table1.create(apiContext);
      await table2.create(apiContext);
      const testCase = await table2.createTestCase(apiContext, {
        name: `email_column_values_to_be_in_set_${uuid()}`,
        entityLink: `<#E::table::${table2.entityResponseData?.['fullyQualifiedName']}::columns::${table2.entity?.columns[3].name}>`,
        parameterValues: [
          { name: 'allowedValues', value: '["gmail","yahoo","collate"]' },
        ],
        testDefinition: 'columnValuesToBeInSet',
      });

      // Create test case result
      await table2.addTestCaseResult(
        apiContext,
        testCase['fullyQualifiedName'],
        testCaseResult
      );

      // Create test tags and glossary terms
      await testClassification.create(apiContext);
      await testTag1.create(apiContext);
      await testTag2.create(apiContext);
      await testGlossary.create(apiContext);
      await testGlossaryTerm1.create(apiContext);
      await testGlossaryTerm2.create(apiContext);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table1.delete(apiContext);
      await table2.delete(apiContext);

      // Clean up test tags and glossary terms
      await testGlossaryTerm1.delete(apiContext);
      await testGlossaryTerm2.delete(apiContext);
      await testGlossary.delete(apiContext);
      await testTag1.delete(apiContext);
      await testTag2.delete(apiContext);
      await testClassification.delete(apiContext);

      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    /**
     * Data Quality — Comprehensive Coverage
     * @description Validates test case creation, editing, deletion, and tagging across table and column levels.
     * Covers Data Quality tab interactions, incident navigation, and domain assignment.
     *
     * Preconditions
     * - Admin-authenticated session.
     * - Two tables created; table2 has a pre-existing test case with results.
     * - Classifications, tags, and glossary terms are provisioned.
     *
     * Coverage
     * - Test Cases: Create/Edit/Delete at table and column levels with tags and glossary terms.
     * - Data Quality Tab: Navigation, test case list, filtering, and sorting.
     * - Incidents: Breadcrumb navigation from test case to incident page.
     * - Domains: Assignment and filtering.
     *
     * API Interactions
     * - POST `/api/v1/dataQuality/testCases*` for test case creation/updates.
     * - GET `/api/v1/dataQuality/testCases*` for fetching test cases.
     * - GET/POST for tag and glossary term search and assignment.
     * - Ingestion pipeline endpoints for test case deployment.
     */

    /**
     * Table test case
     * @description Creates, edits, and deletes a table-level test case with tags and glossary terms.
     * Verifies incident breadcrumb navigation and test case property changes.
     */
    test('Table test case', async ({ page }) => {
      test.slow();

      const NEW_TABLE_TEST_CASE = {
        name: `table_column_name_to_exist_in_id_${uuid()}`,
        label: 'Table Column Name To Exist',
        type: 'tableColumnNameToExist',
        field: 'testCase',
        description: 'New table test case for TableColumnNameToExist',
      };
      await visitDataQualityTab(page, table1);

      await page.click('[data-testid="profiler-add-table-test-btn"]');
      await selectAddObservabilityFeature(page, ObservabilityFeature.TEST_CASE);

      /**
       * Step: Create table test case
       * @description Creates a table-level test case with name, type, parameters, tags, and glossary terms.
       * Deploys the test case via ingestion pipeline.
       */
      await test.step('Create', async () => {
        await page.fill(
          '[data-testid="test-case-name"] input',
          NEW_TABLE_TEST_CASE.name
        );
        await selectTestType(page, NEW_TABLE_TEST_CASE.label);
        await page.fill(
          '#testCaseFormV1_params_columnName',
          NEW_TABLE_TEST_CASE.field
        );
        await page
          .getByTestId('test-case-form-v1')
          .locator(descriptionBox)
          .fill(NEW_TABLE_TEST_CASE.description);

        // Add tags to test case
        await page.click('[data-testid="tags-selector"] input');
        const tagsSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=tag*`
        );
        await page.fill(
          '[data-testid="tags-selector"] input',
          testTag1.data.name
        );
        await tagsSearchResponse;
        await page
          .getByTestId(`tag-option-${testTag1.responseData.fullyQualifiedName}`)
          .click();

        await dismissTagSuggestions(page);
        // Add glossary terms to test case
        await page.click('[data-testid="glossary-terms-selector"] input');
        const glossarySearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=glossaryTerm*`
        );
        await page.fill(
          '[data-testid="glossary-terms-selector"] input',
          testGlossaryTerm1.data.name
        );
        await glossarySearchResponse;
        await page
          .getByTestId(
            `tag-option-${testGlossaryTerm1.responseData.fullyQualifiedName}`
          )
          .click();

        await dismissTagSuggestions(page);
        await submitTestCaseForm(page);

        await expect(page.getByTestId(NEW_TABLE_TEST_CASE.name)).toBeVisible();
      });

      /**
       * Step: Edit test case
       * @description Modifies test case parameters, replaces tags and glossary terms, and verifies updates persist.
       */
      await test.step('Edit', async () => {
        await page
          .getByTestId(`action-dropdown-${NEW_TABLE_TEST_CASE.name}`)
          .click();
        await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);

        await expect(page.getByTestId('form-heading')).toHaveText(
          `Edit ${NEW_TABLE_TEST_CASE.name}`
        );

        await page.locator('#testCaseFormV1_params_columnName').clear();
        await page.fill('#testCaseFormV1_params_columnName', 'new_column_name');

        // Remove existing tag and add new one
        await page
          .locator(
            '[data-testid="tags-selector"] [data-testid="tag-suggestion"] button'
          )
          .first()
          .click();

        await page.click('[data-testid="tags-selector"] input');
        const newTagsSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=tag*`
        );
        await page.fill(
          '[data-testid="tags-selector"] input',
          testTag2.data.name
        );
        await newTagsSearchResponse;
        await page
          .getByTestId(`tag-option-${testTag2.responseData.fullyQualifiedName}`)
          .click();

        await dismissTagSuggestions(page);

        // Remove existing glossary term and add new one
        await page
          .locator(
            '[data-testid="glossary-terms-selector"] [data-testid="tag-suggestion"] button'
          )
          .first()
          .click();
        await page.click('[data-testid="glossary-terms-selector"] input');
        const newGlossarySearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=glossaryTerm*`
        );
        await page.fill(
          '[data-testid="glossary-terms-selector"] input',
          testGlossaryTerm2.data.name
        );
        await newGlossarySearchResponse;
        await page
          .getByTestId(
            `tag-option-${testGlossaryTerm2.responseData.fullyQualifiedName}`
          )
          .click();

        await dismissTagSuggestions(page);

        const updateTestCaseResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/*'
        );

        await page.getByTestId('create-btn').click();
        await updateTestCaseResponse;
        const updateSuccessMessage = 'Test case updated successfully.';
        await toastNotification(page, updateSuccessMessage);
        await waitForToastToDisappear(page, updateSuccessMessage);

        await page
          .getByTestId(`action-dropdown-${NEW_TABLE_TEST_CASE.name}`)
          .click();

        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions/*'
        );
        await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);
        await testDefinitionResponse;

        await page.locator('#testCaseFormV1_params_columnName').waitFor();

        await expect(
          page.locator('#testCaseFormV1_params_columnName')
        ).toHaveValue('new_column_name');

        await page.getByRole('button', { name: 'Cancel' }).click();
      });

      /**
       * Step: Incident page redirect
       * @description Navigates to incident page via test case menu and verifies breadcrumb navigation.
       */
      await test.step('Redirect to IncidentPage and verify breadcrumb', async () => {
        await verifyIncidentBreadcrumbsFromTablePageRedirect(
          page,
          table1,
          NEW_TABLE_TEST_CASE.name
        );
      });

      /**
       * Step: Delete test case
       * @description Removes the test case and confirms deletion.
       */
      await test.step('Delete', async () => {
        await deleteTestCase(page, NEW_TABLE_TEST_CASE.name);
      });
    });

    /**
     * Column test case
     * @description Creates, edits, and deletes a column-level test case with tags and glossary terms.
     * Validates parameter changes and property persistence.
     */
    test('Column test case', async ({ page }) => {
      test.slow();

      const NEW_COLUMN_TEST_CASE = {
        name: 'email_column_value_lengths_to_be_between',
        column: table1.entity?.columns[3].name,
        type: 'columnValueLengthsToBeBetween',
        label: 'Column Value Lengths To Be Between',
        min: '3',
        max: '6',
        description: 'New table test case for columnValueLengthsToBeBetween',
      };

      await visitDataQualityTab(page, table1);
      await page.click('[data-testid="profiler-add-table-test-btn"]');
      await selectAddObservabilityFeature(page, ObservabilityFeature.TEST_CASE);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      /**
       * Step: Create column test case
       * @description Creates a column-level test case by selecting a column, configuring test parameters,
       * and adding tags and glossary terms.
       */
      await test.step('Create', async () => {
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR&supportedService=Mysql*'
        );
        await page.click('[id="root\\/column"]');
        await page
          .getByRole('option')
          .filter({ hasText: NEW_COLUMN_TEST_CASE.column })
          .first()
          .click();
        await testDefinitionResponse;

        await page.fill(
          '[data-testid="test-case-name"] input',
          NEW_COLUMN_TEST_CASE.name
        );
        await selectTestType(page, NEW_COLUMN_TEST_CASE.label);
        await page.fill(
          '#testCaseFormV1_params_minLength',
          NEW_COLUMN_TEST_CASE.min
        );
        await page.fill(
          '#testCaseFormV1_params_maxLength',
          NEW_COLUMN_TEST_CASE.max
        );
        await page
          .getByTestId('test-case-form-v1')
          .locator(descriptionBox)
          .fill(NEW_COLUMN_TEST_CASE.description);

        // Add tags to column test case
        await page.click('[data-testid="tags-selector"] input');
        const columnTagsSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=tag*`
        );
        await page.fill(
          '[data-testid="tags-selector"] input',
          testTag1.data.name
        );
        await columnTagsSearchResponse;
        await page
          .getByTestId(`tag-option-${testTag1.responseData.fullyQualifiedName}`)
          .click();

        await dismissTagSuggestions(page);

        // Add glossary terms to column test case
        await page.click('[data-testid="glossary-terms-selector"] input');
        const columnGlossarySearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=glossaryTerm*`
        );
        await page.fill(
          '[data-testid="glossary-terms-selector"] input',
          testGlossaryTerm1.data.name
        );
        await columnGlossarySearchResponse;
        await page
          .getByTestId(
            `tag-option-${testGlossaryTerm1.responseData.fullyQualifiedName}`
          )
          .click();

        await dismissTagSuggestions(page);

        await submitTestCaseForm(page);

        await expect(page.getByTestId(NEW_COLUMN_TEST_CASE.name)).toBeVisible();
      });

      await test.step('Edit', async () => {
        await page
          .getByTestId(`action-dropdown-${NEW_COLUMN_TEST_CASE.name}`)
          .click();
        await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
        await page.locator('#testCaseFormV1_params_minLength').waitFor();
        await page.locator('#testCaseFormV1_params_minLength').clear();
        await page.fill('#testCaseFormV1_params_minLength', '4');

        // Remove existing tag and add new one for column test case
        await page
          .locator(
            '[data-testid="tags-selector"] [data-testid="tag-suggestion"] button'
          )
          .first()
          .click();
        await page.click('[data-testid="tags-selector"] input');
        const columnNewTagsSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=tag*`
        );
        await page.fill(
          '[data-testid="tags-selector"] input',
          testTag2.data.name
        );
        await columnNewTagsSearchResponse;
        await page
          .getByTestId(`tag-option-${testTag2.responseData.fullyQualifiedName}`)
          .click();

        await dismissTagSuggestions(page);

        // Remove existing glossary term and add new one for column test case
        await page
          .locator(
            '[data-testid="glossary-terms-selector"] [data-testid="tag-suggestion"] button'
          )
          .first()
          .click();
        await page.click('[data-testid="glossary-terms-selector"] input');
        const columnNewGlossarySearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=glossaryTerm*`
        );
        await page.fill(
          '[data-testid="glossary-terms-selector"] input',
          testGlossaryTerm2.data.name
        );
        await columnNewGlossarySearchResponse;
        await page
          .getByTestId(
            `tag-option-${testGlossaryTerm2.responseData.fullyQualifiedName}`
          )
          .click();

        await dismissTagSuggestions(page);

        const updateTestCaseResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/*'
        );

        await page.getByTestId('create-btn').click();
        await updateTestCaseResponse;
        await toastNotification(page, 'Test case updated successfully.');

        await page
          .getByTestId(`action-dropdown-${NEW_COLUMN_TEST_CASE.name}`)
          .click();

        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions/*'
        );
        await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
        await testDefinitionResponse;
        await page.locator('#testCaseFormV1_params_minLength').waitFor();
        await expect(
          page.locator('#testCaseFormV1_params_minLength')
        ).toHaveValue('4');

        await page.locator('button').getByText('Cancel').click();
      });

      /**
       * Step: Incident page redirect
       * @description Navigates to incident page for the column test case and verifies breadcrumb.
       */
      await test.step('Redirect to IncidentPage and verify breadcrumb', async () => {
        await verifyIncidentBreadcrumbsFromTablePageRedirect(
          page,
          table1,
          NEW_COLUMN_TEST_CASE.name
        );
      });

      /**
       * Step: Delete column test case
       * @description Removes the column test case.
       */
      await test.step('Delete', async () => {
        await deleteTestCase(page, NEW_COLUMN_TEST_CASE.name);
      });
    });

    test('TestCase with Array params value', async ({ page }) => {
      test.slow();

      const testCase = table2.testCasesResponseData[0];
      const testCaseName = testCase?.['name'];
      await visitDataQualityTab(page, table2);

      await test.step('Array params value should be visible while editing the test case', async () => {
        await expect(
          page.locator(`[data-testid="${testCaseName}"]`)
        ).toBeVisible();

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();

        await expect(
          page.locator(`[data-testid="edit-${testCaseName}"]`)
        ).toBeVisible();

        await page.click(`[data-testid="edit-${testCaseName}"]`);

        await expect(
          page.locator('#testCaseFormV1_params_allowedValues_0_value')
        ).toHaveValue('gmail');
        await expect(
          page.locator('#testCaseFormV1_params_allowedValues_1_value')
        ).toHaveValue('yahoo');
        await expect(
          page.locator('#testCaseFormV1_params_allowedValues_2_value')
        ).toHaveValue('collate');
      });

      await test.step('Validate patch request for edit test case', async () => {
        await page.fill(
          '[id="root\\/displayName"]',
          'Table test case display name'
        );

        // In edit mode the immutable table / column / test-type fields are
        // disabled react-aria comboboxes/selects: the prefilled value renders as
        // a chip/label inside the field container (the underlying input is hidden
        // and empty), so assert on the container text. The table chip shows the
        // fully qualified name (which contains the table name) and the test-type
        // chip shows the test definition name. The name field is a plain disabled
        // text input, so its value is asserted directly.
        await expect(page.getByTestId('selectedTable')).toContainText(
          table2.entityResponseData?.['name']
        );
        await expect(page.locator('[id="root\\/column"]')).toContainText(
          table2.entity?.columns[3].name
        );
        await expect(page.locator('[id="root\\/name"]')).toHaveValue(
          testCaseName
        );
        await expect(page.getByTestId('test-type')).toContainText(
          'columnValuesToBeInSet'
        );

        // Edit test case display name
        const updateTestCaseResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testCases/') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('create-btn').click();
        const updateResponse1 = await updateTestCaseResponse;
        const body1 = await updateResponse1.request().postData();

        expect(body1).toEqual(
          JSON.stringify([
            {
              op: 'replace',
              path: '/displayName',
              value: 'Table test case display name',
            },
          ])
        );

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();

        // Edit test case description
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions/*'
        );
        await page.click(`[data-testid="edit-${testCaseName}"]`);
        await testDefinitionResponse;
        await page
          .getByTestId('test-case-form-v1')
          .locator(descriptionBox)
          .fill('Test case description');
        const updateTestCaseResponse2 = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testCases/') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('create-btn').click();
        const updateResponse2 = await updateTestCaseResponse2;
        const body2 = await updateResponse2.request().postData();

        expect(body2).toEqual(
          JSON.stringify([
            {
              op: 'add',
              path: '/description',
              value: '<p>Test case description</p>',
            },
          ])
        );

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();

        // Edit test case parameter values
        const testDefinitionResponse3 = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions/*'
        );
        await page.click(`[data-testid="edit-${testCaseName}"]`);
        await testDefinitionResponse3;
        await page
          .locator('#testCaseFormV1_params_allowedValues_0_value')
          .clear();
        await page.fill('#testCaseFormV1_params_allowedValues_0_value', 'test');
        const updateTestCaseResponse3 = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testCases/') &&
            response.request().method() === 'PATCH'
        );

        await page.getByTestId('create-btn').click();
        const updateResponse3 = await updateTestCaseResponse3;
        const body3 = await updateResponse3.request().postData();

        expect(body3).toEqual(
          JSON.stringify([
            {
              op: 'replace',
              path: '/parameterValues/0/value',
              value: '["test","yahoo","collate"]',
            },
          ])
        );
      });

      await test.step('Update test case display name from Data Quality page', async () => {
        const getTestCase = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await sidebarClick(page, SidebarItem.DATA_QUALITY);
        await page.click('[data-testid="test-cases"]');
        await getTestCase;
        const searchTestCaseResponse = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*q=*${testCaseName}*`
        );
        await page.fill(
          '[data-testid="searchbar-component"] input',
          testCaseName
        );
        await searchTestCaseResponse;
        await waitForAllLoadersToDisappear(page);

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();

        await page.click(`[data-testid="edit-${testCaseName}"]`);

        await expect(page.getByTestId('form-heading')).toBeVisible();

        await expect(page.locator('[id="root\\/displayName"]')).toHaveValue(
          'Table test case display name'
        );

        await page.locator('[id="root\\/displayName"]').clear();
        await page.fill('[id="root\\/displayName"]', 'Updated display name');

        await page.getByTestId('create-btn').click();
        await toastNotification(page, 'Test case updated successfully.');

        await expect(
          page.locator(`[data-testid="${testCaseName}"]`)
        ).toHaveText('Updated display name');
      });
    });

    test('shows exactly one banner for the latest test case run', async ({
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const lastRunTable = new TableClass();

      try {
        await lastRunTable.create(apiContext);
        const testCase = await lastRunTable.createTestCase(apiContext, {
          name: `last_run_banner_${uuid()}`,
          testDefinition: 'tableRowCountToBeBetween',
          parameterValues: [
            { name: 'minValue', value: 1 },
            { name: 'maxValue', value: 100 },
          ],
        });
        const testCaseFqn = testCase['fullyQualifiedName'];
        const testCaseDetailsPath = `/test-case/${encodeURIComponent(
          testCaseFqn
        )}/test-case-results`;
        const banners = page.locator(
          '[data-testid^="test-case-last-run-banner-"][role="status"]'
        );
        const waitForTestCaseDetails = () =>
          page.waitForResponse((response) =>
            response.url().includes('/api/v1/dataQuality/testCases/name/')
          );

        await test.step('Show the no-run state before the first result', async () => {
          const testCaseDetailsResponse = waitForTestCaseDetails();
          await page.goto(testCaseDetailsPath);
          await testCaseDetailsResponse;

          const banner = await verifyTestCaseLastRunBanner(page, 'not-run-yet');

          await expect(banners).toHaveCount(1);
          await expect(banner).toContainText('Last Run Not run yet');
          await expect(banner).toContainText(
            'This test has not run yet. Add it to a pipeline to start collecting results.'
          );
          await expect(banner.getByTestId('test-case-next-run')).toHaveText(
            /^Next · Not scheduled$/i
          );
        });

        const runResults = [
          {
            bannerStatus: 'failed' as const,
            result: 'Latest banner failed result',
            testCaseStatus: 'Failed',
            testResultValue: [],
            timestamp: getCurrentMillis(),
          },
          {
            bannerStatus: 'success' as const,
            result: 'Latest banner success result',
            testCaseStatus: 'Success',
            testResultValue: [],
            timestamp: getCurrentMillis() + 1_000,
          },
        ];

        for (const [index, runResult] of runResults.entries()) {
          await test.step(`Replace the banner with ${runResult.testCaseStatus}`, async () => {
            const { bannerStatus, ...resultPayload } = runResult;
            const resultResponse = await apiContext.post(
              `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
                testCaseFqn
              )}`,
              { data: resultPayload }
            );

            expect(resultResponse.ok()).toBeTruthy();

            const testCaseDetailsResponse = waitForTestCaseDetails();
            await page.reload();
            await testCaseDetailsResponse;

            const banner = await verifyTestCaseLastRunBanner(
              page,
              bannerStatus
            );

            await expect(banners).toHaveCount(1);
            await expect(banner).toContainText(
              `Last Run ${runResult.testCaseStatus}`
            );
            await expect(banner).toContainText(runResult.result);

            if (index === 0) {
              await expect(banner).not.toContainText('Not run yet');
            } else {
              await expect(banner).not.toContainText(
                runResults[index - 1].result
              );
            }
          });
        }
      } finally {
        await lastRunTable.delete(apiContext);
        await afterAction();
      }
    });

    test('shows every section for a scheduled failed test case run', async ({
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const failedRunTable = new TableClass();
      const failureResult =
        'Found 0 rows, but the scheduled test expected at least 1 row.';

      try {
        await failedRunTable.create(apiContext);
        await failedRunTable.createTestSuiteAndPipelines(apiContext);

        const testCase = await failedRunTable.createTestCase(apiContext, {
          name: `complete_failed_run_banner_${uuid()}`,
          testDefinition: 'tableRowCountToBeBetween',
          parameterValues: [
            { name: 'minValue', value: 1 },
            { name: 'maxValue', value: 100 },
          ],
        });
        const testCaseFqn = testCase['fullyQualifiedName'];
        const failedTimestamp = getCurrentMillis();

        await failedRunTable.addTestCaseResult(apiContext, testCaseFqn, {
          result: failureResult,
          testCaseStatus: 'Failed',
          testResultValue: [
            { name: 'minValue', predictedValue: '1', value: '0' },
          ],
          timestamp: failedTimestamp,
        });
        await waitForIncidentToBeIndexed(
          apiContext,
          testCaseFqn,
          failedTimestamp
        );

        const testCaseDetailsResponse = page.waitForResponse((response) =>
          response.url().includes('/api/v1/dataQuality/testCases/name/')
        );
        await page.goto(
          `/test-case/${encodeURIComponent(testCaseFqn)}/test-case-results`
        );
        await testCaseDetailsResponse;

        const banner = await verifyTestCaseLastRunBanner(page, 'failed');

        await expect(
          page.locator(
            '[data-testid^="test-case-last-run-banner-"][role="status"]'
          )
        ).toHaveCount(1);
        await expect(
          banner.getByTestId('test-case-last-run-icon')
        ).toBeVisible();
        await expect(
          banner.getByTestId('test-case-last-run-prefix')
        ).toHaveText('Last Run');
        await expect(
          banner.getByTestId('test-case-last-run-status')
        ).toHaveText('Failed');
        await expect(
          banner.getByTestId('test-case-run-description')
        ).toHaveText(failureResult);
        await expect(
          banner.getByTestId('test-case-result-expected')
        ).toContainText('Result / Expected');
        await expect(banner.getByTestId('test-case-result-value')).toHaveText(
          '0 / 1'
        );
        await expect(banner.getByTestId('test-case-last-run-time')).toHaveText(
          customFormatDateTime(failedTimestamp, 'MMM d, yyyy, h:mm a')
        );
        await expect(banner.getByTestId('test-case-next-run')).toContainText(
          'Next · in '
        );
        await expect(
          banner.getByTestId('test-case-next-run')
        ).not.toContainText('Not scheduled');

        const incident = banner.getByTestId('test-case-last-run-incident');

        await expect(incident).toBeVisible();
        await expect(incident.getByTestId('test-case-incident-id')).toHaveText(
          /INC.*\d,/
        );
        await expect(
          incident.getByTestId('test-case-incident-description')
        ).toContainText('Request TestCase Failure Resolution for');
        await expect(
          incident.getByTestId('test-case-incident-description')
        ).toContainText(testCase.name);
        await expect(
          incident.getByTestId('test-case-incident-status')
        ).toHaveText('New');

        const viewIncidentButton = incident.getByTestId('view-incident-button');

        await expect(viewIncidentButton).toHaveText('View Incident');
        await viewIncidentButton.click();
        await expect(page).toHaveURL(/\/issues$/);
        await expect(page.getByTestId('issue-tab-container')).toBeVisible();
      } finally {
        await failedRunTable.delete(apiContext);
        await afterAction();
      }
    });

    test('TestCase filters', async ({ page }) => {
      test.setTimeout(360000);

      const { apiContext, afterAction } = await getApiContext(page);
      const filterTable1 = new TableClass();

      await filterTable1.create(apiContext);
      const filterTable2 = {
        ...filterTable1.entity,
        name: `${filterTable1.entity.name}-model`,
      };
      const filterTable2Response = await apiContext
        .post('/api/v1/tables', {
          data: filterTable2,
        })
        .then((response) => response.json());
      const domain = new Domain();
      await domain.create(apiContext);

      // Add domain to table
      await filterTable1.visitEntityPage(page);
      await assignSingleSelectDomain(page, domain.responseData);
      const testCases = [
        `pw_first_table_column_count_to_be_between_${uuid()}`,
        `pw_second_table_column_count_to_be_between_${uuid()}`,
        `pw_third_table_column_count_to_be_between_${uuid()}`,
      ];
      const smilerNameTestCase = testCases.map((test) => `${test}_version_2`);
      await filterTable1.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/tags/0',
            value: {
              tagFQN: 'PII.None',
              name: 'None',
              description: 'Non PII',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          },
          {
            op: 'add',
            path: '/tags/1',
            value: {
              tagFQN: 'Tier.Tier2',
              name: 'Tier2',
              source: 'Classification',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          },
        ],
      });
      await filterTable1.createTestSuiteAndPipelines(apiContext);

      const testCaseResult = {
        result:
          'Found min=10001, max=27809 vs. the expected min=90001, max=96162.',
        testCaseStatus: 'Failed',
        testResultValue: [
          {
            name: 'minValueForMaxInCol',
            value: '10001',
          },
          {
            name: 'maxValueForMaxInCol',
            value: '27809',
          },
        ],
        timestamp: getCurrentMillis(),
      };
      for (let i = 0; i < testCases.length; i++) {
        const testCase1 = await filterTable1.createTestCase(apiContext, {
          name: testCases[i],
        });
        await filterTable1.addTestCaseResult(
          apiContext,
          testCase1?.['fullyQualifiedName'],
          testCaseResult
        );
        const testCase2 = await filterTable1.createTestCase(apiContext, {
          name: smilerNameTestCase[i],
          entityLink: `<#E::table::${filterTable2Response?.['fullyQualifiedName']}>`,
        });
        await filterTable1.addTestCaseResult(
          apiContext,
          testCase2?.['fullyQualifiedName'],
          testCaseResult
        );
      }

      const verifyFilterTestCase = async (page: Page) => {
        for (const testCase of testCases) {
          const element = page.locator(`[data-testid="${testCase}"]`);

          await expect(element).toBeVisible();
        }
      };

      const verifyFilter2TestCase = async (page: Page, negation = false) => {
        for (const testCase of smilerNameTestCase) {
          const element = page.locator(`[data-testid="${testCase}"]`);
          if (negation) {
            await expect(element).not.toBeVisible();
          } else {
            await expect(element).toBeVisible();
          }
        }
      };

      try {
        await sidebarClick(page, SidebarItem.DATA_QUALITY);

        await page.click('[data-testid="test-cases"]');
        await waitForAllLoadersToDisappear(page);

        // get all the filters
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="testPlatforms"]');
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="lastRunRange"]');
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="serviceName"]');
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="tier"]');

        // Test case search filter
        const searchTestCaseResponse = page.waitForResponse(
          (url) =>
            url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
            url.url().includes(testCases[0])
        );
        await page
          .getByTestId('searchbar-component')
          .locator('input')
          .fill(testCases[0]);
        await searchTestCaseResponse;

        await expect(
          page.locator(`[data-testid="${testCases[0]}"]`)
        ).toBeVisible();

        // clear the search filter
        const getTestCaseResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.getByTestId('searchbar-component').locator('input').clear();
        await getTestCaseResponse;

        // A pasted URL is full of Lucene reserved characters. The server parses `q` as literal
        // text, so it must answer 200 where a query_string returned a 500 query_shard_exception.
        // This is the only test covering the UI and the server composing on a real stack.
        const pastedUrl = 'https://localhost:8585/table/orders';
        const reservedCharSearchResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testCases/search/list') &&
            response.url().includes('8585')
        );
        await page
          .getByTestId('searchbar-component')
          .locator('input')
          .fill(pastedUrl);
        const reservedCharSearch = await reservedCharSearchResponse;

        // The term must reach the API verbatim: the UI no longer escapes or wraps it, so any
        // reintroduced client-side escaping fails here rather than silently changing the query.
        expect(decodeURIComponent(reservedCharSearch.url())).toContain(
          pastedUrl
        );
        expect(reservedCharSearch.status()).toBe(200);

        // clear the reserved-character search
        const clearReservedCharSearch = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.getByTestId('searchbar-component').locator('input').clear();
        await clearReservedCharSearch;

        // Test case filter by service name
        const serviceResponse = page.waitForResponse(
          '/api/v1/search/query?q=*index=databaseService*'
        );
        await page.fill('#serviceName', filterTable1.service.name);
        await serviceResponse;

        const testCaseByServiceName = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*serviceName=${filterTable1.service.name}*`
        );
        await page
          .locator('.ant-select-dropdown')
          .filter({
            hasNot: page.locator('.ant-select-dropdown-hidden'),
            has: page.locator(`[data-testid="${filterTable1.service.name}"]`),
          })
          .click();
        await testCaseByServiceName;
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page);

        // remove service filter
        await page.click('[data-testid="advanced-filter"]');
        const getTestCase = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.click('[value="serviceName"]');
        await getTestCase;

        // Test case filter by Tags
        const tagResponse = page.waitForResponse(
          '/api/v1/search/query?q=*index=tag*'
        );
        await page
          .getByTestId('tags-select-filter')
          .locator('div')
          .filter({ hasText: 'Tags' })
          .click();
        await page.fill('#tags', 'PII.None');
        await tagResponse;

        const getTestCaseByTag = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*tags=PII.None*'
        );
        await page
          .locator('.ant-select-dropdown')
          .filter({
            hasNot: page.locator('.ant-select-dropdown-hidden'),
            has: page.locator(`[data-testid="PII.None"]`),
          })
          .click();
        await getTestCaseByTag;
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);

        // remove tags filter
        await page.click('[data-testid="advanced-filter"]');
        const getTestCaseWithoutTag = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.click('[value="tags"]');
        await getTestCaseWithoutTag;

        // Test case filter by Tier

        await page.click('#tier');
        await page.fill('#tier', 'Tier2');
        await page.waitForLoadState('domcontentloaded');
        const getTestCaseByTier = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*tier=Tier.Tier2*'
        );
        await page.getByTestId('Tier.Tier2').getByText('Tier.Tier2').click();
        await getTestCaseByTier;
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);

        // remove tier filter
        await page.click('[data-testid="advanced-filter"]');
        const getTestCaseWithoutTier = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.click('[value="tier"]');
        await getTestCaseWithoutTier;

        // Test case filter by table name
        const tableSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=table*`
        );
        await page.fill('#tableFqn', filterTable1.entity.name);
        await tableSearchResponse;
        const getTestCaseByTable = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*entityLink=*${filterTable1.entity.name}*`
        );

        await page
          .getByTestId(
            filterTable1.entityResponseData?.['fullyQualifiedName'] || ''
          )
          .click();
        await getTestCaseByTable;
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);

        // Test case filter by test type column
        const testCaseTypeByColumn = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*testCaseType=column*`
        );
        await page.getByTestId('test-case-type-select-filter').click();
        await page.getByTitle('Column', { exact: true }).click();
        await testCaseTypeByColumn;

        await expect(
          page.locator('[data-testid="empty-placeholder"]')
        ).toBeVisible();

        // Test case filter by test type table
        const testCaseTypeByTable = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*testCaseType=table*`
        );
        await page.getByTestId('test-case-type-select-filter').click();
        await page
          .locator('.ant-select-dropdown')
          .filter({
            hasNot: page.locator('.ant-select-dropdown-hidden'),
            has: page.locator(`[title="Table"]`),
            hasText: 'Table',
          })
          .click();
        await testCaseTypeByTable;
        await verifyFilterTestCase(page);

        // Test case filter by test type all
        const testCaseTypeByAll = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*testCaseType=all*`
        );
        await page.getByTestId('test-case-type-select-filter').click();
        await page.getByTitle('All').nth(1).click();
        await testCaseTypeByAll;

        // Test case filter by status
        const testCaseStatusBySuccess = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            url.pathname === '/api/v1/dataQuality/testCases/search/list' &&
            url.searchParams.get('testCaseStatus') === 'Success'
          );
        });
        const statusFilter = page.getByTestId('status-select-filter');
        await statusFilter.getByRole('combobox').click();
        await page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('Success', { exact: true })
          .click();
        await testCaseStatusBySuccess;

        await expect(
          page.locator('[data-testid="empty-placeholder"]')
        ).toBeVisible();

        // Adding Failed must retain Success because selected statuses are combined with OR.
        const testCaseStatusesBySuccessAndFailed = page.waitForResponse(
          (response) => {
            const url = new URL(response.url());

            return (
              url.pathname === '/api/v1/dataQuality/testCases/search/list' &&
              url.searchParams.get('testCaseStatus') === 'Success,Failed'
            );
          }
        );
        await statusFilter.getByRole('combobox').click();
        await page
          .locator('.ant-select-dropdown:visible')
          .getByTitle('Failed', { exact: true })
          .click();
        await testCaseStatusesBySuccessAndFailed;
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);

        // Test case filter by platform
        const testCasePlatformByDBT = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*testPlatforms=dbt*`
        );
        await page.getByTestId('platform-select-filter').click();
        await page.getByTitle('DBT').click();
        await testCasePlatformByDBT;

        await expect(
          page.locator('[data-testid="empty-placeholder"]')
        ).toBeVisible();

        const getTestCaseWithoutPlatform = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page
          .getByTestId('platform-select-filter')
          .locator('.ant-select-clear')
          .click();
        await getTestCaseWithoutPlatform;
        const testCasePlatformByOpenMetadata = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*testPlatforms=OpenMetadata*`
        );
        await page.getByTestId('platform-select-filter').click();
        await page.getByTitle('OpenMetadata').click();
        await testCasePlatformByOpenMetadata;
        await clickOutside(page);
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);
        const url = page.url();
        await page.reload();

        expect(page.url()).toBe(url);

        await page.getByTestId('advanced-filter').click();
        await page.click('[value="testPlatforms"]');

        await expect(
          page.getByTestId('platform-select-filter')
        ).not.toBeVisible();

        await page.reload();

        await expect(page.locator('[value="tier"]')).not.toBeVisible();

        // Apply domain globally
        await page.getByTestId('domain-dropdown').click();

        // Wait for the domain select dropdown to be visible
        await page.getByTestId('domain-selectable-tree').waitFor({
          state: 'visible',
        });

        // Search for the domain and wait for API response
        const domainSearchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(
            domain.responseData.name
          )}*&index=domain*`
        );

        await page
          .getByTestId('domain-selectable-tree')
          .getByTestId('searchbar')
          .fill(domain.responseData.name);

        await domainSearchResponse;

        await page
          .getByTestId(`tag-${domain.responseData.fullyQualifiedName}`)
          .click();

        await sidebarClick(page, SidebarItem.DATA_QUALITY);

        await page.click('[data-testid="test-cases"]');
        await waitForAllLoadersToDisappear(page);
        await verifyFilterTestCase(page);
        await verifyFilter2TestCase(page, true);
        await visitDataQualityTab(page, filterTable1);
        const searchTestCase = page.waitForResponse(
          (url) =>
            url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
            url.url().includes(testCases[0])
        );
        await page
          .getByTestId('table-profiler-container')
          .getByRole('textbox', { name: 'Search test case' })
          .fill(testCases[0]);
        await searchTestCase;

        await expect(
          page.locator(`[data-testid="${testCases[0]}"]`)
        ).toBeVisible();
        await expect(
          page.locator(`[data-testid="${testCases[1]}"]`)
        ).not.toBeVisible();
        await expect(
          page.locator(`[data-testid="${testCases[2]}"]`)
        ).not.toBeVisible();
      } finally {
        await filterTable1.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('Pagination functionality in test cases list', async ({ page }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const paginationTable = new TableClass();

      try {
        await paginationTable.create(apiContext);
        await paginationTable.createTestSuiteAndPipelines(apiContext);

        // Create multiple test cases to ensure pagination is always visible
        const testCaseCount = 25; // Create enough test cases to trigger pagination

        for (let i = 0; i < testCaseCount; i++) {
          await paginationTable.createTestCase(apiContext, {
            name: `pagination-test-case-${i + 1}-${uuid()}`,
            testDefinition: 'tableRowCountToBeBetween',
            parameterValues: [
              { name: 'minValue', value: 10 + i },
              { name: 'maxValue', value: 100 + i },
            ],
          });
        }

        await sidebarClick(page, SidebarItem.DATA_QUALITY);
        await page.click('[data-testid="test-cases"]');

        await waitForAllLoadersToDisappear(page);

        await test.step('Verify pagination controls are visible', async () => {
          await expect(
            page.locator('[data-testid="pagination"]')
          ).toBeVisible();
          await expect(page.locator('[data-testid="previous"]')).toBeVisible();
          await expect(page.locator('[data-testid="next"]')).toBeVisible();
          await expect(
            page.locator('[data-testid="page-indicator"]')
          ).toBeVisible();
        });

        await test.step('Verify first page state', async () => {
          await expect(page.locator('[data-testid="previous"]')).toBeDisabled();
          await expect(page.locator('[data-testid="next"]')).not.toBeDisabled();
          await expect(
            page.locator('[data-testid="page-indicator"]')
          ).toContainText('1 of');
        });

        await test.step('Navigate to next page', async () => {
          const nextPageResponse = page.waitForResponse(
            '/api/v1/dataQuality/testCases/search/list?*'
          );
          await page.click('[data-testid="next"]');
          await nextPageResponse;

          await expect(
            page.locator('[data-testid="previous"]')
          ).not.toBeDisabled();
          await expect(
            page.locator('[data-testid="page-indicator"]')
          ).toContainText('2 of');
        });

        await test.step('Navigate back to previous page', async () => {
          const prevPageResponse = page.waitForResponse(
            '/api/v1/dataQuality/testCases/search/list?*'
          );
          await page.click('[data-testid="previous"]');
          await prevPageResponse;

          await expect(page.locator('[data-testid="previous"]')).toBeDisabled();
          await expect(
            page.locator('[data-testid="page-indicator"]')
          ).toContainText('1 of');
        });

        await test.step('Test page size dropdown', async () => {
          const pageSizeDropdown = page.getByTestId(
            'page-size-selection-dropdown'
          );
          const pageSizeMenu = page.locator(
            '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu'
          );

          await expect(pageSizeDropdown).toBeVisible();
          // NextPrevious inherits Ant Dropdown's hover trigger; clicking this
          // button only runs its preventDefault handler and may not open the menu.
          await pageSizeDropdown.hover();
          await expect(pageSizeMenu).toBeVisible();
          await expect(pageSizeMenu.getByRole('menuitem')).toHaveCount(3);
        });
      } finally {
        await paginationTable.delete(apiContext);
        await afterAction();
      }
    });

    test('Editing display name does not emit a phantom tags patch op', async ({
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await getApiContext(page);
      const phantomTagsTable = new TableClass();

      try {
        await phantomTagsTable.create(apiContext);
        await phantomTagsTable.createTestCase(apiContext, {
          name: `phantom_tags_test_case_${uuid()}`,
          entityLink: `<#E::table::${phantomTagsTable.entityResponseData?.['fullyQualifiedName']}::columns::${phantomTagsTable.entity?.columns[3].name}>`,
          parameterValues: [
            { name: 'allowedValues', value: '["gmail","yahoo","collate"]' },
          ],
          testDefinition: 'columnValuesToBeInSet',
        });

        const testCaseName =
          phantomTagsTable.testCasesResponseData[0]?.['name'];

        // Drop `tags` from the list response to mimic the search-backed
        // listing that omits relationship fields, reproducing the regression.
        await page.route(
          /dataQuality\/testCases\/search\/list/,
          async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            json.data = (json.data ?? []).map(
              (item: Record<string, unknown>) => {
                const strippedItem = { ...item };
                delete strippedItem.tags;

                return strippedItem;
              }
            );
            await route.fulfill({ json, response });
          }
        );

        await visitDataQualityTab(page, phantomTagsTable);

        await expect(
          page.locator(`[data-testid="${testCaseName}"]`)
        ).toBeVisible();

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();
        await page.click(`[data-testid="edit-${testCaseName}"]`);

        await page.fill(
          '[id="root\\/displayName"]',
          'Phantom tags display name'
        );

        const updateResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataQuality/testCases/') &&
            response.request().method() === 'PATCH'
        );
        await page.getByTestId('create-btn').click();
        const patchRequest = await updateResponse;
        const patchBody = JSON.parse(
          (await patchRequest.request().postData()) ?? '[]'
        );

        expect(
          patchBody.some((op: { path: string }) => op.path === '/tags')
        ).toBe(false);
        expect(patchBody).toContainEqual({
          op: 'replace',
          path: '/displayName',
          value: 'Phantom tags display name',
        });
      } finally {
        await phantomTagsTable.delete(apiContext);
        await afterAction();
      }
    });

    test('Test result tooltip stays fixed while the pointer enters its incident link', async ({
      browser,
      page,
    }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      const tooltipTable = new TableClass();

      try {
        await tooltipTable.create(apiContext);
        const testCase = await tooltipTable.createTestCase(apiContext);
        const testCaseFqn = testCase.fullyQualifiedName as string;
        const failedAt = Date.now();

        await tooltipTable.addTestCaseResult(apiContext, testCaseFqn, {
          result: 'Row count was outside the expected range.',
          testCaseStatus: 'Failed',
          testResultValue: [{ name: 'rowCount', value: '10' }],
          timestamp: failedAt,
        });
        await waitForIncidentToBeIndexed(apiContext, testCaseFqn, failedAt);

        const detailsResponse = waitForTestCaseDetailsResponse(page);
        const resultsResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testCases/testCaseResults/') &&
            response.status() === 200
        );

        await page.goto(
          `/test-case/${encodeURIComponent(testCaseFqn)}/test-case-results`
        );
        await Promise.all([detailsResponse, resultsResponse]);
        await waitForAllLoadersToDisappear(page);

        const point = page
          .locator('[data-testid^="test-summary-point-"]')
          .first();
        const tooltip = page.getByTestId('test-summary-tooltip');

        await expect(point).toBeVisible();
        await point.scrollIntoViewIfNeeded();
        const pointBox = await point.boundingBox();

        if (!pointBox) {
          throw new Error(
            'Expected the test result point to have a bounding box'
          );
        }

        // A nearby chart position must not inherit the dot's tooltip activation.
        await page.mouse.move(
          pointBox.x + pointBox.width + 3,
          pointBox.y + pointBox.height / 2
        );
        await expect(tooltip).toBeHidden();

        await point.hover();
        await expect(tooltip).toBeVisible();

        const incidentLink = tooltip.locator('a.tooltip-incident-link');

        await expect(incidentLink).toBeVisible();
        // Recharts used to move the tooltip during this browser-level pointer
        // transition, preventing Playwright (and users) from reaching the link.
        await incidentLink.hover();
        await expect(incidentLink).toBeVisible();
        await expect
          .poll(() =>
            incidentLink.evaluate((element) => element.matches(':hover'))
          )
          .toBe(true);

        const incidentHref = await incidentLink.getAttribute('href');

        if (!incidentHref) {
          throw new Error('Expected the incident link to have a destination');
        }

        await Promise.all([
          page.waitForURL((url) => url.pathname === incidentHref),
          incidentLink.click(),
        ]);
      } finally {
        await tooltipTable.delete(apiContext);
        await afterAction();
      }
    });
  }
);
