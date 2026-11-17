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

  it('emits all sibling and cross-branch rows even when non-ancestor rowKeys repeat', () => {
    // External app runs (AppRunsHistory) can share identical rowKeys at the same level
    const flatDuplicates: TreeNode[] = [
      { key: 'app-undefined-undefined' },
      { key: 'app-undefined-undefined' },
      { key: 'app-undefined-undefined' },
    ];

    const flattenedRuns = flattenTreeRows(
      flatDuplicates,
      getKey,
      new Set(),
      undefined
    );

    expect(
      flattenedRuns.map((r) => ({ key: r.rowKey, idx: r.actualIndex }))
    ).toEqual([
      { key: 'app-undefined-undefined', idx: 0 },
      { key: 'app-undefined-undefined', idx: 1 },
      { key: 'app-undefined-undefined', idx: 2 },
    ]);

    // Separate parent branches with relative child keys (e.g. user.id and order.id)
    const userBranch: TreeNode = {
      key: 'user',
      children: [{ key: 'id' }, { key: 'name' }],
    };
    const orderBranch: TreeNode = {
      key: 'order',
      children: [{ key: 'id' }, { key: 'total' }],
    };

    const flattenedBranches = flattenTreeRows(
      [userBranch, orderBranch],
      getKey,
      new Set(['user', 'order']),
      undefined
    );

    expect(
      flattenedBranches.map((r) => ({
        key: r.rowKey,
        depth: r.depth,
        idx: r.actualIndex,
      }))
    ).toEqual([
      { key: 'user', depth: 0, idx: 0 },
      { key: 'id', depth: 1, idx: 1 },
      { key: 'name', depth: 1, idx: 2 },
      { key: 'order', depth: 0, idx: 3 },
      { key: 'id', depth: 1, idx: 4 },
      { key: 'total', depth: 1, idx: 5 },
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

  it('terminates cleanly on ancestor-descendant cycles and keeps actualIndex contiguous', () => {
    const selfCycle: TreeNode = { key: 'G.Self' };
    const validSibling: TreeNode = { key: '' };
    selfCycle.children = [selfCycle, { key: 'G.Self' }, validSibling];

    const mutualA: TreeNode = { key: 'G.A' };
    const mutualB: TreeNode = { key: 'G.B' };
    mutualA.children = [mutualB];
    mutualB.children = [mutualA];

    const trailingRoot: TreeNode = { key: '' };

    const getKeyOrFallbackIndex = (row: TreeNode, index: number) =>
      row.key || String(index);

    const flattened = flattenTreeRows(
      [selfCycle, mutualA, trailingRoot],
      getKeyOrFallbackIndex,
      new Set(['G.Self', 'G.A', 'G.B']),
      undefined
    );

    expect(
      flattened.map((r) => ({
        key: r.rowKey,
        depth: r.depth,
        idx: r.actualIndex,
      }))
    ).toEqual([
      { key: 'G.Self', depth: 0, idx: 0 },
      { key: '1', depth: 1, idx: 1 },
      { key: 'G.A', depth: 0, idx: 2 },
      { key: 'G.B', depth: 1, idx: 3 },
      { key: '4', depth: 0, idx: 4 },
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
