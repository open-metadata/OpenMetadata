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
import { EntityType } from '../../enums/entity.enum';
import { mergeGridRows } from '../../hooks/useGridEditController';
import {
  BULK_EDIT_OPERATION_KEY,
  filterBulkEditRows,
  getBulkEditRenderedColumns,
  getBulkEditRowsLabelKey,
} from './BulkEditEntity.utils';

const column = (key: string, frozen?: boolean) => ({ key, name: key, frozen });

describe('getBulkEditRenderedColumns', () => {
  const operation = column(BULK_EDIT_OPERATION_KEY);

  it('puts the operation column first and keeps CSV order otherwise', () => {
    const keys = getBulkEditRenderedColumns(
      [column('column.name*'), column('column.description'), column('tags')],
      operation
    ).map(({ key }) => key);

    expect(keys).toEqual([
      BULK_EDIT_OPERATION_KEY,
      'column.name*',
      'column.description',
      'tags',
    ]);
  });

  it('moves the name and frozen columns ahead of the rest, as the grid renders them', () => {
    const keys = getBulkEditRenderedColumns(
      [
        column('parent'),
        column('operation'),
        column('name*'),
        column('owner', true),
      ],
      operation
    ).map(({ key }) => key);

    expect(keys).toEqual([BULK_EDIT_OPERATION_KEY, 'name*', 'owner', 'parent']);
  });
});

describe('getBulkEditRowsLabelKey', () => {
  it('labels rows by the child entity they list', () => {
    expect(getBulkEditRowsLabelKey(EntityType.TABLE)).toBe(
      'label.column-plural'
    );
    expect(getBulkEditRowsLabelKey(EntityType.GLOSSARY)).toBe(
      'label.glossary-term-plural'
    );
    expect(getBulkEditRowsLabelKey(EntityType.DATABASE)).toBe(
      'label.database-plural'
    );
  });
});

describe('filterBulkEditRows', () => {
  const rows: Record<string, string>[] = [
    { 'column.name*': 'customer_id', 'column.description': 'Primary key' },
    { 'column.name*': 'status', 'column.dataType': 'customer' },
  ];

  it('matches prefixed name and description keys, not other fields', () => {
    expect(filterBulkEditRows(rows, ' CUSTOMER ')).toEqual([rows[0]]);
    expect(filterBulkEditRows(rows, 'primary')).toEqual([rows[0]]);
  });

  it('returns the same array when the search is empty', () => {
    expect(filterBulkEditRows(rows, '  ')).toBe(rows);
  });
});

describe('mergeGridRows', () => {
  it('writes edits to the filtered rows back without dropping hidden rows', () => {
    const dataSource = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const gridRows = [dataSource[2]];

    expect(mergeGridRows(dataSource, gridRows, [{ name: 'c2' }])).toEqual([
      { name: 'a' },
      { name: 'b' },
      { name: 'c2' },
    ]);
  });

  it('uses the updated rows as-is when the grid shows every row', () => {
    const dataSource = [{ name: 'a' }];
    const updated = [{ name: 'a2' }];

    expect(mergeGridRows(dataSource, dataSource, updated)).toBe(updated);
  });
});
