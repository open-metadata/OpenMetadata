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
import type { ColumnType } from './Table.interface';
import {
  flattenTreeRows,
  getColumnStickyStyle,
  getStickyBodyCellClass,
  resolveCellValue,
} from './TableV2Utils';

type Row = Record<string, unknown>;

interface TreeNode {
  key: string;
  children?: TreeNode[];
}

const buildColumn = (partial: Partial<ColumnType<Row>>): ColumnType<Row> =>
  partial as ColumnType<Row>;

describe('flattenTreeRows', () => {
  const getKey = (row: TreeNode) => row.key;

  it('deduplicates when an expanded child also appears later at root', () => {
    const child: TreeNode = { key: 'G.Parent.Child' };
    const sibling: TreeNode = { key: 'G.Parent.Sibling' };
    const parent: TreeNode = {
      key: 'G.Parent',
      children: [child, sibling],
    };
    const duplicateRootChild: TreeNode = { key: 'G.Parent.Child' };

    const collapsed = flattenTreeRows(
      [parent, duplicateRootChild],
      getKey,
      new Set(),
      undefined
    );

    expect(collapsed.map((r) => ({ key: r.rowKey, depth: r.depth }))).toEqual([
      { key: 'G.Parent', depth: 0 },
      { key: 'G.Parent.Child', depth: 0 },
    ]);

    const expanded = flattenTreeRows(
      [parent, duplicateRootChild],
      getKey,
      new Set(['G.Parent']),
      undefined
    );

    expect(expanded.map((r) => ({ key: r.rowKey, depth: r.depth }))).toEqual([
      { key: 'G.Parent', depth: 0 },
      { key: 'G.Parent.Child', depth: 1 },
      { key: 'G.Parent.Sibling', depth: 1 },
    ]);
  });

  it('preserves distinct synthetic load-more rows across multiple expanded parents', () => {
    const parentOne: TreeNode = {
      key: 'G.P1',
      children: [{ key: 'G.P1.C1' }, { key: 'G.P1-load-more' }],
    };
    const parentTwo: TreeNode = {
      key: 'G.P2',
      children: [{ key: 'G.P2.C1' }, { key: 'G.P2-load-more' }],
    };

    const expanded = flattenTreeRows(
      [parentOne, parentTwo],
      getKey,
      new Set(['G.P1', 'G.P2']),
      undefined
    );

    expect(expanded.map((r) => r.rowKey)).toEqual([
      'G.P1',
      'G.P1.C1',
      'G.P1-load-more',
      'G.P2',
      'G.P2.C1',
      'G.P2-load-more',
    ]);
  });

  it('terminates cleanly without stack overflow on cyclic children', () => {
    const selfCycle: TreeNode = { key: 'G.Self' };
    selfCycle.children = [selfCycle];

    const mutualA: TreeNode = { key: 'G.A' };
    const mutualB: TreeNode = { key: 'G.B' };
    mutualA.children = [mutualB];
    mutualB.children = [mutualA];

    const flattened = flattenTreeRows(
      [selfCycle, mutualA],
      getKey,
      new Set(['G.Self', 'G.A', 'G.B']),
      undefined
    );

    expect(flattened.map((r) => ({ key: r.rowKey, depth: r.depth }))).toEqual([
      { key: 'G.Self', depth: 0 },
      { key: 'G.A', depth: 0 },
      { key: 'G.B', depth: 1 },
    ]);
  });
});

describe('resolveCellValue rawValue branch', () => {
  it('walks a nested path when dataIndex is an array', () => {
    const value = resolveCellValue(
      buildColumn({ dataIndex: ['a', 'b'] }),
      { a: { b: 'nested-value' } },
      0
    );

    expect(value).toBe('nested-value');
  });

  it('reads a top-level key when dataIndex is a string', () => {
    expect(
      resolveCellValue(buildColumn({ dataIndex: 'name' }), { name: 'hello' }, 0)
    ).toBe('hello');
    expect(
      resolveCellValue(buildColumn({ dataIndex: 'count' }), { count: 5 }, 0)
    ).toBe('5');
  });

  it('returns null when dataIndex is undefined', () => {
    expect(resolveCellValue(buildColumn({}), {}, 0)).toBeNull();
  });
});

describe('sticky column background', () => {
  it('leaves body cells to the class so dark hover/selected can repaint them', () => {
    expect(getColumnStickyStyle('left', 1)).not.toHaveProperty('background');
    expect(getStickyBodyCellClass('right').split(' ')).toEqual(
      expect.arrayContaining([
        'tw:bg-surface',
        'tw:group-hover:bg-secondary',
        'tw:group-data-[selected]:bg-secondary',
      ])
    );
    expect(getStickyBodyCellClass(undefined)).toBe('');
  });

  it('keeps an explicit header background inline', () => {
    expect(
      getColumnStickyStyle('right', 2, 'var(--om-color-bg-secondary)')
    ).toMatchObject({ background: 'var(--om-color-bg-secondary)' });
  });
});
