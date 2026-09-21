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

/**
 * The global /data-quality Test Cases list is served entirely from search, so it is the surface
 * where a dropped reindex field shows up as missing rows rather than an error. Paging is the
 * assertion that notices: a short result set still renders a valid-looking first page.
 *
 * DataQuality.spec.ts covers filters and pagination against live-written docs; this covers them
 * after a rebuild. Ported from the deleted DataQualityPaginationReindexUIIT and
 * DataQualityFiltersReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { reindexEntities } from '../../../utils/reindex';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Above the default page size of 15 so Next/Previous are meaningful.
const TEST_CASE_COUNT = 25;

test('Test case list still filters and paginates after a reindex', async ({
  browser,
}) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);

    const marker = `reindex-${uuid()}`;
    const testCases = [];
    for (let index = 0; index < TEST_CASE_COUNT; index++) {
      testCases.push(
        await table.createTestCase(apiContext, {
          name: `${marker}-${index}`,
          testDefinition: 'tableRowCountToBeBetween',
          parameterValues: [
            { name: 'minValue', value: 10 + index },
            { name: 'maxValue', value: 100 + index },
          ],
        })
      );
    }

    await reindexEntities(
      apiContext,
      testCases.map((testCase) => ({
        id: testCase.id as string,
        type: 'testCase',
        fullyQualifiedName: testCase.fullyQualifiedName as string,
      }))
    );

    await sidebarClick(page, SidebarItem.DATA_QUALITY);
    await page.getByTestId('test-cases').click();
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('next')).toBeEnabled();

    await page.getByTestId('next').click();
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('page-indicator')).toContainText('2');

    await page.getByTestId('previous').click();
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('page-indicator')).toContainText('1');

    // Searching by name goes through the same rebuilt docs; a lost `name` field would
    // return nothing here while the unfiltered list above still looked healthy.
    const searchResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/dataQuality/testCases/search/list')
    );
    await page
      .getByTestId('test-case-container')
      .getByRole('textbox')
      .fill(`${marker}-0`);
    await searchResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId(`${marker}-0`),
      'name search must still match after the docs are rebuilt'
    ).toBeVisible();
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
