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
import { DataQualityDimensions } from '../../../../src/generated/tests/testDefinition';
import { getCurrentMillis } from '../../../../src/utils/date-time/DateTimeUtils';
import { DOMAIN_TAGS } from '../../../constant/config';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage, uuid } from '../../../utils/common';
import {
  applyDashboardCertificationFilter,
  applyDashboardTagFilter,
  applyDashboardTierFilter,
  assertDimensionCard,
  assertEsFieldInReports,
  assertPieChartLegendCounts,
  captureReports,
  clickPieChartSegmentByIndex,
  DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
  ENTITY_HEALTH_PIE_CHART_TEST_ID,
  goToDataQualityDashboard,
  isDashboardReportBatchResponse,
  TEST_CASE_STATUS_PIE_CHART_TEST_ID,
  waitForIncidentToBeIndexed,
} from '../../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { visitDataQualityTab } from '../../../utils/testCases';

enum TestCaseStatus {
  Aborted = 'Aborted',
  Failed = 'Failed',
  Success = 'Success',
}

test.use({
  storageState: 'playwright/.auth/admin.json',
});

let table1: TableClass;
let table2: TableClass;
let table3: TableClass;
let user1: UserClass;
let classification: ClassificationClass;
let tag: TagClass;
let tier: TagClass;
let glossary: Glossary;
let glossaryTerm: GlossaryTerm;
let domain: Domain;
let dataProduct: DataProduct;

// Entities for the 4 dimension test cases (Accuracy/Completeness/Consistency/Uniqueness)
let table4: TableClass;
let tier2: TagClass;
let cert1: TagClass;
let cert2: TagClass;
let consistencyTestCaseName: string;
let uniquenessTestCaseName: string;
let accuracyTestCaseFqn: string;
let completenessTestCaseFqn: string;
let consistencyTestCaseFqn: string;
let uniquenessTestCaseFqn: string;
const dimTestDefIds: string[] = [];

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

test.describe(
  'Data Quality Dashboard',
  {
    tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`],
  },
  () => {
    test.beforeAll('setup pre-test', async ({ browser }) => {
      test.slow();
      table1 = new TableClass();
      table2 = new TableClass();
      table3 = new TableClass();
      user1 = new UserClass();
      classification = new ClassificationClass();
      tag = new TagClass({ classification: classification.data.name });
      tier = new TagClass({ classification: 'Tier' });
      glossary = new Glossary();
      glossaryTerm = new GlossaryTerm(glossary);
      domain = new Domain();
      dataProduct = new DataProduct([domain]);

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

      // --- 4 dimension test cases: Accuracy/Completeness/Consistency/Uniqueness ---
      // table3 gets cert1; table4 gets tier2 + cert2.
      // This keeps the existing tier-tagged tables intact for other tests while
      // giving each new dimension test case a distinct metadata signature.
      tier2 = new TagClass({ classification: 'Tier' });
      cert1 = new TagClass({ classification: 'Certification' });
      cert2 = new TagClass({ classification: 'Certification' });
      table4 = new TableClass();

      await tier2.create(apiContext);
      await cert1.create(apiContext);
      await cert2.create(apiContext);
      await table4.create(apiContext);

      // Add cert1 certification to table3 (keeps its existing tier tag).
      await table3.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/certification',
            value: {
              tagLabel: {
                tagFQN: cert1.responseData.fullyQualifiedName,
                source: 'Classification',
                labelType: 'Manual',
                state: 'Confirmed',
              },
            },
          },
        ],
      });

      // Add tier2 and cert2 to table4.
      await table4.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/tags/0',
            value: {
              name: tier2.data.name,
              tagFQN: tier2.responseData.fullyQualifiedName,
              labelType: 'Manual',
              state: 'Confirmed',
            },
          },
          {
            op: 'add',
            path: '/certification',
            value: {
              tagLabel: {
                tagFQN: cert2.responseData.fullyQualifiedName,
                source: 'Classification',
                labelType: 'Manual',
                state: 'Confirmed',
              },
            },
          },
        ],
      });

      // Create four custom test definitions, one per DQ dimension.
      // Each definition uses OpenMetadata platform so the dimension is indexed
      // on the test case document and visible in the dashboard dimension widgets.
      const [accuracyDef, completenessDef, consistencyDef, uniquenessDef] =
        await Promise.all(
          [
            DataQualityDimensions.Accuracy,
            DataQualityDimensions.Completeness,
            DataQualityDimensions.Consistency,
            DataQualityDimensions.Uniqueness,
          ].map((dim) =>
            apiContext
              .post('/api/v1/dataQuality/testDefinitions', {
                data: {
                  name: `pw_${dim.toLowerCase()}_def_${uuid()}`,
                  entityType: 'TABLE',
                  testPlatforms: ['OpenMetadata'],
                  dataQualityDimension: dim,
                  supportedDataTypes: ['NUMBER'],
                },
              })
              .then((r) => r.json())
          )
        );

      dimTestDefIds.push(
        accuracyDef.id,
        completenessDef.id,
        consistencyDef.id,
        uniquenessDef.id
      );

      // Accuracy → Success (table1, has existing "tier")
      const tcAccuracy = await table1.createTestCase(apiContext, {
        testDefinition: accuracyDef.fullyQualifiedName,
        parameterValues: [],
      });
      accuracyTestCaseFqn = tcAccuracy.fullyQualifiedName;

      // Completeness → Aborted (table2, has existing "tier")
      const tcCompleteness = await table2.createTestCase(apiContext, {
        testDefinition: completenessDef.fullyQualifiedName,
        parameterValues: [],
      });
      completenessTestCaseFqn = tcCompleteness.fullyQualifiedName;

      // Consistency → Failed / unresolved incident (table3, has "tier" + cert1)
      const tcConsistency = await table3.createTestCase(apiContext, {
        testDefinition: consistencyDef.fullyQualifiedName,
        parameterValues: [],
      });
      consistencyTestCaseName = tcConsistency.name;
      consistencyTestCaseFqn = tcConsistency.fullyQualifiedName;

      // Uniqueness → Failed / resolved incident (table4, has tier2 + cert2)
      const tcUniqueness = await table4.createTestCase(apiContext, {
        testDefinition: uniquenessDef.fullyQualifiedName,
        parameterValues: [],
      });
      uniquenessTestCaseName = tcUniqueness.name;
      uniquenessTestCaseFqn = tcUniqueness.fullyQualifiedName;

      // Add one test-case result per case with the prescribed status.
      await table1.addTestCaseResult(apiContext, accuracyTestCaseFqn, {
        testCaseStatus: 'Success',
        result: 'Accuracy check passed.',
        timestamp: getCurrentMillis(),
      });

      await table2.addTestCaseResult(apiContext, completenessTestCaseFqn, {
        testCaseStatus: 'Aborted',
        result: 'Completeness check aborted.',
        timestamp: getCurrentMillis(),
      });

      const consistencyFailTs = getCurrentMillis();
      await table3.addTestCaseResult(apiContext, consistencyTestCaseFqn, {
        testCaseStatus: 'Failed',
        result: 'Consistency check failed — data inconsistency detected.',
        timestamp: consistencyFailTs,
      });

      await waitForIncidentToBeIndexed(
        apiContext,
        consistencyTestCaseFqn,
        consistencyFailTs
      );

      const uniquenessFailTs = getCurrentMillis();
      await table4.addTestCaseResult(apiContext, uniquenessTestCaseFqn, {
        testCaseStatus: 'Failed',
        result: 'Uniqueness check failed — duplicate values found.',
        timestamp: uniquenessFailTs,
      });

      await waitForIncidentToBeIndexed(
        apiContext,
        uniquenessTestCaseFqn,
        uniquenessFailTs
      );

      const resolveTs = getCurrentMillis();
      await apiContext.post(
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        {
          data: {
            testCaseReference: uniquenessTestCaseFqn,
            testCaseResolutionStatusType: 'Resolved',
          },
        }
      );

      await waitForIncidentToBeIndexed(
        apiContext,
        uniquenessTestCaseFqn,
        resolveTs,
        'Resolved'
      );

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

      // Clean up entities created for the dimension test cases.
      for (const defId of dimTestDefIds) {
        await apiContext.delete(
          `/api/v1/dataQuality/testDefinitions/${defId}?hardDelete=true`
        );
      }
      await table4.delete(apiContext);
      await cert2.delete(apiContext);
      await cert1.delete(apiContext);
      await tier2.delete(apiContext);

      await afterAction();
    });

    // The dashboard coalesces every widget aggregation into one batched POST
    // whose body carries the filter `key`. Wait for that single round trip.
    const waitForDashboardApiResponses = (page: Page, key: string) => [
      page.waitForResponse((res) => isDashboardReportBatchResponse(res, key)),
    ];

    test('DataQualityDashboardTab', async ({ page }) => {
      test.slow();

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Filter by Owner and verify all API responses succeed', async () => {
        await page.getByRole('button', { name: 'Owner' }).click();
        await expect(page.getByTestId('select-owner-tabs')).toBeVisible();
        await waitForAllLoadersToDisappear(page);
        await page.getByRole('tab', { name: 'Users' }).click();
        await waitForAllLoadersToDisappear(page);
        await expect(
          page.getByTestId('owner-select-users-search-bar')
        ).toBeVisible();

        const searchOwner = page.waitForResponse(
          'api/v1/search/query?q=*&index=user*'
        );
        await page.getByTestId('owner-select-users-search-bar').clear();
        await page
          .getByTestId('owner-select-users-search-bar')
          .pressSequentially(user1.getUserDisplayName());
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

        await waitForAllLoadersToDisappear(page);

        // user1 owns table1 (Accuracy→Success), table2 (Completeness→Aborted),
        // table3 (Consistency→Failed). Verify dimension cards show expected counts.
        await assertDimensionCard(page, DataQualityDimensions.Accuracy, {
          total: '1',
          success: '1',
          failed: '0',
          aborted: '0',
        });
        await assertDimensionCard(page, DataQualityDimensions.Completeness, {
          total: '1',
          success: '0',
          failed: '0',
          aborted: '1',
        });
        await assertDimensionCard(page, DataQualityDimensions.Consistency, {
          total: '1',
          success: '0',
          failed: '1',
          aborted: '0',
        });
      });

      await test.step('Filter by Tier and verify all API responses succeed', async () => {
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

        await waitForAllLoadersToDisappear(page);

        // Dimension cards still show the same 3 tables (Owner ∩ Tier = same set).
        // Confirms tier filter scopes correctly and widgets reflect real data.
        await assertDimensionCard(page, DataQualityDimensions.Accuracy, {
          total: '1',
          success: '1',
          failed: '0',
          aborted: '0',
        });
        await assertDimensionCard(page, DataQualityDimensions.Completeness, {
          total: '1',
          success: '0',
          failed: '0',
          aborted: '1',
        });
        await assertDimensionCard(page, DataQualityDimensions.Consistency, {
          total: '1',
          success: '0',
          failed: '1',
          aborted: '0',
        });

        // Test Case Status pie chart: table1(4 success) + table2(3 failed+1 aborted)
        // + table3(3 aborted+1 failed) = 4 success, 4 failed, 4 aborted (12 total).
        await assertPieChartLegendCounts(
          page,
          'test-case-status-pie-chart-widget',
          { success: '4', failed: '4', aborted: '4' }
        );

        // Entity Health pie chart: table1 is healthy (all success), table2 and
        // table3 are unhealthy (have failed test cases).
        await assertPieChartLegendCounts(
          page,
          'entity-health-pie-chart-widget',
          { healthy: '1', unhealthy: '2' }
        );
      });

      await test.step('Filter by Tag and verify all API responses succeed', async () => {
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

        await waitForAllLoadersToDisappear(page);
        await expect(
          page.locator('[data-testid="status-data-widget"]').first()
        ).toBeVisible();
      });

      await test.step('Filter by Glossary Term and verify all API responses succeed', async () => {
        await page.getByRole('button', { name: 'Glossary Term' }).click();
        await page.getByTestId('search-input').click();
        const glossaryTermSearchApi = page.waitForResponse(
          '/api/v1/search/query?*q=*index=glossaryTerm*'
        );
        await page.getByTestId('search-input').fill(glossaryTerm.data.name);
        await glossaryTermSearchApi;
        await page
          .getByText(glossaryTerm.responseData.fullyQualifiedName)
          .click();
        const glossaryTermApiResponse = waitForDashboardApiResponses(
          page,
          glossaryTerm.responseData.name
        );
        await page.getByTestId('update-btn').click();
        for (const apiRes of glossaryTermApiResponse) {
          const responseData = await apiRes;

          expect(responseData.ok()).toBeTruthy();
        }

        await waitForAllLoadersToDisappear(page);
        await expect(
          page.locator('[data-testid="status-data-widget"]').first()
        ).toBeVisible();
      });

      await test.step('Filter by Data Product and verify all API responses succeed', async () => {
        await page.getByRole('button', { name: 'Data Product' }).click();
        await page.getByTestId('search-input').click();
        const dataProductSearchApi = page.waitForResponse(
          '/api/v1/search/query?*q=*index=dataProduct*'
        );
        await page
          .getByTestId('search-input')
          .fill(
            dataProduct.responseData.displayName ?? dataProduct.data.displayName
          );
        await dataProductSearchApi;
        await page
          .getByText(
            dataProduct.responseData.displayName ?? dataProduct.data.displayName
          )
          .click();
        const dataProductApiResponse = waitForDashboardApiResponses(
          page,
          dataProduct.data.name
        );
        await page.getByTestId('update-btn').click();
        for (const apiRes of dataProductApiResponse) {
          const responseData = await apiRes;

          expect(responseData.ok()).toBeTruthy();
        }

        await waitForAllLoadersToDisappear(page);
        await expect(
          page.locator('[data-testid="status-data-widget"]').first()
        ).toBeVisible();
      });

      await test.step('Verify New incident for Consistency test case on table3 DQ tab', async () => {
        await visitDataQualityTab(page, table3);
        await expect(
          page.locator(
            `[data-testid="status-badge-${consistencyTestCaseName}"]`
          )
        ).toContainText('Failed');
        await expect(
          page.locator(`[data-testid="${consistencyTestCaseName}-status"]`)
        ).toContainText('New');
      });

      await test.step('Verify Resolved incident for Uniqueness test case on table4 DQ tab', async () => {
        await visitDataQualityTab(page, table4);
        await expect(
          page.locator(`[data-testid="status-badge-${uniquenessTestCaseName}"]`)
        ).toContainText('Failed');
        await expect(
          page.locator(`[data-testid="${uniquenessTestCaseName}-status"]`)
        ).toContainText('Resolved');
      });

      await test.step('Filter by Certification and verify Uniqueness widget shows 1 Failed test case', async () => {
        // Navigate fresh so the accumulated filters above do not interfere.
        // table4 (cert2) is not owned by user1 and does not carry the tier/tag/glossary
        // labels from previous steps, so a clean page is required.
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);

        await applyDashboardCertificationFilter(
          page,
          cert2.data.name,
          cert2.responseData.fullyQualifiedName
        );
        await waitForAllLoadersToDisappear(page);

        // table4 has exactly one test case: Uniqueness → Failed
        await assertDimensionCard(page, DataQualityDimensions.Uniqueness, {
          total: '1',
          success: '0',
          failed: '1',
          aborted: '0',
        });
      });
    });

    test('Dashboard batches all report aggregations into one request (no N+1)', async ({
      page,
    }) => {
      const batchBodies: Array<{ requests?: unknown[] }> = [];
      let individualReportGetCount = 0;
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/dataQualityReport/batch')) {
          const body = req.postData();
          if (body) {
            batchBodies.push(JSON.parse(body));
          }
        } else if (
          url.includes('/dataQualityReport') &&
          req.method() === 'GET'
        ) {
          individualReportGetCount += 1;
        }
      });

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Widgets coalesce into batch POST(s) with no per-widget GET fan-out', () => {
        // The N+1 is gone: not a single per-widget GET dataQualityReport fired.
        expect(individualReportGetCount).toBe(0);
        expect(batchBodies.length).toBeGreaterThan(0);

        // One round trip carries every widget aggregation across the dashboard.
        const totalAggregations = batchBodies.reduce(
          (sum, body) => sum + (body.requests?.length ?? 0),
          0
        );

        expect(totalAggregations).toBeGreaterThanOrEqual(10);
      });
    });

    test('Tier filter sends tier.tagFQN field in ES query (not tags.tagFQN)', async ({
      page,
    }) => {
      const reports = captureReports(page);

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Apply Tier filter', async () => {
        await applyDashboardTierFilter(
          page,
          tier.responseData.fullyQualifiedName
        );
      });

      await test.step('Verify ES query uses tier.tagFQN field (not tags.tagFQN)', () => {
        assertEsFieldInReports(
          reports,
          tier.responseData.fullyQualifiedName,
          'tier.tagFQN',
          '"tags.tagFQN":"' + tier.responseData.fullyQualifiedName + '"'
        );
      });
    });

    test('Tag filter sends tags.tagFQN field in ES query', async ({ page }) => {
      const reports = captureReports(page);

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Apply Tag filter', async () => {
        await applyDashboardTagFilter(
          page,
          tag.data.name,
          tag.responseData.fullyQualifiedName
        );
      });

      await test.step('Verify ES query uses tags.tagFQN field', () => {
        assertEsFieldInReports(
          reports,
          tag.responseData.fullyQualifiedName,
          'tags.tagFQN'
        );
      });
    });

    test('Tier and Tag filters produce independent ES filter clauses', async ({
      page,
    }) => {
      const reports = captureReports(page);

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Apply Tier filter', async () => {
        await applyDashboardTierFilter(
          page,
          tier.responseData.fullyQualifiedName
        );
      });

      await test.step('Apply Tag filter', async () => {
        await applyDashboardTagFilter(
          page,
          tag.data.name,
          tag.responseData.fullyQualifiedName
        );
      });

      await test.step('Verify tier and tag appear in separate must clauses', () => {
        const tierFqn = tier.responseData.fullyQualifiedName;
        const tagFqn = tag.responseData.fullyQualifiedName;
        const combinedReports = reports.filter(
          (r) => r.q.includes(tierFqn) && r.q.includes(tagFqn)
        );

        expect(combinedReports.length).toBeGreaterThan(0);

        for (const report of combinedReports) {
          const mustClauses: unknown[] =
            JSON.parse(report.q)?.query?.bool?.must ?? [];

          expect(
            mustClauses.some((c) => JSON.stringify(c).includes('tier.tagFQN'))
          ).toBe(true);
          expect(
            mustClauses.some((c) => JSON.stringify(c).includes('tags.tagFQN'))
          ).toBe(true);
          expect(
            mustClauses.some((c) => {
              const s = JSON.stringify(c);

              return s.includes('tier.tagFQN') && s.includes('tags.tagFQN');
            })
          ).toBe(false);
        }
      });
    });

    test('Dimension card click should redirect to test cases with applied filters', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator('[data-testid="status-data-widget"]').first()
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

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
        await test.step(`Click ${dimension.displayText} dimension card and verify redirect`, async () => {
          if (!page.url().includes('/data-quality/dashboard')) {
            await goToDataQualityDashboard(page);
            await expect(
              page.locator('[data-testid="status-data-widget"]').first()
            ).toBeVisible();
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

            expect(page.url()).toContain(
              `dataQualityDimension=${encodeURIComponent(dimension.urlValue)}`
            );
            expect(page.url()).toContain('/data-quality/test-cases');
          }
        });
      }
    });

    test('Entity Health pie chart segment click redirects to Test Cases with correct status', async ({
      page,
    }) => {
      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click failed segment and verify redirect to failed test cases', async () => {
        const navFailed = page.waitForURL(
          /\/data-quality\/test-cases.*testCaseStatus=Failed/
        );
        await clickPieChartSegmentByIndex(
          page,
          ENTITY_HEALTH_PIE_CHART_TEST_ID,
          1
        );
        await navFailed;
        await expect(page).toHaveURL(/\/data-quality\/test-cases/);
        expect(page.url()).toContain('testCaseStatus=Failed');
      });
    });

    test('Test Case Result pie chart segment click redirects to Test Cases with correct status', async ({
      page,
    }) => {
      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click success segment and verify redirect', async () => {
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
      });

      await test.step('Navigate back to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click failed segment and verify redirect', async () => {
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
      });

      await test.step('Navigate back to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click aborted segment and verify redirect', async () => {
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
    });

    test('Data Assets Coverage pie chart segment click redirects to Test Suites and Explore', async ({
      page,
    }) => {
      await test.step('Navigate to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click covered segment and verify redirect to Test Suites', async () => {
        const navTestSuites = page.waitForURL(/\/data-quality\/test-suites/);
        await clickPieChartSegmentByIndex(
          page,
          DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
          0
        );
        await navTestSuites;
        await expect(page).toHaveURL(/\/data-quality\/test-suites/);
      });

      await test.step('Navigate back to Data Quality dashboard', async () => {
        await goToDataQualityDashboard(page);
        await expect(
          page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
        ).toBeVisible();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Click not covered segment and verify redirect to Explore', async () => {
        const navExplore = page.waitForURL(/\/explore/);
        await clickPieChartSegmentByIndex(
          page,
          DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
          1
        );
        await navExplore;
        await expect(page).toHaveURL(/\/explore/);
      });
    });

    test('Test Cases list filter — Data Product', async ({ page }) => {
      const dataProductDisplayName =
        dataProduct.responseData.displayName ?? dataProduct.data.displayName;

      await test.step('Navigate to DQ Test Cases tab', async () => {
        await page.goto('/data-quality/test-cases');
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Add Data Product advanced filter', async () => {
        const dataProductOptionsRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataProduct*'
        );
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="dataProductFqn"]');
        await dataProductOptionsRes;

        await expect(
          page.getByTestId('data-product-select-filter')
        ).toBeVisible();
      });

      await test.step('Select data product and verify API carries dataProductFqn', async () => {
        await page.click('#dataProductFqn');
        const filterApiRes = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/dataQuality/testCases/search/list') &&
            r.url().includes('dataProductFqn')
        );
        await page
          .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
          .getByText(dataProductDisplayName)
          .click();
        await filterApiRes;
      });

      await test.step('Remove Data Product filter', async () => {
        const getTestCases = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list?*'
        );
        await page.click('[data-testid="advanced-filter"]');
        await page.click('[value="dataProductFqn"]');
        await getTestCases;

        await expect(
          page.getByTestId('data-product-select-filter')
        ).not.toBeVisible();
      });
    });
  }
);
