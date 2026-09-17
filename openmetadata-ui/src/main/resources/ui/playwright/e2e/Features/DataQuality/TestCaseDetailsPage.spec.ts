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
import { escapeRegExp } from 'lodash';
import { BundleTestSuiteClass } from '../../../support/entity/BundleTestSuiteClass';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
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
        // Matched as a suffix, like the table suite above: the observability
        // router is overridden downstream to namespace these routes (Collate
        // in AI app mode serves them under `/observability`), so pinning the
        // OSS literal asserts a prefix this spec has no business knowing.
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

    test('aligns the page header card with the tab body content', async ({
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
      expect(Math.round(Number(headerCard?.x))).toBe(
        Math.round(Number(grid?.x))
      );
      expect(
        Math.round(Number(headerCard?.x) + Number(headerCard?.width))
      ).toBe(Math.round(Number(grid?.x) + Number(grid?.width)));
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
