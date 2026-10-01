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
import { APIRequestContext } from '@playwright/test';
import { DataType } from '../../../src/generated/entity/data/table';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { createAdminApiContext } from '../../utils/admin';
import { okJson } from '../../utils/apiResponse';

const names = ['customer', 'customer_archive', 'custoner'];

for (const { index, tab, path } of [
  { index: 'databaseSchema', tab: 'database schemas', path: 'databaseSchema' },
  { index: 'table', tab: 'tables', path: 'tables' },
  { index: 'tableColumn', tab: 'columns', path: 'columns' },
]) {
  test.describe(`Explore ${index} counts`, () => {
    const fixture = new TableClass('records');
    let apiContext: APIRequestContext;
    let cleanup: () => Promise<void>;
    const filter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    term: {
                      'service.displayName.keyword': fixture.service.name,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    test.beforeAll(async () => {
      ({ apiContext, afterAction: cleanup } = await createAdminApiContext());
      fixture.entity.description = '';
      fixture.entity.displayName = 'records';
      fixture.entity.columns = [{ name: 'row_id', dataType: DataType.Int }];
      await fixture.create(apiContext);
      if (index === 'databaseSchema') {
        for (const name of names) {
          await okJson(
            await apiContext.post('/api/v1/databaseSchemas', {
              data: {
                name,
                database: fixture.databaseResponseData.fullyQualifiedName,
              },
            }),
            `create schema ${name}`
          );
        }
        await okJson(
          await apiContext.post('/api/v1/tables', {
            data: {
              name: 'custoner',
              databaseSchema: fixture.schemaResponseData.fullyQualifiedName,
              columns: [{ name: 'row_id', dataType: 'INT' }],
            },
          }),
          'create fuzzy-only match in another type'
        );
      } else {
        for (const name of index === 'table' ? names : ['inventory']) {
          await okJson(
            await apiContext.post('/api/v1/tables', {
              data: {
                name,
                databaseSchema: fixture.schemaResponseData.fullyQualifiedName,
                columns: (index === 'table' ? ['row_id'] : names).map(
                  (column) => ({ name: column, dataType: 'INT' })
                ),
              },
            }),
            `create table ${name}`
          );
        }
      }
      await expect
        .poll(async () => {
          const response = await okJson(
            await apiContext.get('/api/v1/search/query', {
              params: {
                q: 'customer',
                index,
                size: 15,
                query_filter: JSON.stringify(filter),
              },
            }),
            'wait for search fixtures'
          );

          return response.hits.total.value;
        })
        .toBe(2);
    });

    test.afterAll(async () => {
      await fixture.delete(apiContext);
      await cleanup();
    });

    if (index === 'databaseSchema') {
      test('selects the matching tab when entering Explore without a tab', async ({
        page,
      }) => {
        const params = new URLSearchParams({
          search: 'customer',
          sort: '_score',
          sortOrder: 'desc',
          quickFilter: JSON.stringify(filter),
        });
        await page.goto(`/explore?${params}`);
        await expect(page.getByTestId('entity-header-display-name')).toHaveText(
          ['customer', 'customer_archive']
        );
        await expect(page.getByTestId('database schemas-tab')).toHaveText(
          /Database Schemas\s*2/
        );
        await expect(page.getByTestId('tables-tab')).toHaveText(/Tables\s*1/);
      });
    }

    test('badge equals the accessible results and excludes fuzzy-only siblings', async ({
      page,
    }) => {
      const params = new URLSearchParams({
        search: 'customer',
        sort: '_score',
        sortOrder: 'desc',
        quickFilter: JSON.stringify(filter),
      });
      let releaseCounts = () => {};
      const countsReleased = new Promise<void>((resolve) => {
        releaseCounts = resolve;
      });
      await page.route('**/api/v1/search/entityTypeCounts?*', async (route) => {
        await countsReleased;
        await route.continue();
      });
      await page.goto(`/explore/${path}?${params}`);
      try {
        await expect(
          page.getByTestId('entity-header-display-name')
        ).toHaveCount(2);
      } finally {
        releaseCounts();
      }
      await expect(page.getByTestId(`${tab}-tab`)).toHaveText(
        new RegExp(`${tab}\\s*2`, 'i')
      );
      await expect(page.getByTestId('next')).toBeDisabled();
      await expect(page.getByTestId('entity-header-display-name')).toHaveText([
        'customer',
        'customer_archive',
      ]);
      if (index === 'databaseSchema') {
        await expect(page.getByTestId('tables-tab')).toHaveText(/Tables\s*1/);
        await page.goto(`/explore/tables?${params}`);
        await expect(page.getByTestId('entity-header-display-name')).toHaveText(
          ['custoner']
        );
        await expect(page.getByTestId('database schemas-tab')).toHaveText(
          /Database Schemas\s*2/
        );
      }
    });
  });
}
