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
import { Table } from '../../../src/generated/entity/data/table';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/userPages';
import { performAdminLogin } from '../../utils/admin';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { waitForSearchIndexed } from '../../utils/polling';

test.describe('BigQuery sharded table identity', { tag: '@Discovery' }, () => {
  let ordinary: TableClass;
  let service: DatabaseServiceClass;
  let family: Table;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      service = new DatabaseServiceClass(undefined, {
        serviceType: 'BigQuery',
        connection: {
          config: {
            type: 'BigQuery',
            credentials: { gcpConfig: {} },
            shardedTables: { enabled: true },
          },
        },
      });
      await service.create(apiContext);
      ordinary = new TableClass({ service });
      await ordinary.create(apiContext);
      const prefix = 'events_';
      family = await okJson<Table>(
        await apiContext.post('/api/v1/tables', {
          data: {
            name: `${prefix}yyyymmdd`,
            databaseSchema: ordinary.schemaResponseData.fullyQualifiedName,
            columns: [{ name: 'id', dataType: 'INT' }],
            tableType: 'Sharded',
            tableSharding: {
              prefix,
              suffixFormat: 'YYYYMMDD',
              shardCount: 2,
              firstShardDate: '2026-01-01',
              lastShardDate: '2026-01-02',
              representative: {
                databaseName: ordinary.databaseResponseData.name,
                schemaName: ordinary.schemaResponseData.name,
                tableName: `${prefix}20260102`,
                shardDate: '2026-01-02',
              },
            },
          },
        }),
        'Create sharded table'
      );
      await waitForSearchIndexed(
        apiContext,
        family.fullyQualifiedName,
        'table_search_index'
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      if (family?.id) {
        await deleteFixtureEntity(
          apiContext,
          `/api/v1/tables/${family.id}?hardDelete=true&recursive=true`
        );
      }
      if (ordinary) {
        await ordinary.delete(apiContext);
      }
      if (service) {
        await service.delete(apiContext);
      }
    } finally {
      await afterAction();
    }
  });

  test('shows representative metadata and opens the family from an older physical name', async ({
    adminPage,
  }) => {
    await test.step('Inspect the representative widget', async () => {
      await adminPage.goto(
        `/table/${encodeURIComponent(family.fullyQualifiedName!)}`
      );
      await expect(adminPage.getByTestId('table-sharding')).toBeVisible();
      await expect(
        adminPage.getByRole('link', { name: 'events_20260102' })
      ).toHaveAttribute('href', /t=events_20260102/);
    });
    await test.step('Search the older physical name with independent suggestion pagination', async () => {
      const physical = family.fullyQualifiedName!.replace(
        'events_yyyymmdd',
        'events_20260101'
      );
      await adminPage.goto(
        `/explore/tables?search=${encodeURIComponent(physical)}&page=2`
      );
      const suggestions = adminPage.getByRole('region', {
        name: 'Matching sharded families',
      });
      await expect(suggestions).toBeVisible();
      await suggestions
        .getByRole('link', { name: family.fullyQualifiedName })
        .click();
      await expect(adminPage.getByTestId('table-sharding')).toBeVisible();
    });
  });

  test('omits the widget on an ordinary table', async ({ adminPage }) => {
    await ordinary.visitEntityPage(adminPage);
    await expect(
      adminPage.getByTestId('entity-header-display-name')
    ).toBeVisible();
    await expect(adminPage.getByTestId('table-sharding')).toHaveCount(0);
  });
});
