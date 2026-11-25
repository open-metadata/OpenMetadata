/*
 *  Copyright 2025 Collate.
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
import { createHash } from 'crypto';
import { Column, Table } from '../../src/generated/entity/data/table';
import { TableClass } from '../support/entity/TableClass';

export const getTableColumnsCount = (columns: TableClass['children']) => {
  let columnsCount = 0;

  columns.forEach((column) => {
    columnsCount += 1;
    if (column.children) {
      columnsCount += getTableColumnsCount(column.children);
    }
  });

  return columnsCount;
};

export const flattenColumns = (columns: Column[] = []): Column[] =>
  columns.flatMap((column) => [column, ...flattenColumns(column.children)]);

/** Java's UUID.nameUUIDFromBytes, which ColumnSearchIndex uses as the column doc id. */
export const getColumnAssetId = (columnFqn: string): string => {
  const bytes = createHash('md5').update(columnFqn, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

/**
 * Columns inherit their table's glossary terms (#31834), so a term's search-backed
 * assets include every column, nested ones too, of each tagged table.
 */
export const assetIdsWithColumns = (tablesWithTerm: Table[]): string[] =>
  tablesWithTerm.flatMap((table) => [
    table.id,
    ...flattenColumns(table.columns).map((column) =>
      getColumnAssetId(column.fullyQualifiedName ?? '')
    ),
  ]);

export const countAssetsWithColumns = (tablesWithTerm: Table[]): number =>
  assetIdsWithColumns(tablesWithTerm).length;
