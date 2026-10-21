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

import { expect } from '@playwright/test';
import { parse } from 'papaparse';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { okJson } from '../../../utils/apiResponse';
import {
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { getRowByName } from '../../../utils/scopedLocators';
import {
  clickManageButton,
  navigateToBulkEditPage,
  performTestCaseExport,
  visitDataQualityTab,
} from '../../../utils/testCases';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';

test.describe(
  'Table test case list and export filters',
  { tag: ['@Features', '@Observability', '@import-export'] },
  () => {
    let table: TableClass;
    let search: string;
    let matchingName: string;
    let otherFailedName: string;
    let successfulName: string;

    test.beforeAll(async ({ browser }) => {
      table = new TableClass({ service: new DatabaseServiceClass() });
      search = `nulls_${uuid()}`;
      matchingName = `${search}_failed`;
      successfulName = `${search}_success`;
      otherFailedName = `other_${uuid()}`;
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await table.create(apiContext);
        for (const [name, status] of [
          [matchingName, 'Failed'],
          [otherFailedName, 'Failed'],
          [successfulName, 'Success'],
        ]) {
          const testCase = await table.createTestCase(apiContext, { name });
          await table.addTestCaseResult(
            apiContext,
            testCase.fullyQualifiedName,
            {
              result: 'Filter regression',
              testCaseStatus: status,
              timestamp: Date.now(),
            }
          );
        }
        await expect
          .poll(async () => {
            const response = await okJson<{
              data: {
                name: string;
                testCaseResult?: { testCaseStatus: string };
              }[];
            }>(
              await apiContext.get(
                '/api/v1/dataQuality/testCases/search/list',
                {
                  params: {
                    entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
                    fields: 'testCaseResult',
                  },
                }
              ),
              'Wait for test case results to be indexed'
            );

            return response.data
              .map(
                ({ name, testCaseResult }) =>
                  `${name}:${testCaseResult?.testCaseStatus}`
              )
              .sort();
          })
          .toEqual(
            [
              `${matchingName}:Failed`,
              `${otherFailedName}:Failed`,
              `${successfulName}:Success`,
            ].sort()
          );
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      try {
        await table.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test('keeps matching rows when searching, filtering, sorting, exporting and opening Bulk Edit', async ({
      page,
    }) => {
      await test.step('Search, then select Failed without losing the search', async () => {
        await visitDataQualityTab(page, table);
        const searchResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/dataQuality/testCases/search/list') &&
            response.request().method() === 'GET' &&
            new URL(response.url()).searchParams.get('q') === search,
          200
        );
        await page
          .getByTestId('quality-tab-search')
          .getByRole('textbox')
          .fill(search);
        await searchResponse;
        await expect(getRowByName(page, matchingName)).toBeVisible();
        await expect(getRowByName(page, successfulName)).toBeVisible();

        const statusResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/dataQuality/testCases/search/list') &&
            response.request().method() === 'GET' &&
            new URL(response.url()).searchParams.get('testCaseStatus') ===
              'Failed',
          200
        );
        const trigger = page
          .getByTestId('classic-quality-status-filter')
          .getByRole('button');
        await scrollIntoViewAndSettle(trigger);
        await selectOptionWithRetry(
          trigger,
          page.getByRole('option', { name: 'Failed', exact: true })
        );
        const response = await statusResponse;

        expect(new URL(response.url()).searchParams.get('q')).toBe(search);
        await expect(getRowByName(page, matchingName)).toBeVisible();
        await expect(getRowByName(page, otherFailedName)).not.toBeVisible();
        await expect(getRowByName(page, successfulName)).not.toBeVisible();
      });

      await test.step('Sorting preserves both filters', async () => {
        const sortResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/dataQuality/testCases/search/list') &&
            response.request().method() === 'GET' &&
            new URL(response.url()).searchParams.get('sortField') ===
              'name.keyword',
          200
        );
        await page.getByRole('columnheader', { name: /^Name/ }).click();
        const response = await sortResponse;

        expect(new URL(response.url()).searchParams.get('q')).toBe(search);
        expect(new URL(response.url()).searchParams.get('testCaseStatus')).toBe(
          'Failed'
        );
        await expect(getRowByName(page, matchingName)).toBeVisible();
        await expect(getRowByName(page, otherFailedName)).not.toBeVisible();
      });

      await test.step('CSV contains only the matching test case', async () => {
        await clickManageButton(page, 'table');
        const download = await performTestCaseExport(page);
        const rows = parse<string[]>(await download.text(), {
          skipEmptyLines: true,
        }).data;

        expect(rows.slice(1).map(([name]) => name)).toEqual([matchingName]);
      });

      await test.step('Bulk Edit keeps the same rows after a reload', async () => {
        await page.locator('.csv-jobs-tray-close').click();
        await clickManageButton(page, 'table');
        await navigateToBulkEditPage(page);
        await expect(getRowByName(page, matchingName)).toBeVisible();
        await expect(getRowByName(page, otherFailedName)).not.toBeVisible();
        await expect(getRowByName(page, successfulName)).not.toBeVisible();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);
        await expect(getRowByName(page, matchingName)).toBeVisible();
        await expect(getRowByName(page, otherFailedName)).not.toBeVisible();
        await expect(getRowByName(page, successfulName)).not.toBeVisible();
      });
    });
  }
);
