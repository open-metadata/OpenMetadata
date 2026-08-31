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
import type { Graph, GraphData } from '@antv/g6';
import {
  findBadgeIndex,
  isDataModeAssetBadgeShape,
  isDataModeLoadMoreBadgeShape,
  isGraphTopologySynced,
  stripNodePositionsForDataMode,
} from './useOntologyGraph';

jest.mock('@antv/g6', () => ({
  Circle: class {},
  ExtensionCategory: { COMBO: 'combo', EDGE: 'edge', NODE: 'node' },
  Line: class {},
  Polyline: class {},
  Quadratic: class {},
  Rect: class {},
  RectCombo: class {},
  idOf: (value: unknown) => value,
  register: jest.fn(),
}));

// graphStyles (imported transitively by the module) measures text on a canvas.
// Mirror the sibling useGraphData.test.ts mock so module import stays headless.
jest.mock('../utils/textMeasure', () => ({
  getCanvasContext: jest.fn(() => null),
  measureTextWidth: jest.fn(
    (text: string, _font: string, fallbackCharWidth: number) =>
      text.length * fallbackCharWidth
  ),
  truncateToFit: jest.fn((text: string) => text),
}));

const ids = (...values: string[]): Array<{ id: string }> =>
  values.map((id) => ({ id }));

const makeGraph = (
  nodes: Array<{ id: string }>,
  edges: Array<{ id: string }>,
  combos: Array<{ id: string }>
): Graph =>
  ({
    getNodeData: () => nodes,
    getEdgeData: () => edges,
    getComboData: () => combos,
  } as unknown as Graph);

const makeGraphData = (
  nodes: Array<{ id: string }>,
  edges: Array<{ id: string }>,
  combos: Array<{ id: string }>
): GraphData => ({ nodes, edges, combos } as unknown as GraphData);

interface ShapeStub {
  className?: string;
  name?: string;
  parent?: ShapeStub;
}

// Links keys[0] -> keys[1] -> ... via `parent`, using each key as `className`.
const chain = (...keys: Array<string | undefined>): ShapeStub | undefined => {
  let head: ShapeStub | undefined;
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    head = { className: keys[i], parent: head };
  }

  return head;
};

describe('isGraphTopologySynced', () => {
  it('returns true when node, edge, and combo id sets are identical', () => {
    const graph = makeGraph(ids('n1', 'n2'), ids('e1'), ids('c1'));
    const graphData = makeGraphData(ids('n2', 'n1'), ids('e1'), ids('c1'));

    expect(isGraphTopologySynced(graph, graphData)).toBe(true);
  });

  it('returns false when the node id sets differ', () => {
    const graph = makeGraph(ids('n1', 'n2'), ids('e1'), ids('c1'));
    const graphData = makeGraphData(ids('n1', 'n3'), ids('e1'), ids('c1'));

    expect(isGraphTopologySynced(graph, graphData)).toBe(false);
  });

  it('returns false when the edge id sets differ', () => {
    const graph = makeGraph(ids('n1'), ids('e1'), []);
    const graphData = makeGraphData(ids('n1'), ids('e1', 'e2'), []);

    expect(isGraphTopologySynced(graph, graphData)).toBe(false);
  });

  it('returns false when the combo id sets differ', () => {
    const graph = makeGraph(ids('n1'), ids('e1'), ids('c1'));
    const graphData = makeGraphData(ids('n1'), ids('e1'), ids('c2'));

    expect(isGraphTopologySynced(graph, graphData)).toBe(false);
  });

  it('treats empty combos on both sides as synced', () => {
    const graph = makeGraph(ids('n1'), ids('e1'), []);
    const graphData = makeGraphData(ids('n1'), ids('e1'), []);

    expect(isGraphTopologySynced(graph, graphData)).toBe(true);
  });

  it('returns false when graphData has no combos but the model still has some', () => {
    const graph = makeGraph(ids('n1'), ids('e1'), ids('c1'));
    const graphData = makeGraphData(ids('n1'), ids('e1'), []);

    expect(isGraphTopologySynced(graph, graphData)).toBe(false);
  });
});

describe('stripNodePositionsForDataMode', () => {
  it('removes x and y from node style while keeping the other style props', () => {
    const nodes = [{ id: 'n1', style: { x: 10, y: 20, size: [200, 40] } }];

    const [stripped] = stripNodePositionsForDataMode(nodes);

    expect(stripped.style).toEqual({ size: [200, 40] });
    expect(stripped.style).not.toHaveProperty('x');
    expect(stripped.style).not.toHaveProperty('y');
  });

  it('returns the same node reference when style has neither x nor y', () => {
    const node = { id: 'n1', style: { size: [200, 40] } };

    const [result] = stripNodePositionsForDataMode([node]);

    expect(result).toBe(node);
  });

  it('returns the same node reference when the node has no style', () => {
    const node: { id: string; style?: unknown } = { id: 'n1' };

    const [result] = stripNodePositionsForDataMode([node]);

    expect(result).toBe(node);
  });
});

describe('findBadgeIndex', () => {
  it('returns the index when the direct target matches /^badge-(N)$/', () => {
    expect(findBadgeIndex({ className: 'badge-0' })).toBe(0);
    expect(findBadgeIndex({ className: 'badge-7' })).toBe(7);
  });

  it('matches on the shape name when className is absent', () => {
    expect(findBadgeIndex({ name: 'badge-2' })).toBe(2);
  });

  it('walks up the parent chain to find a matching badge shape', () => {
    expect(findBadgeIndex(chain('leaf', 'group', 'badge-1'))).toBe(1);
  });

  it('finds a match at the 14th (final reachable) parent level', () => {
    const target = chain(...Array<undefined>(13).fill(undefined), 'badge-3');

    expect(findBadgeIndex(target)).toBe(3);
  });

  it('returns null when the match is deeper than 14 levels', () => {
    const target = chain(...Array<undefined>(14).fill(undefined), 'badge-5');

    expect(findBadgeIndex(target)).toBeNull();
  });

  it('returns null when no ancestor matches the badge pattern', () => {
    expect(findBadgeIndex(chain('foo', 'bar', 'baz'))).toBeNull();
  });

  it('returns null for non-object or nullish targets', () => {
    expect(findBadgeIndex(null)).toBeNull();
    expect(findBadgeIndex(undefined)).toBeNull();
    expect(findBadgeIndex('badge-0')).toBeNull();
  });
});

describe('isDataModeAssetBadgeShape', () => {
  it('is true only when the resolved badge index is 0', () => {
    expect(isDataModeAssetBadgeShape({ className: 'badge-0' })).toBe(true);
    expect(isDataModeAssetBadgeShape({ className: 'badge-1' })).toBe(false);
    expect(isDataModeAssetBadgeShape({ className: 'not-a-badge' })).toBe(false);
  });
});

describe('isDataModeLoadMoreBadgeShape', () => {
  it('is true only when the resolved badge index is 1', () => {
    expect(isDataModeLoadMoreBadgeShape({ className: 'badge-1' })).toBe(true);
    expect(isDataModeLoadMoreBadgeShape({ className: 'badge-0' })).toBe(false);
    expect(isDataModeLoadMoreBadgeShape(null)).toBe(false);
  });
});
