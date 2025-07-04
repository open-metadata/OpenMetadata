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
import test from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import {
  createCustomMetric,
  deleteCustomMetric,
} from '../../utils/customMetric';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test('Table custom metric', async ({ page }) => {
  const table = new TableClass();
  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  await table.create(apiContext);

  const TABLE_CUSTOM_METRIC = {
    name: `tableCustomMetric-${uuid()}`,
    expression: `SELECT * FROM ${table.entity.name}`,
  };

  await test.step('Create', async () => {
    const profilerResponse = page.waitForResponse(
      `/api/v1/tables/${table.entityResponseData?.['fullyQualifiedName']}/tableProfile/latest?includeColumnProfile=false`
    );
    await table.visitEntityPage(page);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

    await page.click('[data-testid="profiler"]');
    await profilerResponse;
    await page.waitForTimeout(1000);
    await createCustomMetric({
      page,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  await test.step('Delete', async () => {
    await deleteCustomMetric({
      page,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  await table.delete(apiContext);
  await afterAction();
});

test('Column custom metric', async ({ page }) => {
  const table = new TableClass();
  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  await table.create(apiContext);

  const COLUMN_CUSTOM_METRIC = {
    name: `columnCustomMetric-${uuid()}`,
    column: table.entity.columns[0].name,
    expression: `SELECT * FROM ${table.entity.name}`,
  };

  await test.step('Create', async () => {
    const profilerResponse = page.waitForResponse(
      `/api/v1/tables/${table.entityResponseData?.['fullyQualifiedName']}/tableProfile/latest?includeColumnProfile=false`
    );
    await table.visitEntityPage(page);
    await page.click('[data-testid="profiler"]');
    await profilerResponse;
    await page.waitForTimeout(1000);
    await createCustomMetric({
      page,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });

  await test.step('Delete', async () => {
    await deleteCustomMetric({
      page,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });

  await table.delete(apiContext);
  await afterAction();
});
