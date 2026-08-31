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
import type { FlatRow } from './TableV2.interface';
import { flattenTreeRows, resolveSelectedRows } from './TableV2Utils';

interface Row {
  id: string;
  children?: Row[];
}

const getRowKey = (record: Row) => record.id;

const flatten = (data: Row[], expanded: string[]) =>
  flattenTreeRows<Row>(data, getRowKey, new Set(expanded), undefined);

describe('resolveSelectedRows', () => {
  const tree: Row[] = [
    { id: 'parent', children: [{ id: 'child-a' }, { id: 'child-b' }] },
    { id: 'sibling' },
  ];

  it('includes expanded children when everything is selected', () => {
    // Aria checks every visible row, so a select-all that reported only the roots would hand a
    // bulk action fewer rows than the user can see are checked.
    const flatRows = flatten(tree, ['parent']);

    const { selectedKeys, selectedRows } = resolveSelectedRows<Row>({
      selection: 'all',
      isTree: true,
      flatRows,
      dataSource: tree,
      getRowKey,
    });

    expect(selectedKeys).toEqual(['parent', 'child-a', 'child-b', 'sibling']);
    expect(selectedRows.map((r) => r.id)).toEqual([
      'parent',
      'child-a',
      'child-b',
      'sibling',
    ]);
  });

  it('leaves collapsed children out of select-all', () => {
    const flatRows = flatten(tree, []);

    const { selectedKeys } = resolveSelectedRows<Row>({
      selection: 'all',
      isTree: true,
      flatRows,
      dataSource: tree,
      getRowKey,
    });

    expect(selectedKeys).toEqual(['parent', 'sibling']);
  });

  it('resolves an individually selected child to its record', () => {
    const flatRows = flatten(tree, ['parent']);

    const { selectedKeys, selectedRows } = resolveSelectedRows<Row>({
      selection: new Set(['child-b']),
      isTree: true,
      flatRows,
      dataSource: tree,
      getRowKey,
    });

    expect(selectedKeys).toEqual(['child-b']);
    expect(selectedRows.map((r) => r.id)).toEqual(['child-b']);
  });

  it('resolves against the data source when the table is not a tree', () => {
    const flat: Row[] = [{ id: 'a' }, { id: 'b' }];

    const { selectedKeys, selectedRows } = resolveSelectedRows<Row>({
      selection: 'all',
      isTree: false,
      flatRows: [] as FlatRow<Row>[],
      dataSource: flat,
      getRowKey,
    });

    expect(selectedKeys).toEqual(['a', 'b']);
    expect(selectedRows).toHaveLength(2);
  });

  it('returns nothing for an empty selection', () => {
    const { selectedKeys, selectedRows } = resolveSelectedRows<Row>({
      selection: new Set<string>(),
      isTree: true,
      flatRows: flatten(tree, ['parent']),
      dataSource: tree,
      getRowKey,
    });

    expect(selectedKeys).toEqual([]);
    expect(selectedRows).toEqual([]);
  });
});
