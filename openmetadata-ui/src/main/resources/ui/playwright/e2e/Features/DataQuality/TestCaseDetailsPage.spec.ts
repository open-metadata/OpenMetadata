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
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { verifyTestCaseLastRunBanner } from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

const table = new TableClass();

const getTestCaseFqn = () =>
  table.testCasesResponseData[0].fullyQualifiedName as string;

const openDetailsPage = async (page: Page) => {
  await redirectToHomePage(page);
  await page.goto(
    `/observability/test-case/${encodeURIComponent(
      getTestCaseFqn()
    )}/test-case-results`
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('test-case-detail-page')).toBeVisible();
};

test.describe(
  'Test Case Details Page - Features',
  { tag: ['@Features', '@Observability'] },
  () => {
    test.beforeAll(
      'Create a table, a test case and one result',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

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

        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('renders the page frame with a two column result tab', async ({
      page,
    }) => {
      test.slow();

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
        const rail = await page.getByTestId('test-case-rail').boundingBox();
        const chart = await page.getByTestId('graph-container').boundingBox();

        expect(rail).not.toBeNull();
        expect(chart).not.toBeNull();
        expect(rail?.x).toBeGreaterThan(Number(chart?.x));
      });
    });

    test('leads the main column with the result history', async ({ page }) => {
      test.slow();

      await openDetailsPage(page);

      const chart = await page.getByTestId('graph-container').boundingBox();
      const parameters = await page
        .getByTestId('parameter-container')
        .boundingBox();

      expect(chart).not.toBeNull();
      expect(parameters).not.toBeNull();
      expect(chart?.y).toBeLessThan(Number(parameters?.y));
    });

    test('aligns the page header card with the tab body content', async ({
      page,
    }) => {
      test.slow();

      await openDetailsPage(page);

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
      test.slow();

      await openDetailsPage(page);

      await verifyTestCaseLastRunBanner(page, 'success');

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
  }
);
