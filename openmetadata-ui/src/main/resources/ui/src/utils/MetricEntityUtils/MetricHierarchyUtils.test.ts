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
import { Metric } from '../../generated/entity/data/metric';
import {
  attachChildren,
  createGroupLoadMoreRow,
  createGroupRow,
  createLoadMoreRow,
  flattenMetricRows,
  flattenVisibleMetricRows,
  hasMetricChildren,
  isLoadMoreRow,
  MetricTableRow,
  MetricTreeNode,
} from './MetricHierarchyUtils';

const metric = (
  id: string,
  name: string,
  parentId?: string,
  childrenCount?: number
): Metric =>
  ({
    id,
    name,
    fullyQualifiedName: name,
    childrenCount,
    parent: parentId ? { id: parentId, type: 'metric' } : undefined,
  } as Metric);

describe('hasMetricChildren', () => {
  it('treats a missing childrenCount as zero rather than throwing', () => {
    expect(hasMetricChildren(metric('1', 'a') as MetricTreeNode)).toBe(false);
  });

  it('is true when the server reported children', () => {
    expect(
      hasMetricChildren(metric('1', 'a', undefined, 3) as MetricTreeNode)
    ).toBe(true);
  });

  it('is true when children were loaded even if the count is stale at zero', () => {
    const node = {
      ...metric('1', 'a', undefined, 0),
      children: [metric('2', 'b', '1')],
    } as MetricTreeNode;

    expect(hasMetricChildren(node)).toBe(true);
  });
});

describe('createLoadMoreRow / isLoadMoreRow', () => {
  it('marks the synthetic row so selection can exclude it', () => {
    const row = createLoadMoreRow({
      parentId: '1',
      parentFqn: 'net_sales',
      remaining: 12,
      after: 'cursor',
    });

    expect(isLoadMoreRow(row)).toBe(true);
    expect(row.id).toBe('load-more:1');
    expect(row.remaining).toBe(12);
  });

  it('does not mistake a real metric for a load-more row', () => {
    expect(isLoadMoreRow(metric('1', 'a') as MetricTreeNode)).toBe(false);
  });
});

describe('attachChildren', () => {
  it('replaces the children of a nested node without touching its siblings', () => {
    const tree: MetricTableRow[] = [
      {
        ...(metric('1', 'a', undefined, 1) as MetricTreeNode),
        children: [metric('2', 'b', '1', 1) as MetricTreeNode],
      },
      metric('9', 'sibling') as MetricTreeNode,
    ];
    const loaded = [metric('3', 'c', '2') as MetricTreeNode];

    const next = attachChildren(tree, '2', loaded);
    const parent = next.find((r) => !isLoadMoreRow(r) && r.id === '1');

    expect((parent as MetricTreeNode).children?.[0].children?.[0].id).toBe('3');
    expect(next).toHaveLength(2);
  });

  it('leaves the tree unchanged when the parent id is not present', () => {
    const tree: MetricTableRow[] = [metric('1', 'a') as MetricTreeNode];

    expect(attachChildren(tree, 'nope', [])).toEqual(tree);
  });
});

describe('flattenMetricRows', () => {
  it('returns every metric at any depth in render order', () => {
    const tree: MetricTableRow[] = [
      {
        ...(metric('1', 'a', undefined, 1) as MetricTreeNode),
        children: [
          {
            ...(metric('2', 'b', '1', 1) as MetricTreeNode),
            children: [metric('3', 'c', '2') as MetricTreeNode],
          },
        ],
      },
      metric('4', 'sibling') as MetricTreeNode,
    ];

    expect(flattenMetricRows(tree).map((m) => m.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('drops load-more rows so a selection never resolves to one', () => {
    const rows = [
      metric('1', 'a') as MetricTreeNode,
      createLoadMoreRow({ parentId: '1', parentFqn: 'a', remaining: 3 }),
    ];

    expect(flattenMetricRows(rows).map((m) => m.id)).toEqual(['1']);
  });

  it('returns an empty array for no rows', () => {
    expect(flattenMetricRows([])).toEqual([]);
  });
});

describe('flattenVisibleMetricRows', () => {
  it('preserves group, root, child, and grandchild render depth exactly once', () => {
    const groupedRoot = {
      ...(metric('1', 'root', undefined, 1) as MetricTreeNode),
      metricGroup: { id: 'group-1', type: 'metricGroup' },
      children: [
        {
          ...(metric('2', 'child', '1', 1) as MetricTreeNode),
          children: [metric('3', 'grandchild', '2') as MetricTreeNode],
        },
      ],
    };
    const rows: MetricTableRow[] = [
      createGroupRow({
        id: 'group-1',
        name: 'commercial',
        metricCount: 3,
      }),
      groupedRoot,
      createGroupLoadMoreRow({ groupId: 'group-1', remaining: 4 }),
      metric('4', 'standalone') as MetricTreeNode,
    ];

    expect(
      flattenVisibleMetricRows(rows).map(({ row, depth }) => [row.id, depth])
    ).toEqual([
      ['group:group-1', 0],
      ['1', 1],
      ['2', 2],
      ['3', 3],
      ['load-more:group:group-1', 1],
      ['4', 0],
    ]);
  });

  it('keeps standalone variants relative to their root', () => {
    const rows: MetricTableRow[] = [
      {
        ...(metric('1', 'root', undefined, 1) as MetricTreeNode),
        children: [metric('2', 'child', '1') as MetricTreeNode],
      },
    ];

    expect(
      flattenVisibleMetricRows(rows).map(({ row, depth }) => [row.id, depth])
    ).toEqual([
      ['1', 0],
      ['2', 1],
    ]);
  });
});
