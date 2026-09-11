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
 * DataQuality.spec.ts covers test-case create/edit/delete against a live-written search doc.
 * This covers the same surface after the doc has been rebuilt by a reindex, which is a
 * different code path: reindex fetches only the fields each index declares in
 * getRequiredReindexFields(), so a parameterValue the Data Quality tab reads can vanish from
 * _source on rebuild while the live-write path keeps working.
 *
 * Ported from the deleted DataQuality{Table,Column}TestCaseCrudReindexUIIT and
 * DataQualityArrayParamsReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import { reindexEntities } from '../../../utils/reindex';
import { visitDataQualityTab } from '../../../utils/testCases';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Test case row and edited parameter survive a reindex', async ({
  browser,
}) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);

    const testCase = await table.createTestCase(apiContext, {
      testDefinition: 'tableColumnNameToExist',
      parameterValues: [{ name: 'columnName', value: 'id' }],
    });
    const target = {
      id: testCase.id as string,
      type: 'testCase',
      fullyQualifiedName: testCase.fullyQualifiedName as string,
    };

    await reindexEntities(apiContext, [target]);
    await visitDataQualityTab(page, table);

    await expect(
      page.getByTestId(testCase.name as string),
      'test case must still be listed after its doc is rebuilt'
    ).toBeVisible();

    await page.getByTestId(`action-dropdown-${testCase.name}`).click();
    await page.getByTestId(`edit-${testCase.name}`).click();

    await expect(page.getByTestId('form-heading')).toHaveText(
      `Edit ${testCase.name}`
    );

    await page.locator('#testCaseFormV1_params_columnName').clear();
    await page.fill('#testCaseFormV1_params_columnName', 'new_column_name');

    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testCases/') &&
        ['PATCH', 'PUT'].includes(response.request().method())
    );
    await page.getByTestId('create-btn').click();
    await updateResponse;

    // The second rebuild is the one that regressed historically: edited parameterValues
    // live in a field the reindex fetcher has to be told to fetch.
    await reindexEntities(apiContext, [target]);

    await visitDataQualityTab(page, table);
    await page.getByTestId(`action-dropdown-${testCase.name}`).click();
    await page.getByTestId(`edit-${testCase.name}`).click();

    await expect(
      page.locator('#testCaseFormV1_params_columnName'),
      'UI-edited parameter must survive the rebuild'
    ).toHaveValue('new_column_name');
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Array parameter values survive a reindex', async ({ browser }) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);

    const allowedValues = ['gmail', 'yahoo', 'collate'];
    const columnName = table.entityResponseData?.columns[0].name as string;
    const testCase = await table.createTestCase(apiContext, {
      entityLink: `<#E::table::${table.entityResponseData?.fullyQualifiedName}::columns::${columnName}>`,
      testDefinition: 'columnValuesToBeInSet',
      parameterValues: [
        { name: 'allowedValues', value: JSON.stringify(allowedValues) },
      ],
    });

    await reindexEntities(apiContext, [
      {
        id: testCase.id as string,
        type: 'testCase',
        fullyQualifiedName: testCase.fullyQualifiedName as string,
      },
    ]);

    await visitDataQualityTab(page, table);
    await page.getByTestId(`action-dropdown-${testCase.name}`).click();
    await page.getByTestId(`edit-${testCase.name}`).click();

    for (const [index, value] of allowedValues.entries()) {
      await expect(
        page.locator(`#testCaseFormV1_params_allowedValues_${index}_value`),
        `allowedValues[${index}] must survive the rebuild`
      ).toHaveValue(value);
    }
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
