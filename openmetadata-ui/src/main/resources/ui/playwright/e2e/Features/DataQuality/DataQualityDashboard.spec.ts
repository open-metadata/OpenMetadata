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

import test, { expect, Page } from '@playwright/test';
import { getCurrentMillis } from '../../../../src/utils/date-time/DateTimeUtils';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage } from '../../../utils/common';
import {
  clickPieChartSegmentByIndex,
  DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
  ENTITY_HEALTH_PIE_CHART_TEST_ID,
  goToDataQualityDashboard,
  TEST_CASE_STATUS_PIE_CHART_TEST_ID,
} from '../../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

enum TestCaseStatus {
  Aborted = 'Aborted',
  Failed = 'Failed',
  Success = 'Success',
}

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const table1 = new TableClass();
const table2 = new TableClass();
const table3 = new TableClass();
const user1 = new UserClass();
const classification = new ClassificationClass();
const tag = new TagClass({ classification: classification.data.name });
const tier = new TagClass({ classification: 'Tier' });
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const domain = new Domain();
const dataProduct = new DataProduct([domain]);

const testCaseResult = {
  result: 'Found min=10001, max=27809 vs. the expected min=90001, max=96162.',
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

test.beforeAll('setup pre-test', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await classification.create(apiContext);
  await tier.create(apiContext);
  await tag.create(apiContext);
  await glossary.create(apiContext);
  await glossaryTerm.create(apiContext);
  await user1.create(apiContext);
  await table1.create(apiContext);
  await table2.create(apiContext);
  await table3.create(apiContext);
  await domain.create(apiContext);
  await dataProduct.create(apiContext);
  await dataProduct.addAssets(apiContext, [
    { id: table1.entityResponseData.id, type: 'table' },
    { id: table2.entityResponseData.id, type: 'table' },
    { id: table3.entityResponseData.id, type: 'table' },
  ]);
  for (const table of [table1, table2, table3]) {
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: tier.data.name,
            tagFQN: tier.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            name: tag.data.name,
            tagFQN: tag.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
        {
          op: 'add',
          path: '/tags/2',
          value: {
            name: glossaryTerm.data.name,
            tagFQN: glossaryTerm.responseData.fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Glossary',
          },
        },
        {
          op: 'add',
          path: '/owners/0',
          value: {
            id: user1.responseData.id,
            type: 'user',
          },
        },
      ],
    });
  }

  await table1.createTestSuiteAndPipelines(apiContext);
  await table2.createTestSuiteAndPipelines(apiContext);
  await table3.createTestSuiteAndPipelines(apiContext);
  for (let i = 0; i < 3; i++) {
    const tc1 = await table1.createTestCase(apiContext);
    await table1.addTestCaseResult(apiContext, tc1.fullyQualifiedName, {
      ...testCaseResult,
      testCaseStatus: TestCaseStatus.Success,
    });
    const tc2 = await table2.createTestCase(apiContext);
    await table2.addTestCaseResult(apiContext, tc2.fullyQualifiedName, {
      ...testCaseResult,
      testCaseStatus: TestCaseStatus.Failed,
    });
    const tc3 = await table3.createTestCase(apiContext);
    await table3.addTestCaseResult(apiContext, tc3.fullyQualifiedName, {
      ...testCaseResult,
      testCaseStatus: TestCaseStatus.Aborted,
    });
  }

  await afterAction();
});

test.afterAll('cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await table1.delete(apiContext);
  await table2.delete(apiContext);
  await table3.delete(apiContext);
  await user1.delete(apiContext);
  await glossaryTerm.delete(apiContext);
  await glossary.delete(apiContext);
  await tag.delete(apiContext);
  await tier.delete(apiContext);
  await classification.delete(apiContext);
  await dataProduct.delete(apiContext);
  await domain.delete(apiContext);

  await afterAction();
});

const waitForDashboardApiResponses = (page: Page, key: string) => {
  const testCaseStatusResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCase&aggregationQuery=bucketName%3Dstatus%3AaggType%3Dterms%3Afield%3DtestCaseResult.testCaseStatus`
  );
  const unhealthyEntityResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCase&aggregationQuery=bucketName%3DentityWithTests%3AaggType%3Dcardinality%3Afield%3DoriginEntityFQN`
  );
  const totalCoveredEntityResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCase&aggregationQuery=bucketName%3DentityWithTests%3AaggType%3Dcardinality%3Afield%3DoriginEntityFQN`
  );
  const totalTestCaseResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCase&aggregationQuery=bucketName%3Ddimension%3AaggType%3Dterms%3Afield%3DdataQualityDimension%2CbucketName%3Dstatus%3AaggType%3Dterms%3Afield%3DtestCaseResult.testCaseStatus`
  );
  const successStatusResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCaseResult&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3DnewIncidents%3AaggType%3Dcardinality%3Afield%3DtestCase.fullyQualifiedName`
  );
  const abortedStatusResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCaseResult&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3DnewIncidents%3AaggType%3Dcardinality%3Afield%3DtestCase.fullyQualifiedName`
  );
  const failedStatusResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCaseResult&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3DnewIncidents%3AaggType%3Dcardinality%3Afield%3DtestCase.fullyQualifiedName`
  );
  const newIncidentResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCaseResolutionStatus&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3DnewIncidents%3AaggType%3Dcardinality%3Afield%3DstateId`
  );
  const resolvedIncidentResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?q=*${key}*&index=testCaseResolutionStatus&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3DnewIncidents%3AaggType%3Dcardinality%3Afield%3DstateId`
  );
  const timeToResponseMetricResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?*${key}*&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3Dmetrics%3AaggType%3Dnested%3Apath%3Dmetrics%2CbucketName%3DbyName%3AaggType%3Dterms%3Afield%3Dmetrics.name.keyword%2CbucketName%3DavgValue%3AaggType%3Davg%3Afield%3Dmetrics.value`
  );
  const timeToResolutionMetricResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?*${key}*&aggregationQuery=bucketName%3DbyDay%3AaggType%3Ddate_histogram%3Afield%3Dtimestamp%26calendar_interval%3Dday%2CbucketName%3Dmetrics%3AaggType%3Dnested%3Apath%3Dmetrics%2CbucketName%3DbyName%3AaggType%3Dterms%3Afield%3Dmetrics.name.keyword%2CbucketName%3DavgValue%3AaggType%3Davg%3Afield%3Dmetrics.value`
  );
  const entityWithTestCasesResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?*${key}*&index=testCase&aggregationQuery=bucketName%3DentityWithTests%3AaggType%3Dcardinality%3Afield%3DoriginEntityFQN`
  );
  const totalEntityCountResponse = page.waitForResponse(
    `/api/v1/dataQuality/testSuites/dataQualityReport?*${key}*&index=table&aggregationQuery=bucketName%3Dcount%3AaggType%3Dcardinality%3Afield%3DfullyQualifiedName`
  );

  return [
    testCaseStatusResponse,
    unhealthyEntityResponse,
    totalCoveredEntityResponse,
    totalTestCaseResponse,
    successStatusResponse,
    abortedStatusResponse,
    failedStatusResponse,
    newIncidentResponse,
    resolvedIncidentResponse,
    timeToResponseMetricResponse,
    timeToResolutionMetricResponse,
    entityWithTestCasesResponse,
    totalEntityCountResponse,
  ];
};

test('DataQualityDashboardTab', async ({ page }) => {
  test.slow();

  await goToDataQualityDashboard(page);
  await waitForAllLoadersToDisappear(page);
  await page.getByRole('button', { name: 'Owner' }).click();

  await expect(page.locator("[data-testid='select-owner-tabs']")).toBeVisible();

  await waitForAllLoadersToDisappear(page);
  await page.getByRole('tab', { name: 'Users' }).click();
  await waitForAllLoadersToDisappear(page);

  const searchOwner = page.waitForResponse(
    'api/v1/search/query?q=*&index=user*'
  );
  await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
  await page.fill(
    '[data-testid="owner-select-users-search-bar"]',
    user1.getUserDisplayName()
  );
  await searchOwner;
  await waitForAllLoadersToDisappear(page);
  const ownerApiResponse = waitForDashboardApiResponses(
    page,
    user1.responseData.name
  );
  await page
    .getByRole('listitem', { name: user1.getUserDisplayName() })
    .click();
  for (const apiRes of ownerApiResponse) {
    const responseData = await apiRes;

    expect(responseData.ok()).toBeTruthy();
  }

  await page.getByRole('button', { name: 'Tier' }).click();
  await page.getByTestId('search-input').click();
  await page
    .getByTestId('search-input')
    .fill(tier.responseData.fullyQualifiedName);
  await page.getByTestId(tier.responseData.fullyQualifiedName).click();
  const tierApiResponse = waitForDashboardApiResponses(
    page,
    tier.responseData.fullyQualifiedName
  );
  await page.getByTestId('update-btn').click();
  for (const apiRes of tierApiResponse) {
    const responseData = await apiRes;

    expect(responseData.ok()).toBeTruthy();
  }

  await page.getByRole('button', { name: 'Tag' }).click();
  await page.getByTestId('search-input').click();
  await page.getByTestId('search-input').fill(tag.data.name);
  await page.getByText(tag.responseData.fullyQualifiedName).click();
  const tagApiResponse = waitForDashboardApiResponses(
    page,
    tag.responseData.fullyQualifiedName
  );
  await page.getByTestId('update-btn').click();
  for (const apiRes of tagApiResponse) {
    const responseData = await apiRes;

    expect(responseData.ok()).toBeTruthy();
  }

  await page.getByRole('button', { name: 'Glossary Term' }).click();
  await page.getByTestId('search-input').click();
  const glossaryTermSearchApi = page.waitForResponse(
    '/api/v1/search/query?*q=*index=glossaryTerm*'
  );
  await page.getByTestId('search-input').fill(glossaryTerm.data.name);
  await glossaryTermSearchApi;
  await page.getByText(glossaryTerm.responseData.fullyQualifiedName).click();
  const glossaryTermApiResponse = waitForDashboardApiResponses(
    page,
    encodeURIComponent(glossaryTerm.responseData.name)
  );
  await page.getByTestId('update-btn').click();
  for (const apiRes of glossaryTermApiResponse) {
    const responseData = await apiRes;

    expect(responseData.ok()).toBeTruthy();
  }

  await page.getByRole('button', { name: 'Data Product' }).click();
  await page.getByTestId('search-input').click();
  const dataProductSearchApi = page.waitForResponse(
    '/api/v1/search/query?*q=*index=dataProduct*'
  );
  await page
    .getByTestId('search-input')
    .fill(dataProduct.responseData.displayName ?? dataProduct.data.displayName);
  await dataProductSearchApi;
  await page
    .getByText(
      dataProduct.responseData.displayName ?? dataProduct.data.displayName
    )
    .click();
  const dataProductApiResponse = waitForDashboardApiResponses(
    page,
    encodeURIComponent(dataProduct.data.name)
  );
  await page.getByTestId('update-btn').click();
  for (const apiRes of dataProductApiResponse) {
    const responseData = await apiRes;

    expect(responseData.ok()).toBeTruthy();
  }
});

test('Dimension card click should redirect to test cases with applied filters', async ({
  page,
}) => {
  test.slow();

  await goToDataQualityDashboard(page);

  await page.waitForSelector('[data-testid="status-data-widget"]', {
    state: 'visible',
  });
  await waitForAllLoadersToDisappear(page);

  const dimensions = [
    { displayText: 'Accuracy', urlValue: 'Accuracy' },
    { displayText: 'Completeness', urlValue: 'Completeness' },
    { displayText: 'Consistency', urlValue: 'Consistency' },
    { displayText: 'Integrity', urlValue: 'Integrity' },
    { displayText: 'SQL', urlValue: 'SQL' },
    { displayText: 'Uniqueness', urlValue: 'Uniqueness' },
    { displayText: 'Validity', urlValue: 'Validity' },
    { displayText: 'No Dimension', urlValue: 'NoDimension' },
  ];

  for (const dimension of dimensions) {
    const currentUrl = page.url();
    if (!currentUrl.includes('/data-quality/dashboard')) {
      await goToDataQualityDashboard(page);
      await page.waitForSelector('[data-testid="status-data-widget"]', {
        state: 'visible',
      });
      await waitForAllLoadersToDisappear(page);
    }

    const dimensionCard = page
      .locator('[data-testid="status-data-widget"]')
      .filter({ hasText: dimension.displayText })
      .first();

    const cardCount = await dimensionCard.count();
    if (cardCount > 0) {
      await expect(dimensionCard).toBeVisible();

      const navigationPromise = page.waitForURL(
        new RegExp(
          `/data-quality/test-cases.*dataQualityDimension=${encodeURIComponent(
            dimension.urlValue
          )}`
        )
      );
      await dimensionCard.click();
      await navigationPromise;

      const url = page.url();

      expect(url).toContain(
        `dataQualityDimension=${encodeURIComponent(dimension.urlValue)}`
      );
      expect(url).toContain('/data-quality/test-cases');
    }
  }
});

test('Entity Health pie chart segment click redirects to Test Cases with correct status', async ({
  page,
}) => {
  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navFailed = page.waitForURL(
    /\/data-quality\/test-cases.*testCaseStatus=Failed/
  );
  await clickPieChartSegmentByIndex(page, ENTITY_HEALTH_PIE_CHART_TEST_ID, 1);
  await navFailed;
  await expect(page).toHaveURL(/\/data-quality\/test-cases/);
  expect(page.url()).toContain('testCaseStatus=Failed');
});

test('Test Case Result pie chart segment click redirects to Test Cases with correct status', async ({
  page,
}) => {
  test.slow();

  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navSuccess = page.waitForURL(
    /\/data-quality\/test-cases.*testCaseStatus=Success/
  );
  await clickPieChartSegmentByIndex(
    page,
    TEST_CASE_STATUS_PIE_CHART_TEST_ID,
    0
  );
  await navSuccess;
  await expect(page).toHaveURL(/\/data-quality\/test-cases/);
  expect(page.url()).toContain('testCaseStatus=Success');

  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navFailed = page.waitForURL(
    /\/data-quality\/test-cases.*testCaseStatus=Failed/
  );
  await clickPieChartSegmentByIndex(
    page,
    TEST_CASE_STATUS_PIE_CHART_TEST_ID,
    1
  );
  await navFailed;
  await expect(page).toHaveURL(/\/data-quality\/test-cases/);
  expect(page.url()).toContain('testCaseStatus=Failed');

  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navAborted = page.waitForURL(
    /\/data-quality\/test-cases.*testCaseStatus=Aborted/
  );
  await clickPieChartSegmentByIndex(
    page,
    TEST_CASE_STATUS_PIE_CHART_TEST_ID,
    2
  );
  await navAborted;
  await expect(page).toHaveURL(/\/data-quality\/test-cases/);
  expect(page.url()).toContain('testCaseStatus=Aborted');
});

test('Data Assets Coverage pie chart segment click redirects to Test Suites and Explore', async ({
  page,
}) => {
  test.slow();

  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navTestSuites = page.waitForURL(/\/data-quality\/test-suites/);
  await clickPieChartSegmentByIndex(
    page,
    DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
    0
  );
  await navTestSuites;
  await expect(page).toHaveURL(/\/data-quality\/test-suites/);

  await goToDataQualityDashboard(page);
  await expect(
    page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
  ).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  const navExplore = page.waitForURL(/\/explore/);
  await clickPieChartSegmentByIndex(
    page,
    DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
    1
  );
  await navExplore;
  await expect(page).toHaveURL(/\/explore/);
});
