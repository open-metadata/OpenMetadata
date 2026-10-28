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
import type { Column } from 'react-data-grid';
import { EntityType } from '../../enums/entity.enum';

export const BULK_EDIT_OPERATION_KEY = '__bulkEditOperation';

type GridColumn = Column<Record<string, string>>;

export const isBulkEditNameColumn = (column: GridColumn) =>
  column.key.replaceAll('*', '') === 'name';

/**
 * Columns in the order the bulk edit grid renders them: the synthetic
 * operation column, then frozen columns, then the rest (react-data-grid always
 * moves frozen columns to the front). The grid edit controller maps a cell's
 * aria-colindex to a column, so it must see the same order.
 */
export const getBulkEditRenderedColumns = <T extends GridColumn>(
  columns: T[],
  operationColumn: T
): T[] => {
  const dataColumns = columns.filter((column) => column.key !== 'operation');
  const isFrozen = (column: T) =>
    isBulkEditNameColumn(column) || Boolean(column.frozen);

  return [
    operationColumn,
    ...dataColumns.filter(isFrozen),
    ...dataColumns.filter((column) => !isFrozen(column)),
  ];
};

// Bulk edit of these entities lists their children, not the entity itself.
const BULK_EDIT_ROWS_LABEL_KEY: Partial<Record<string, string>> = {
  [EntityType.TABLE]: 'label.column-plural',
  [EntityType.GLOSSARY]: 'label.glossary-term-plural',
};

export const getBulkEditRowsLabelKey = (entityType: string) =>
  BULK_EDIT_ROWS_LABEL_KEY[entityType] ?? `label.${entityType}-plural`;

// Keys are bare (`name*`) or prefixed by the row type (`column.name*`).
const BULK_EDIT_SEARCHABLE_FIELDS = new Set([
  'name',
  'displayName',
  'description',
]);

const isSearchableKey = (key: string) =>
  BULK_EDIT_SEARCHABLE_FIELDS.has(
    (key.split('.').pop() ?? '').replaceAll('*', '')
  );

export const filterBulkEditRows = (
  rows: Record<string, string>[],
  searchText: string
) => {
  const search = searchText.trim().toLowerCase();
  if (!search) {
    return rows;
  }

  return rows.filter((row) =>
    Object.entries(row).some(
      ([key, value]) =>
        isSearchableKey(key) &&
        String(value ?? '')
          .toLowerCase()
          .includes(search)
    )
  );
};
