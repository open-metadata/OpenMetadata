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
import { deepClone } from 'fast-json-patch';
import { http, HttpResponse } from 'msw';
import { UpdateColumn } from '../../../generated/api/data/updateColumn';
import { Paging } from '../../../generated/type/paging';
import {
  Column,
  DataType,
  Table,
  TableType,
} from '../../../generated/entity/data/table';
import { worker } from '../msw';

export const TABLE_FQN = 'sample_data.ecommerce_db.shopify.orders';

/** Typed against the generated model: a schema change breaks compilation here. */
export const makeColumn = (
  index: number,
  overrides: Partial<Column> = {}
): Column => ({
  name: `order_col_${String(index).padStart(3, '0')}`,
  fullyQualifiedName: `${TABLE_FQN}.order_col_${String(index).padStart(
    3,
    '0'
  )}`,
  dataType: index % 3 === 0 ? DataType.Varchar : DataType.Bigint,
  dataTypeDisplay: index % 3 === 0 ? 'varchar(255)' : 'bigint',
  description: `Column number ${index}`,
  ordinalPosition: index,
  tags: [],
  ...overrides,
});

export const ALL_COLUMNS: Column[] = Array.from({ length: 120 }, (_, i) =>
  makeColumn(i + 1)
);

export const makeTable = (overrides: Partial<Table> = {}): Table => ({
  id: '8f6b4c2e-1d1a-4c55-9a43-2f4f0f2d9a11',
  name: 'orders',
  fullyQualifiedName: TABLE_FQN,
  tableType: TableType.Regular,
  columns: ALL_COLUMNS.slice(0, 15),
  deleted: false,
  ...overrides,
});

/**
 * Mirrors ChildFieldPageReader (openmetadata-service): offset paging encoded
 * as string cursors — before/after are offsets, null at either end. Getting
 * this wrong is exactly the drift a recorded-fixture contract check prevents
 * (the first POC draft used {offset, limit} and the Next button stayed disabled).
 */
export const pageOf = (
  columns: Column[],
  { offset, limit }: { offset: number; limit: number }
): { data: Column[]; paging: Paging } => {
  const total = columns.length;
  const toIndex = Math.min(offset + limit, total);

  return {
    data: columns.slice(offset, toIndex),
    paging: {
      before: offset > 0 ? String(Math.max(0, offset - limit)) : undefined,
      after: toIndex < total ? String(toIndex) : undefined,
      total,
    },
  };
};

/** The columns of one table/data model as the server holds them, and each column write. */
export interface ColumnServer {
  current: () => Column[];
  /** Each `PUT /columns/name/{fqn}` the page sent, in order. */
  updates: { fqn: string; body: UpdateColumn }[];
}

/**
 * Serves `/api/v1/<parent>/name/:fqn/columns` (paged like ChildFieldPageReader)
 * and `PUT /api/v1/columns/name/:fqn`, which updates only the fields sent and
 * clears a blank displayName/description (ColumnRepository.updateColumn).
 */
export const serveColumns = (
  parent: string,
  columns: Column[]
): ColumnServer => {
  let stored = deepClone(columns) as Column[];
  const server: ColumnServer = { current: () => stored, updates: [] };
  const blankToUndefined = (value?: string) =>
    value === undefined || value.trim() ? value : undefined;

  worker.use(
    http.get(`/api/v1/${parent}/name/:fqn/columns`, ({ request }) => {
      const params = new URL(request.url).searchParams;

      return HttpResponse.json(
        pageOf(stored, {
          offset: Number(params.get('offset') ?? 0),
          limit: Number(params.get('limit') ?? 50),
        })
      );
    }),
    http.put('/api/v1/columns/name/:fqn', async ({ request, params }) => {
      const fqn = String(params.fqn);
      const body = (await request.json()) as UpdateColumn;
      server.updates.push({ fqn, body });
      stored = stored.map((column) => {
        if (column.fullyQualifiedName !== fqn) {
          return column;
        }
        const updated = { ...column };
        if (body.displayName !== undefined) {
          updated.displayName = blankToUndefined(body.displayName);
        }
        if (body.description !== undefined) {
          updated.description = blankToUndefined(body.description);
        }
        if (body.tags !== undefined) {
          updated.tags = body.tags as Column['tags'];
        }

        return updated;
      });

      return HttpResponse.json(
        stored.find((column) => column.fullyQualifiedName === fqn)
      );
    })
  );

  return server;
};
