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
 * Reindexing a table rewrites its `tableProfile` field. If the rebuild drops the
 * per-column profile array the four Column Profile charts render empty while the
 * API still answers 200, so a status-code assertion alone would not catch it.
 *
 * Profiler.spec.ts already asserts these charts on a freshly-profiled table; this
 * covers only the post-reindex case. Ported from the deleted
 * TableProfilerColumnGraphsReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const GRAPH_IDS = [
  '#count_graph',
  '#proportion_graph',
  '#math_graph',
  '#sum_graph',
] as const;

test('Column profile charts survive a full entity reindex', async ({
  browser,
}) => {
  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });

  const table = new TableClass();

  try {
    await table.create(apiContext);

    const tableId = table.entityResponseData?.id as string;
    const columns = table.entityResponseData?.columns as {
      name: string;
      fullyQualifiedName: string;
    }[];
    const targetColumn = columns[0];
    const timestamp = Date.now();

    const profileRes = await apiContext.put(
      `/api/v1/tables/${tableId}/tableProfile`,
      {
        data: {
          tableProfile: {
            timestamp,
            columnCount: columns.length,
            rowCount: 100,
          },
          columnProfile: columns.map((column) => ({
            name: column.name,
            timestamp,
            uniqueCount: 50,
            uniqueProportion: 0.5,
            min: 1,
            max: 100,
            mean: 50,
            sum: 5000,
          })),
        },
      }
    );

    expect(profileRes.status()).toBe(200);

    const openColumnProfile = async () => {
      await table.visitEntityPage(page);
      await page.click('[data-testid="profiler"]');

      const listColumns = page.waitForResponse(
        '/api/v1/tables/name/*/columns?*'
      );
      await page.getByRole('tab', { name: 'Column Profile' }).click();
      await listColumns;

      const columnProfile = page.waitForResponse(
        '/api/v1/tables/*/columnProfile?*'
      );
      await page
        .locator(`[data-row-key="${targetColumn.fullyQualifiedName}"]`)
        .getByText(targetColumn.name)
        .click();
      await columnProfile;

      for (const graphId of GRAPH_IDS) {
        await expect(page.locator(graphId)).toBeVisible();
      }
    };

    await openColumnProfile();

    const reindexRes = await apiContext.post('/api/v1/search/reindexEntities', {
      data: [
        {
          id: tableId,
          type: 'table',
          fullyQualifiedName: table.entityResponseData
            ?.fullyQualifiedName as string,
        },
      ],
    });

    expect(reindexRes.status()).toBeLessThan(400);

    await openColumnProfile();
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
