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
import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import {
  assignDomain,
  clickOutside,
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { getCurrentMillis } from '../../utils/dateTime';
import { visitEntityPage } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { deleteTestCase, visitDataQualityTab } from '../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();

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

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table1.create(apiContext);
  await table2.create(apiContext);
  await table2.createTestCase(apiContext, {
    name: `email_column_values_to_be_in_set_${uuid()}`,
    entityLink: `<#E::table::${table2.entityResponseData?.['fullyQualifiedName']}::columns::${table2.entity?.columns[3].name}>`,
    parameterValues: [
      { name: 'allowedValues', value: '["gmail","yahoo","collate"]' },
    ],
    testDefinition: 'columnValuesToBeInSet',
  });

  // Create test tags and glossary terms
  await testClassification.create(apiContext);
  await testTag1.create(apiContext);
  await testTag2.create(apiContext);
  await testGlossary.create(apiContext);
  await testGlossaryTerm1.create(apiContext);
  await testGlossaryTerm2.create(apiContext);

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Table test case', PLAYWRIGHT_INGESTION_TAG_OBJ, async ({ page }) => {
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
  await page.click('[data-testid="table"]');

  await test.step('Create', async () => {
    await page.click('#tableTestForm_testTypeId');
    await page.waitForSelector(`text=${NEW_TABLE_TEST_CASE.label}`);
    await page.click(`text=${NEW_TABLE_TEST_CASE.label}`);
    await page.fill('#tableTestForm_testName', NEW_TABLE_TEST_CASE.name);
    await page.fill(
      '#tableTestForm_params_columnName',
      NEW_TABLE_TEST_CASE.field
    );
    await page.locator(descriptionBox).fill(NEW_TABLE_TEST_CASE.description);

    // Add tags to test case
    await page.click('[data-testid="tags-selector"] input');
    const tagsSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=tag_search_index*`
    );
    await page.fill('[data-testid="tags-selector"] input', testTag1.data.name);
    await tagsSearchResponse;
    await page
      .getByTestId(`tag-${testTag1.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);
    // Add glossary terms to test case
    await page.click('[data-testid="glossary-terms-selector"] input');
    const glossarySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=glossary_term_search_index*`
    );
    await page.fill(
      '[data-testid="glossary-terms-selector"] input',
      testGlossaryTerm1.data.name
    );
    await glossarySearchResponse;
    await page
      .getByTestId(`tag-${testGlossaryTerm1.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    await page.click('[data-testid="submit-test"]');

    await page.waitForSelector('[data-testid="success-line"]');

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();

    await page.waitForSelector('[data-testid="add-ingestion-button"]');
    await page.click('[data-testid="add-ingestion-button"]');
    await page.click('[data-testid="select-all-test-cases"]');

    // Schedule & Deploy
    await page.click('[data-testid="cron-type"]');
    await page.waitForSelector('.ant-select-item-option-content');
    await page.click('.ant-select-item-option-content:has-text("Hour")');
    const ingestionPipelines = page.waitForResponse(
      '/api/v1/services/ingestionPipelines'
    );
    const deploy = page.waitForResponse(
      '/api/v1/services/ingestionPipelines/deploy/*'
    );
    await page.click('[data-testid="deploy-button"]');
    await ingestionPipelines;
    await deploy;

    // check success
    await page.waitForSelector('[data-testid="success-line"]', {
      timeout: 15000,
    });

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();
    await expect(
      page.getByText('has been created and deployed successfully')
    ).toBeVisible();

    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*fields=*'
    );
    await page.click(`[data-testid="view-service-button"]`);
    await testCaseResponse;

    await expect(page.getByTestId(NEW_TABLE_TEST_CASE.name)).toBeVisible();
  });

  await test.step('Edit', async () => {
    await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);
    await page.waitForSelector('.ant-modal-title');
    await page.locator('#tableTestForm_params_columnName').clear();
    await page.fill('#tableTestForm_params_columnName', 'new_column_name');

    // Remove existing tag and add new one
    await page.click(
      `[data-testid="selected-tag-${testTag1.responseData.fullyQualifiedName}"] svg`
    );

    await page.click('[data-testid="tags-selector"] input');
    const newTagsSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=tag_search_index*`
    );
    await page.fill('[data-testid="tags-selector"] input', testTag2.data.name);
    await newTagsSearchResponse;
    await page
      .getByTestId(`tag-${testTag2.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    // Remove existing glossary term and add new one
    await page.click(
      `[data-testid="glossary-terms-selector"] [data-testid="remove-tags"]`
    );
    await page.click('[data-testid="glossary-terms-selector"] input');
    const newGlossarySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=glossary_term_search_index*`
    );
    await page.fill(
      '[data-testid="glossary-terms-selector"] input',
      testGlossaryTerm2.data.name
    );
    await newGlossarySearchResponse;
    await page
      .getByTestId(`tag-${testGlossaryTerm2.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    const updateTestCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/*'
    );
    await page.locator('button').filter({ hasText: 'Submit' }).click();
    await updateTestCaseResponse;
    await toastNotification(page, 'Test case updated successfully.');
    await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);

    await page.waitForSelector('#tableTestForm_params_columnName');

    await expect(page.locator('#tableTestForm_params_columnName')).toHaveValue(
      'new_column_name'
    );

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await test.step('Delete', async () => {
    await deleteTestCase(page, NEW_TABLE_TEST_CASE.name);
  });
});

test('Column test case', PLAYWRIGHT_INGESTION_TAG_OBJ, async ({ page }) => {
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
  await page.click('[data-testid="column"]');

  await test.step('Create', async () => {
    const testDefinitionResponse = page.waitForResponse(
      '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
    );
    await page.click('#tableTestForm_column');
    await page.click(`[title="${NEW_COLUMN_TEST_CASE.column}"]`);
    await testDefinitionResponse;
    await page.fill('#tableTestForm_testName', NEW_COLUMN_TEST_CASE.name);
    await page.click('#tableTestForm_testTypeId');
    await page.click(`[data-testid="${NEW_COLUMN_TEST_CASE.type}"]`);
    await page.fill(
      '#tableTestForm_params_minLength',
      NEW_COLUMN_TEST_CASE.min
    );
    await page.fill(
      '#tableTestForm_params_maxLength',
      NEW_COLUMN_TEST_CASE.max
    );
    await page.locator(descriptionBox).fill(NEW_COLUMN_TEST_CASE.description);

    // Add tags to column test case
    await page.click('[data-testid="tags-selector"] input');
    const columnTagsSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=tag_search_index*`
    );
    await page.fill('[data-testid="tags-selector"] input', testTag1.data.name);
    await columnTagsSearchResponse;
    await page
      .getByTestId(`tag-${testTag1.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    // Add glossary terms to column test case
    await page.click('[data-testid="glossary-terms-selector"] input');
    const columnGlossarySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=glossary_term_search_index*`
    );
    await page.fill(
      '[data-testid="glossary-terms-selector"] input',
      testGlossaryTerm1.data.name
    );
    await columnGlossarySearchResponse;
    await page
      .getByTestId(`tag-${testGlossaryTerm1.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    await page.click('[data-testid="submit-test"]');
    await page.waitForSelector('[data-testid="success-line"]');

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();

    await page.waitForSelector('[data-testid="view-service-button"]');

    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*fields=*'
    );
    await page.click(`[data-testid="view-service-button"]`);
    await testCaseResponse;

    await page.waitForSelector(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`);

    await expect(
      page.locator(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`)
    ).toBeVisible();
  });

  await test.step('Edit', async () => {
    await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
    await page.waitForSelector('#tableTestForm_params_minLength');
    await page.locator('#tableTestForm_params_minLength').clear();
    await page.fill('#tableTestForm_params_minLength', '4');

    // Remove existing tag and add new one for column test case
    await page.click(
      `[data-testid="selected-tag-${testTag1.responseData.fullyQualifiedName}"] svg`
    );
    await page.click('[data-testid="tags-selector"] input');
    const columnNewTagsSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=tag_search_index*`
    );
    await page.fill('[data-testid="tags-selector"] input', testTag2.data.name);
    await columnNewTagsSearchResponse;
    await page
      .getByTestId(`tag-${testTag2.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    // Remove existing glossary term and add new one for column test case
    await page.click(
      `[data-testid="glossary-terms-selector"] [data-testid="remove-tags"]`
    );
    await page.click('[data-testid="glossary-terms-selector"] input');
    const columnNewGlossarySearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=glossary_term_search_index*`
    );
    await page.fill(
      '[data-testid="glossary-terms-selector"] input',
      testGlossaryTerm2.data.name
    );
    await columnNewGlossarySearchResponse;
    await page
      .getByTestId(`tag-${testGlossaryTerm2.responseData.fullyQualifiedName}`)
      .click();

    await clickOutside(page);

    const updateTestCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/*'
    );
    await page.locator('button').getByText('Submit').click();
    await updateTestCaseResponse;
    await toastNotification(page, 'Test case updated successfully.');

    await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
    await page.waitForSelector('#tableTestForm_params_minLength');
    const minLengthValue = await page
      .locator('#tableTestForm_params_minLength')
      .inputValue();

    expect(minLengthValue).toBe('4');

    await page.locator('button').getByText('Cancel').click();
  });

  await test.step('Delete', async () => {
    await deleteTestCase(page, NEW_COLUMN_TEST_CASE.name);
  });
});

test(
  'Profiler matrix and test case graph should visible',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    const DATA_QUALITY_TABLE = {
      term: 'dim_address',
      serviceName: 'sample_data',
      testCaseName: 'column_value_max_to_be_between',
    };

    await visitEntityPage({
      page,
      searchTerm: DATA_QUALITY_TABLE.term,
      dataTestId: `${DATA_QUALITY_TABLE.serviceName}-${DATA_QUALITY_TABLE.term}`,
    });
    await page.waitForSelector(`[data-testid="entity-header-name"]`);

    await expect(
      page.locator(`[data-testid="entity-header-name"]`)
    ).toContainText(DATA_QUALITY_TABLE.term);

    const profilerResponse = page.waitForResponse(
      `/api/v1/tables/*/tableProfile/latest?includeColumnProfile=false`
    );
    await page.click('[data-testid="profiler"]');
    await profilerResponse;
    await page.waitForTimeout(1000);
    await page
      .getByRole('menuitem', {
        name: 'Column Profile',
      })
      .click();
    const getProfilerInfo = page.waitForResponse(
      '/api/v1/tables/*/columnProfile?*'
    );
    await page.locator('[data-row-key="shop_id"]').getByText('shop_id').click();
    await getProfilerInfo;

    await expect(page.locator('#count_graph')).toBeVisible();
    await expect(page.locator('#proportion_graph')).toBeVisible();
    await expect(page.locator('#math_graph')).toBeVisible();
    await expect(page.locator('#sum_graph')).toBeVisible();

    await page
      .getByRole('menuitem', {
        name: 'Data Quality',
      })
      .click();

    await page.waitForSelector(
      `[data-testid="${DATA_QUALITY_TABLE.testCaseName}"]`
    );
    const getTestCaseDetails = page.waitForResponse(
      '/api/v1/dataQuality/testCases/name/*?fields=*'
    );
    const getTestResult = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseResults/*?*'
    );
    await page
      .locator(`[data-testid="${DATA_QUALITY_TABLE.testCaseName}"]`)
      .getByText(DATA_QUALITY_TABLE.testCaseName)
      .click();

    await getTestCaseDetails;
    await getTestResult;

    await expect(
      page.locator(`#${DATA_QUALITY_TABLE.testCaseName}_graph`)
    ).toBeVisible();
  }
);

test(
  'TestCase with Array params value',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    test.slow();

    const testCase = table2.testCasesResponseData[0];
    const testCaseName = testCase?.['name'];
    await visitDataQualityTab(page, table2);

    await test.step(
      'Array params value should be visible while editing the test case',
      async () => {
        await expect(
          page.locator(`[data-testid="${testCaseName}"]`)
        ).toBeVisible();
        await expect(
          page.locator(`[data-testid="edit-${testCaseName}"]`)
        ).toBeVisible();

        await page.click(`[data-testid="edit-${testCaseName}"]`);

        await expect(
          page.locator('#tableTestForm_params_allowedValues_0_value')
        ).toHaveValue('gmail');
        await expect(
          page.locator('#tableTestForm_params_allowedValues_1_value')
        ).toHaveValue('yahoo');
        await expect(
          page.locator('#tableTestForm_params_allowedValues_2_value')
        ).toHaveValue('collate');
      }
    );

    await test.step('Validate patch request for edit test case', async () => {
      await page.fill(
        '#tableTestForm_displayName',
        'Table test case display name'
      );

      await expect(page.locator('#tableTestForm_table')).toHaveValue(
        table2.entityResponseData?.['name']
      );
      await expect(page.locator('#tableTestForm_column')).toHaveValue(
        table2.entity?.columns[3].name
      );
      await expect(page.locator('#tableTestForm_name')).toHaveValue(
        testCaseName
      );
      await expect(page.locator('#tableTestForm_testDefinition')).toHaveValue(
        'Column Values To Be In Set'
      );

      // Edit test case display name
      const updateTestCaseResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testCases/') &&
          response.request().method() === 'PATCH'
      );
      await page.click('.ant-modal-footer >> text=Submit');
      const updateResponse1 = await updateTestCaseResponse;
      const body1 = await updateResponse1.request().postData();

      expect(body1).toEqual(
        JSON.stringify([
          {
            op: 'add',
            path: '/displayName',
            value: 'Table test case display name',
          },
        ])
      );

      // Edit test case description
      await page.click(`[data-testid="edit-${testCaseName}"]`);
      await page.locator(descriptionBox).fill('Test case description');
      const updateTestCaseResponse2 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testCases/') &&
          response.request().method() === 'PATCH'
      );
      await page.click('.ant-modal-footer >> text=Submit');
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

      // Edit test case parameter values
      await page.click(`[data-testid="edit-${testCaseName}"]`);
      await page.fill('#tableTestForm_params_allowedValues_0_value', 'test');
      const updateTestCaseResponse3 = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testCases/') &&
          response.request().method() === 'PATCH'
      );
      await page.click('.ant-modal-footer >> text=Submit');
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

    await test.step(
      'Update test case display name from Data Quality page',
      async () => {
        const getTestCase = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await sidebarClick(page, SidebarItem.DATA_QUALITY);
        await page.click('[data-testid="by-test-cases"]');
        await getTestCase;
        const searchTestCaseResponse = page.waitForResponse(
          `/api/v1/dataQuality/testCases/search/list?*q=*${testCaseName}*`
        );
        await page.fill(
          '[data-testid="test-case-container"] [data-testid="searchbar"]',
          testCaseName
        );
        await searchTestCaseResponse;
        await page.waitForSelector('.ant-spin', {
          state: 'detached',
        });
        await page.click(`[data-testid="edit-${testCaseName}"]`);
        await page.waitForSelector('.ant-modal-title');

        await expect(page.locator('#tableTestForm_displayName')).toHaveValue(
          'Table test case display name'
        );

        await page.locator('#tableTestForm_displayName').clear();
        await page.fill('#tableTestForm_displayName', 'Updated display name');
        await page.click('.ant-modal-footer >> text=Submit');
        await toastNotification(page, 'Test case updated successfully.');

        await expect(
          page.locator(`[data-testid="${testCaseName}"]`)
        ).toHaveText('Updated display name');
      }
    );
  }
);

test(
  'Update profiler setting modal',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    const profilerSetting = {
      profileSample: '60',
      sampleDataCount: '100',
      profileQuery: 'select * from table',
      excludeColumns: table1.entity?.columns[0].name,
      includeColumns: table1.entity?.columns[1].name,
      partitionColumnName: table1.entity?.columns[2].name,
      partitionIntervalType: 'COLUMN-VALUE',
      partitionValues: 'test',
    };

    await table1.visitEntityPage(page);
    await page.getByTestId('profiler').click();
    await page
      .getByTestId('profiler-tab-left-panel')
      .getByText('Data Quality')
      .click();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await test.step('Update profiler setting', async () => {
      await page.click('[data-testid="profiler-setting-btn"]');
      await page.waitForSelector('.ant-modal-body');

      await page.locator('[data-testid="slider-input"]').clear();
      await page
        .locator('[data-testid="slider-input"]')
        .fill(profilerSetting.profileSample);

      await page.locator('[data-testid="sample-data-count-input"]').clear();
      await page
        .locator('[data-testid="sample-data-count-input"]')
        .fill(profilerSetting.sampleDataCount);
      await page.locator('[data-testid="exclude-column-select"]').click();
      await page.keyboard.type(`${profilerSetting.excludeColumns}`);
      await page.keyboard.press('Enter');
      await page.locator('.CodeMirror-scroll').click();
      await page.keyboard.type(profilerSetting.profileQuery);

      await page.locator('[data-testid="include-column-select"]').click();
      await page
        .locator('.ant-select-dropdown')
        .locator(
          `[title="${profilerSetting.includeColumns}"]:not(.ant-select-dropdown-hidden)`
        )
        .last()
        .click();
      await page.locator('[data-testid="enable-partition-switch"]').click();
      await page.locator('[data-testid="interval-type"]').click();
      await page
        .locator('.ant-select-dropdown')
        .locator(
          `[title="${profilerSetting.partitionIntervalType}"]:not(.ant-select-dropdown-hidden)`
        )
        .click();

      await page.locator('#includeColumnsProfiler_partitionColumnName').click();
      await page
        .locator('.ant-select-dropdown')
        .locator(
          `[title="${profilerSetting.partitionColumnName}"]:not(.ant-select-dropdown-hidden)`
        )
        .last()
        .click();
      await page
        .locator('[data-testid="partition-value"]')
        .fill(profilerSetting.partitionValues);

      const updateTableProfilerConfigResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tables/') &&
          response.url().includes('/tableProfilerConfig') &&
          response.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Save' }).click();
      const updateResponse = await updateTableProfilerConfigResponse;
      const requestBody = await updateResponse.request().postData();

      expect(requestBody).toEqual(
        JSON.stringify({
          excludeColumns: [table1.entity?.columns[0].name],
          profileQuery: 'select * from table',
          profileSample: 60,
          profileSampleType: 'PERCENTAGE',
          includeColumns: [{ columnName: table1.entity?.columns[1].name }],
          partitioning: {
            partitionColumnName: table1.entity?.columns[2].name,
            partitionIntervalType: 'COLUMN-VALUE',
            partitionValues: ['test'],
            enablePartitioning: true,
          },
          sampleDataCount: 100,
        })
      );
    });

    await test.step('Reset profile sample type', async () => {
      await page.click('[data-testid="profiler-setting-btn"]');
      await page.waitForSelector('.ant-modal-body');

      await expect(
        page.locator('[data-testid="profile-sample"]')
      ).toBeVisible();

      await page.getByTestId('clear-slider-input').click();

      await expect(page.locator('[data-testid="slider-input"]')).toBeEmpty();

      const updateTableProfilerConfigResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/tables/') &&
          response.url().includes('/tableProfilerConfig') &&
          response.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Save' }).click();
      const updateResponse = await updateTableProfilerConfigResponse;
      const requestBody = await updateResponse.request().postData();

      expect(requestBody).toEqual(
        JSON.stringify({
          excludeColumns: [table1.entity?.columns[0].name],
          profileQuery: 'select * from table',
          profileSample: null,
          profileSampleType: 'PERCENTAGE',
          includeColumns: [{ columnName: table1.entity?.columns[1].name }],
          partitioning: {
            partitionColumnName: table1.entity?.columns[2].name,
            partitionIntervalType: 'COLUMN-VALUE',
            partitionValues: ['test'],
            enablePartitioning: true,
          },
          sampleDataCount: 100,
        })
      );

      await page.waitForSelector('.ant-modal-body', {
        state: 'detached',
      });

      // Validate the profiler setting is updated
      await page.click('[data-testid="profiler-setting-btn"]');
      await page.waitForSelector('.ant-modal-body');

      await expect(
        page.locator('[data-testid="profile-sample"]')
      ).toBeVisible();
      await expect(page.locator('[data-testid="slider-input"]')).toBeEmpty();
      await expect(
        page.getByTestId('profile-sample').locator('div')
      ).toBeVisible();
    });
  }
);

test('TestCase filters', PLAYWRIGHT_INGESTION_TAG_OBJ, async ({ page }) => {
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
  await assignDomain(page, domain.responseData);
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
  const { testSuiteData: testSuite2Response } =
    await filterTable1.createTestSuiteAndPipelines(apiContext, {
      basicEntityReference: filterTable2Response?.['fullyQualifiedName'],
    });

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
    const getTestCaseListData = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*'
    );
    await page.click('[data-testid="by-test-cases"]');
    await getTestCaseListData;
    // get all the filters
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="tableFqn"]');
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="testPlatforms"]');
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="lastRunRange"]');
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="serviceName"]');
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="tags"]');
    await page.click('[data-testid="advanced-filter"]');
    await page.click('[value="tier"]');

    // Test case search filter
    const searchTestCaseResponse = page.waitForResponse(
      (url) =>
        url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
        url.url().includes(testCases[0])
    );
    await page.fill(
      '[data-testid="test-case-container"] [data-testid="searchbar"]',
      testCases[0]
    );
    await searchTestCaseResponse;

    await expect(page.locator(`[data-testid="${testCases[0]}"]`)).toBeVisible();

    // clear the search filter
    const getTestCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*'
    );
    await page.locator('.ant-input-clear-icon').click();
    await getTestCaseResponse;

    // Test case filter by service name
    const serviceResponse = page.waitForResponse(
      '/api/v1/search/query?q=*index=database_service_search_index*'
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
      '/api/v1/search/query?q=*index=tag_search_index*'
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
      `/api/v1/search/query?q=*index=table_search_index*`
    );
    await page.fill('#tableFqn', filterTable1.entity.name);
    await tableSearchResponse;
    const getTestCaseByTable = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*entityLink=*${filterTable1.entity.name}*`
    );

    await page
      .getByTestId(filterTable1.entityResponseData?.['fullyQualifiedName'])
      .click();
    await getTestCaseByTable;
    await verifyFilterTestCase(page);
    await verifyFilter2TestCase(page, true);

    // Test case filter by test type column
    const testCaseTypeByColumn = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*testCaseType=column*`
    );
    await page.getByTestId('test-case-type-select-filter').click();
    await page.getByTitle('Column').click();
    await testCaseTypeByColumn;

    await expect(
      page.locator('[data-testid="search-error-placeholder"]')
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
    const testCaseStatusBySuccess = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*testCaseStatus=Success*`
    );
    await page.getByTestId('status-select-filter').click();
    await page.getByTitle('Success').click();
    await testCaseStatusBySuccess;

    await expect(
      page.locator('[data-testid="search-error-placeholder"]')
    ).toBeVisible();

    // Test case filter by status
    const testCaseStatusByFailed = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*testCaseStatus=Failed*`
    );
    await page.getByTestId('status-select-filter').click();
    await page.getByTitle('Failed').click();
    await testCaseStatusByFailed;
    await verifyFilterTestCase(page);
    await verifyFilter2TestCase(page, true);

    // Test case filter by platform
    const testCasePlatformByDBT = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*testPlatforms=DBT*`
    );
    await page.getByTestId('platform-select-filter').click();
    await page.getByTitle('DBT').click();
    await testCasePlatformByDBT;

    await expect(
      page.locator('[data-testid="search-error-placeholder"]')
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

    await expect(page.url()).toBe(url);

    await page.getByTestId('advanced-filter').click();
    await page.click('[value="testPlatforms"]');
    await page.waitForTimeout(200);

    await expect(page.getByTestId('platform-select-filter')).not.toBeVisible();

    await page.reload();

    await expect(page.locator('[value="tier"]')).not.toBeVisible();

    // Apply domain globally
    await page.getByTestId('domain-dropdown').click();

    await page
      .getByTestId(`tag-${domain.responseData.fullyQualifiedName}`)
      .click();

    await sidebarClick(page, SidebarItem.DATA_QUALITY);
    const getTestCaseList = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*'
    );
    await page.click('[data-testid="by-test-cases"]');
    await getTestCaseList;
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
      .getByTestId('searchbar')
      .fill(testCases[0]);
    await searchTestCase;

    await expect(page.locator(`[data-testid="${testCases[0]}"]`)).toBeVisible();
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

test(
  'Pagination functionality in test cases list',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
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
      await page.waitForLoadState('networkidle');
      const getTestCaseListData = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*'
      );
      await page.click('[data-testid="by-test-cases"]');
      await getTestCaseListData;

      await page.getByTestId('loader').waitFor({ state: 'detached' });

      await test.step('Verify pagination controls are visible', async () => {
        await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
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
        await expect(
          page.locator('[data-testid="page-size-selection-dropdown"]')
        ).toBeVisible();

        await page.click('[data-testid="page-size-selection-dropdown"]');

        // Verify dropdown options are visible
        await expect(page.locator('.ant-dropdown-menu')).toBeVisible();
        await expect(page.locator('.ant-dropdown-menu-item')).toHaveCount(3);
      });
    } finally {
      await paginationTable.delete(apiContext);
      await afterAction();
    }
  }
);
