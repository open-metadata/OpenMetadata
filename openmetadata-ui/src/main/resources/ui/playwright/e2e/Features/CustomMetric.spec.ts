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
import { expect, test } from '@playwright/test';
import { DataType } from '../../../src/generated/entity/data/table';
import { TableClass } from '../../support/entity/TableClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import {
  createCustomMetric,
  deleteCustomMetric,
  editCustomMetric,
  openCustomMetricDrawer,
} from '../../utils/customMetric';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { disableAiAppMode, stubUserPreferencesAppMode } from '../Utils/appMode';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await disableAiAppMode(page);
  await stubUserPreferencesAppMode(page, 'classic');
});

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

    await waitForAllLoadersToDisappear(page);

    await page.click('[data-testid="profiler"]');
    await profilerResponse;
    await page
      .getByTestId('profiler-add-table-test-btn')
      .waitFor({ state: 'visible' });
    await createCustomMetric({
      page,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  await test.step('Edit', async () => {
    await editCustomMetric({
      page,
      metric: {
        ...TABLE_CUSTOM_METRIC,
        expression: `SELECT COUNT(*) FROM ${table.entity.name}`,
      },
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
    await page
      .getByTestId('profiler-add-table-test-btn')
      .waitFor({ state: 'visible' });
    await createCustomMetric({
      page,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });

  await test.step('Edit', async () => {
    await editCustomMetric({
      page,
      isColumnMetric: true,
      metric: {
        ...COLUMN_CUSTOM_METRIC,
        expression: `SELECT COUNT(*) FROM ${table.entity.name}`,
      },
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

test('Large column Select preserves keyboard navigation and fully reveals the focused option', async ({
  page,
}) => {
  const table = new TableClass();
  table.entity.columns = Array.from({ length: 250 }, (_, index) => ({
    name: `col_${String(index).padStart(3, '0')}`,
    dataType: DataType.Varchar,
    dataLength: 50,
  }));
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    await table.create(apiContext);
    const profilerResponse = page.waitForResponse(
      `/api/v1/tables/${table.entityResponseData?.['fullyQualifiedName']}/tableProfile/latest?includeColumnProfile=false`
    );
    await table.visitEntityPage(page);
    await page.click('[data-testid="profiler"]');
    await profilerResponse;
    await openCustomMetricDrawer(page, true);
    const trigger = page
      .getByTestId('custom-metric-column')
      .getByRole('button');

    await test.step('Window and reveal keyboard destinations', async () => {
      await trigger.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      expect(await page.getByRole('option').count()).toBeLessThan(250);

      await page.keyboard.press('ArrowDown');
      await expect(
        page.getByRole('option', { name: 'col_000', exact: true })
      ).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(
        page.getByRole('option', { name: 'col_001', exact: true })
      ).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(
        page.getByRole('option', { name: 'col_000', exact: true })
      ).toBeFocused();
      await page.keyboard.press('End');
      const lastOption = page.getByRole('option', {
        name: 'col_249',
        exact: true,
      });
      await expect(lastOption).toBeFocused();
      await expect(lastOption).toBeInViewport({ ratio: 1 });

      await page.keyboard.press('Home');
      await expect(
        page.getByRole('option', { name: 'col_000', exact: true })
      ).toBeFocused();
      await page.keyboard.press('PageDown');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(trigger).not.toContainText('col_000');
    });

    await test.step('Commit typeahead and cancel a subsequent selection', async () => {
      await trigger.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Home');
      await page.keyboard.type('col_177');
      const matchingOption = page.getByRole('option', {
        name: 'col_177',
        exact: true,
      });
      await expect(matchingOption).toBeFocused();
      await expect(matchingOption).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Enter');
      await expect(trigger).toContainText('col_177');
      await expect(page.getByRole('listbox')).toHaveCount(0);

      await trigger.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('End');
      await expect(
        page.getByRole('option', { name: 'col_249', exact: true })
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(trigger).toContainText('col_177');
      await expect(trigger).toBeFocused();
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
