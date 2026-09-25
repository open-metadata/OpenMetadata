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
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { escapeRegExp, isUndefined } from 'lodash';
import { BundleTestSuiteClass } from '../../../support/entity/BundleTestSuiteClass';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { getCurrentMillis } from '../../../utils/dateTime';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  openTestCaseDetailsPage,
  verifyTestCaseLastRunBanner,
} from '../../../utils/testCases';
import { test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

// Created in `beforeAll` rather than at module scope: the generated entity
// name is fixed at construction, so a retry that reuses this worker would
// re-run `create` with the same name and get a 409.
let table!: TableClass;
let bundleSuite: BundleTestSuiteClass;

const openDetailsPage = async (page: Page) => {
  await enableAiAppMode(page);
  await openTestCaseDetailsPage(
    page,
    table.testCasesResponseData[0].fullyQualifiedName as string
  );
};

test.describe(
  'Test Case Details Page - Features',
  { tag: ['@Features', '@Observability'] },
  () => {
    test.beforeAll(
      'Create a table, a test case in a bundle suite and one result',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        table = new TableClass();

        await table.create(apiContext);
        const testCase = await table.createTestCase(apiContext);
        await table.addTestCaseResult(
          apiContext,
          testCase.fullyQualifiedName as string,
          {
            result: 'Found rowCount=20 vs. the expected range 12 to 34',
            testCaseStatus: 'Success',
            timestamp: Date.now(),
          }
        );

        bundleSuite = new BundleTestSuiteClass();
        await bundleSuite.createBundleTestSuite(apiContext);
        const addResponse = await bundleSuite.addTestCases(apiContext, [
          testCase.id as string,
        ]);
        expect(addResponse.status()).toBe(200);

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await bundleSuite.delete(apiContext);
      await table.delete(apiContext);
      await afterAction();
    });

    test('lists the test suites the test case belongs to, above the tags', async ({
      page,
    }) => {
      await openDetailsPage(page);

      const testSuites = page.getByTestId('test-suites-container');
      const tableSuiteLink = testSuites.getByTestId(
        `test-suite-link-${table.testSuiteResponseData.fullyQualifiedName}`
      );
      const bundleSuiteLink = testSuites.getByTestId(
        `test-suite-link-${bundleSuite.bundleTestSuiteResponseData.fullyQualifiedName}`
      );

      await test.step('The table suite links to its table and the bundle suite to its page', async () => {
        await expect(tableSuiteLink).toHaveAccessibleName(
          `Table ${table.entityResponseData.name}`
        );
        await expect(bundleSuiteLink).toHaveAccessibleName(
          `Bundle Suite ${bundleSuite.bundleTestSuiteResponseData.name}`
        );
        await expect(tableSuiteLink).toHaveAttribute(
          'href',
          /\/profiler\/data-quality$/
        );
        // Matched as a suffix, like the table suite above. `openDetailsPage`
        // enables AI mode, and `getTestSuitePath` namespaces the route under
        // `/observability` there — in OSS since #33502, and in Collate through
        // its override — so pinning either literal asserts a prefix this spec
        // has no business knowing.
        await expect(bundleSuiteLink).toHaveAttribute(
          'href',
          new RegExp(
            `/test-suites/${escapeRegExp(
              bundleSuite.bundleTestSuiteResponseData
                .fullyQualifiedName as string
            )}$`
          )
        );
      });

      await test.step('Only the name is the link, the rest of the row does not navigate', async () => {
        const detailsUrl = page.url();

        await testSuites
          .getByRole('listitem')
          .filter({
            has: page.getByTestId(
              `test-suite-link-${table.testSuiteResponseData.fullyQualifiedName}`
            ),
          })
          .locator('svg')
          .click();

        await expect(page).toHaveURL(detailsUrl);
      });

      await test.step('The panel sits above the tags', async () => {
        const suitesBox = await testSuites.boundingBox();
        const tagsBox = await page.getByTestId('tags-container').boundingBox();

        expect(suitesBox).not.toBeNull();
        expect(tagsBox).not.toBeNull();
        expect(Number(suitesBox?.y)).toBeLessThan(Number(tagsBox?.y));
      });

      await test.step('The panel collapses like the tags panel', async () => {
        await testSuites.getByTestId('expand-collapse-icon').click();

        await expect(bundleSuiteLink).toBeHidden();
      });
    });

    test('renders the page frame with a two column result tab', async ({
      page,
    }) => {
      await test.step('Open the app mode details page', async () => {
        await openDetailsPage(page);
      });

      await test.step('Header and tab strip render', async () => {
        await expect(page.getByTestId('entity-page-header')).toBeVisible();
        await expect(
          page.getByRole('tab', { name: 'Test Case Results' })
        ).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Incident' })).toBeVisible();
      });

      await test.step('Main column and rail both render', async () => {
        await expect(
          page.getByTestId('test-case-result-tab-container')
        ).toBeVisible();
        await expect(page.getByTestId('test-case-rail')).toBeVisible();
        await expect(page.getByTestId('graph-container')).toBeVisible();
      });

      await test.step('The rail sits to the right of the main column', async () => {
        await expect(page.getByTestId('test-case-rail')).toBeVisible();
        await expect(page.getByTestId('graph-container')).toBeVisible();

        const rail = await page.getByTestId('test-case-rail').boundingBox();
        const chart = await page.getByTestId('graph-container').boundingBox();

        expect(rail).not.toBeNull();
        expect(chart).not.toBeNull();
        expect(rail?.x).toBeGreaterThan(Number(chart?.x));
      });
    });

    test('leads the main column with the result history', async ({ page }) => {
      await openDetailsPage(page);

      await expect(page.getByTestId('graph-container')).toBeVisible();

      // TCD-10a moved the configuration into the rail, so the chart is the
      // first block in the main column and the card sits to its right.
      const chart = await page.getByTestId('graph-container').boundingBox();
      const configuration = await page
        .getByTestId('test-case-configuration-card')
        .boundingBox();

      expect(chart).not.toBeNull();
      expect(configuration).not.toBeNull();
      expect(configuration?.x).toBeGreaterThan(Number(chart?.x));
    });

    test('renders the configuration card for a table test', async ({
      page,
    }) => {
      await openDetailsPage(page);

      // TableClass seeds a `tableRowCountToBeBetween` test on the table
      // itself — a table test with minValue 12 / maxValue 34.
      const card = page.getByTestId('test-case-configuration-card');

      await expect(card).toBeVisible();
      await expect(page.getByTestId('test-case-rail')).toContainText(
        'Configuration'
      );
      await expect(card.getByTestId('configuration-category')).toHaveText(
        'Table test'
      );

      const minRow = card.getByTestId('configuration-parameter-minValue');
      const maxRow = card.getByTestId('configuration-parameter-maxValue');

      await expect(minRow).toContainText('minValue');
      await expect(minRow).toContainText('12');
      await expect(maxRow).toContainText('maxValue');
      await expect(maxRow).toContainText('34');
    });

    test('insets the page header card 8px less than the tab body content', async ({
      page,
    }) => {
      await openDetailsPage(page);

      await expect(
        page.getByTestId('test-case-header-container')
      ).toBeVisible();
      await expect(
        page.getByTestId('test-case-result-tab-container')
      ).toBeVisible();

      const headerCard = await page
        .getByTestId('test-case-header-container')
        .boundingBox();
      const grid = await page
        .getByTestId('test-case-result-tab-container')
        .boundingBox();

      expect(headerCard).not.toBeNull();
      expect(grid).not.toBeNull();

      // AI padding standard: the header band sits 8px inside the shell and
      // page content 16px, so the header card extends 8px past the tab body
      // on each side.
      const headerOutset = 8;

      expect(Math.round(Number(headerCard?.x))).toBe(
        Math.round(Number(grid?.x)) - headerOutset
      );
      expect(
        Math.round(Number(headerCard?.x) + Number(headerCard?.width))
      ).toBe(Math.round(Number(grid?.x) + Number(grid?.width)) + headerOutset);
    });

    test('aligns the last run banner with the tab body grid', async ({
      page,
    }) => {
      await openDetailsPage(page);

      await verifyTestCaseLastRunBanner(page, 'success');

      await expect(
        page.getByTestId('test-case-result-tab-container')
      ).toBeVisible();

      const banner = await page
        .getByTestId('test-case-last-run-banner-success')
        .boundingBox();
      const grid = await page
        .getByTestId('test-case-result-tab-container')
        .boundingBox();

      expect(banner).not.toBeNull();
      expect(grid).not.toBeNull();
      expect(Math.round(Number(banner?.x))).toBe(Math.round(Number(grid?.x)));
      expect(Math.round(Number(banner?.x) + Number(banner?.width))).toBe(
        Math.round(Number(grid?.x) + Number(grid?.width))
      );
    });

    test('opens the app mode details page from the Data Quality test cases tab', async ({
      page,
    }) => {
      const testCaseName = table.testCasesResponseData[0].name as string;
      const isTestCaseListResponse = (url: URL) =>
        url.pathname.endsWith('/dataQuality/testCases/search/list');

      await test.step('Open the Test Cases tab in app mode', async () => {
        await enableAiAppMode(page);
        await page.goto('/observability/data-quality', {
          waitUntil: 'domcontentloaded',
        });
        await waitForAllLoadersToDisappear(page);

        const listResponse = page.waitForResponse((response) =>
          isTestCaseListResponse(new URL(response.url()))
        );
        await page.getByRole('tab', { name: 'Test Cases' }).click();
        await listResponse;

        await expect(page).toHaveURL(
          /\/observability\/data-quality\/test-cases/
        );
      });

      await test.step('Search for the test case', async () => {
        const searchResponse = page.waitForResponse((response) => {
          const url = new URL(response.url());

          return (
            isTestCaseListResponse(url) &&
            url.searchParams.get('q') === testCaseName
          );
        });
        await page.getByTestId('searchbar').fill(testCaseName);
        await searchResponse;

        await expect(page.getByTestId(testCaseName)).toBeVisible();
      });

      await test.step('Test case link stays inside app mode', async () => {
        await page.getByTestId(testCaseName).getByRole('link').click();

        await expect(page).toHaveURL(
          /\/observability\/test-case\/[^/]+\/test-case-results/
        );
        await expect(page.getByTestId('test-case-detail-page')).toBeVisible();
      });
    });
  }
);

test.describe(
  'Test Case Details Page - Incident strip',
  { tag: ['@Observability'] },
  () => {
    let failedTable: TableClass;
    let failedTestCase: { name: string; fullyQualifiedName: string };

    test.beforeAll(
      'Create a test case whose failed run opens an incident',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        failedTable = new TableClass();
        await failedTable.create(apiContext);
        const testCase = await failedTable.createTestCase(apiContext);
        failedTestCase = {
          name: testCase.name as string,
          fullyQualifiedName: testCase.fullyQualifiedName as string,
        };

        const failedTimestamp = getCurrentMillis();
        await failedTable.addTestCaseResult(
          apiContext,
          failedTestCase.fullyQualifiedName,
          {
            result: 'Found rowCount=2 vs. the expected range 12 to 34',
            testCaseStatus: 'Failed',
            timestamp: failedTimestamp,
          }
        );

        // The incident is opened asynchronously by the server once the failed
        // result lands, so the strip has nothing to render until it exists.
        await expect
          .poll(
            async () => {
              // Filtered by FQN server-side: an unfiltered window holds every
              // incident other workers opened at the same time, and the
              // endpoint's default page of 10 can drop this one.
              const response = await apiContext.get(
                `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&testCaseFQN=${encodeURIComponent(
                  failedTestCase.fullyQualifiedName
                )}&startTs=${failedTimestamp - 60_000}&endTs=${
                  failedTimestamp + 60_000
                }`
              );
              const { data } = await response.json();

              return Boolean(data?.length);
            },
            { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
          )
          .toBe(true);

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await failedTable.delete(apiContext);
      await afterAction();
    });

    test('acknowledges the incident from the failed run banner', async ({
      page,
    }) => {
      await enableAiAppMode(page);
      await openTestCaseDetailsPage(page, failedTestCase.fullyQualifiedName);

      const banner = await verifyTestCaseLastRunBanner(page, 'failed');
      const strip = page.getByTestId('test-case-last-run-incident');
      const acknowledge = strip.getByTestId('acknowledge-incident-button');
      const headerStatus = page.getByTestId(`${failedTestCase.name}-status`);

      await test.step('The strip carries the reason and a new incident', async () => {
        await expect(banner).toContainText(
          'Found rowCount=2 vs. the expected range 12 to 34'
        );
        await expect(strip).toBeVisible();
        await expect(strip.getByTestId('test-case-incident-status')).toHaveText(
          'New'
        );
        await expect(acknowledge).toBeVisible();
      });

      await test.step('Acknowledge updates the strip and the header chip', async () => {
        const transition = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tasks/') &&
            response.url().endsWith('/resolve') &&
            response.request().method() === 'POST'
        );
        await acknowledge.click();
        await transition;

        await expect(strip.getByTestId('test-case-incident-status')).toHaveText(
          'Acknowledged'
        );
        await expect(acknowledge).toBeHidden();
        await expect(headerStatus).toContainText('Ack');
      });
    });
  }
);

test.describe(
  'Test Case Details Page - Result history chart',
  { tag: ['@Observability'] },
  () => {
    let chartTable: TableClass;
    let chartTestCaseFqn: string;

    test.beforeAll(
      'Create a test case whose history holds an aborted run',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        chartTable = new TableClass();
        await chartTable.create(apiContext);
        const testCase = await chartTable.createTestCase(apiContext, {
          testDefinition: 'tableRowCountToEqual',
          parameterValues: [{ name: 'value', value: 10000 }],
        });
        chartTestCaseFqn = testCase.fullyQualifiedName as string;

        const now = getCurrentMillis();
        const hour = 3_600_000;

        // Several plotted runs with an aborted one in the middle: the chart
        // has to place both a value and a run that produced none, and the
        // aborted point stays clear of the plot edge, where its own tooltip
        // would otherwise flip over it.
        const runs = [9980, 10020, undefined, 9990, 10010];

        for (const [index, value] of runs.entries()) {
          await chartTable.addTestCaseResult(apiContext, chartTestCaseFqn, {
            result: isUndefined(value)
              ? 'The query timed out before a row count could be taken'
              : `Found rowCount=${value} vs. the expected 10000`,
            testCaseStatus: isUndefined(value) ? 'Aborted' : 'Success',
            ...(isUndefined(value)
              ? {}
              : { testResultValue: [{ name: 'value', value: String(value) }] }),
            timestamp: now - (runs.length - index) * hour,
          });
        }

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await chartTable.delete(apiContext);
      await afterAction();
    });

    test('plots the expectation line, the aborted run and the selection', async ({
      page,
    }) => {
      await enableAiAppMode(page);
      await openTestCaseDetailsPage(page, chartTestCaseFqn);

      const chart = page.getByTestId('graph-container');
      // The aborted run sits on the value line itself, told apart by status.
      const abortedPoint = chart.locator(
        '[data-testid="test-summary-point-value"][data-status="Aborted"]'
      );

      await test.step('The expectation line carries the asserted value', async () => {
        await expect(chart.locator('.recharts-reference-line text')).toHaveText(
          'Expected 10,000'
        );
      });

      await test.step('A run that produced no value is still plotted', async () => {
        await expect(abortedPoint).toBeAttached();
      });

      await test.step('A single series draws no legend', async () => {
        await expect(chart.locator('.recharts-legend-item')).toHaveCount(0);
      });

      await test.step('Clicking a run moves the selection guide', async () => {
        const guides = chart.locator('.recharts-reference-line line');
        const before = await guides.evaluateAll((lines) =>
          lines.map((line) => line.getAttribute('x1')).join(',')
        );

        await abortedPoint.click();

        await expect
          .poll(async () =>
            guides.evaluateAll((lines) =>
              lines.map((line) => line.getAttribute('x1')).join(',')
            )
          )
          .not.toBe(before);
      });
    });
  }
);

test.describe(
  'Test Case Details Page - Result history card',
  { tag: ['@Observability'] },
  () => {
    let cardTable: TableClass;
    let cardTestCaseFqn: string;

    test.beforeAll(
      'Create a test case with runs today and earlier in the month',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        cardTable = new TableClass();
        await cardTable.create(apiContext);
        const testCase = await cardTable.createTestCase(apiContext, {
          testDefinition: 'tableRowCountToEqual',
          parameterValues: [{ name: 'value', value: 10000 }],
        });
        cardTestCaseFqn = testCase.fullyQualifiedName as string;

        const now = getCurrentMillis();
        const minute = 60_000;
        const day = 86_400_000;

        // Three runs minutes ago and two more than a week back, so narrowing
        // the window to today drops exactly the older two.
        const runs = [
          { at: now - 12 * day, status: 'Aborted' },
          { at: now - 10 * day, status: 'Success' },
          { at: now - 3 * minute, status: 'Success' },
          { at: now - 2 * minute, status: 'Failed' },
          { at: now - minute, status: 'Success' },
        ];

        for (const run of runs) {
          await cardTable.addTestCaseResult(apiContext, cardTestCaseFqn, {
            result: `Run ${run.status}`,
            testCaseStatus: run.status,
            ...(run.status === 'Aborted'
              ? {}
              : { testResultValue: [{ name: 'value', value: '10000' }] }),
            timestamp: run.at,
          });
        }

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await cardTable.delete(apiContext);
      await afterAction();
    });

    test('captions the chart and recounts the tiles for a new range', async ({
      page,
    }) => {
      await enableAiAppMode(page);
      await openTestCaseDetailsPage(page, cardTestCaseFqn);

      const card = page.getByTestId('test-summary-container');
      const tile = (key: string) =>
        card.getByTestId(`run-summary-${key}`).locator('[data-value]');

      await test.step('The header names what the chart measures', async () => {
        await expect(
          card.getByRole('heading', { name: 'Result history' })
        ).toBeVisible();
        await expect(card.getByTestId('result-history-caption')).toHaveText(
          'Row count vs. expected 10,000'
        );
      });

      await test.step('The tiles count the default 30-day window', async () => {
        await expect(tile('runs')).toHaveText('5');
        await expect(tile('passed')).toHaveText('3');
        await expect(tile('failed')).toHaveText('1');
        await expect(tile('aborted')).toHaveText('1');
        await expect(tile('success-rate')).toHaveText('60%');
      });

      await test.step('Narrowing the range to today recounts them', async () => {
        await card
          .getByRole('button', { name: 'Calendar Date range picker' })
          .click();
        await page.getByRole('button', { name: 'Today', exact: true }).click();

        const resultsResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/testCaseResults/') &&
            response.request().method() === 'GET'
        );
        await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await resultsResponse;

        await expect(tile('runs')).toHaveText('3');
        await expect(tile('passed')).toHaveText('2');
        await expect(tile('failed')).toHaveText('1');
        await expect(tile('aborted')).toHaveText('0');
        await expect(tile('success-rate')).toHaveText('66.7%');
      });
    });
  }
);
