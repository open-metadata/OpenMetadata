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
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DataType, Table, TableType } from '../../generated/entity/data/table';
import { SCHEMA } from '../../test/browser/fixtures/hierarchy';
import { worker } from '../../test/browser/msw';
import { describeClientPagedTable } from '../../test/browser/paginationContract';
import { renderApp } from '../../test/browser/renderWithApp';

const TABLE_FQN = `${SCHEMA.fullyQualifiedName}.pw_version_table`;
const columns = Array.from({ length: 20 }, (_, i) => {
  const name = `version_col_${String(i + 1).padStart(2, '0')}`;

  return {
    name,
    fullyQualifiedName: `${TABLE_FQN}.${name}`,
    dataType: DataType.Varchar,
    dataTypeDisplay: 'varchar',
    description: `Version test column ${i + 1}`,
    tags: [],
  };
});
const table = {
  id: '00000000-0000-4000-8000-0000000000e1',
  name: 'pw_version_table',
  fullyQualifiedName: TABLE_FQN,
  tableType: TableType.Regular,
  columns,
  databaseSchema: SCHEMA,
  database: SCHEMA.database,
  service: SCHEMA.service,
  serviceType: 'Mysql',
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
} as unknown as Table;

const serveVersions = () =>
  worker.use(
    http.get('/api/v1/tables/name/:fqn', () => HttpResponse.json(table)),
    http.get('/api/v1/tables/:id/versions', () =>
      HttpResponse.json({
        entityType: 'table',
        versions: [JSON.stringify(table)],
      })
    ),
    http.get('/api/v1/tables/:id/versions/:version', () =>
      HttpResponse.json(table)
    )
  );

const url = `/table/${TABLE_FQN}/versions/0.1?pageSize=15`;

// Replaces Pagination.spec.ts › "should test pagination on Table version page columns".
describeClientPagedTable({
  name: 'Table › Version 0.1 › Columns',
  url,
  tableTestId: 'entity-table',
  totalRows: 20,
  rowLabel: (i) => columns[i].name,
  setup: serveVersions,
});

// Replaces Pagination.spec.ts › "should test search on Table version page columns".
test('Table › Version 0.1 › search filters columns in the browser', async () => {
  serveVersions();
  await renderApp(url);

  await expect
    .element(page.getByTestId('entity-table').getByText('version_col_01'))
    .toBeVisible();

  await userEvent.fill(page.getByTestId('searchbar'), 'version_col_01');

  await expect
    .poll(
      () =>
        page.getByTestId('entity-table').element().querySelectorAll('tbody tr')
          .length
    )
    .toBe(1);
  await expect
    .element(page.getByTestId('entity-table').getByText('version_col_01'))
    .toBeVisible();
});
