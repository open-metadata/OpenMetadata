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

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: {
    getState: () => ({
      nodeFilterState: new Map(),
      isColumnLevelLineage: false,
      isEditMode: false,
    }),
  },
}));

jest.mock('../../CanvasUtils', () => ({
  getNodeHeight: () => 66,
}));

jest.mock('../../EntityLineageNodeUtils', () => ({
  getEntityChildrenAndLabel: () => ({ children: [] }),
}));

jest.mock('./ELKUtil/ELKUtil', () => ({
  __esModule: true,
  default: {
    layoutGraph: jest.fn(async (nodes) => ({
      children: nodes.map((node) => ({
        ...node,
        x: 10,
        y: 20,
      })),
    })),
  },
}));

import type { Edge, Node } from 'reactflow';
import ELKLayout from './ELKUtil/ELKUtil';
import { getELKLayoutedElements } from './ElkLayoutUtils';

const createNode = (index: number): Node =>
  ({
    id: `node-${index}`,
    type: 'default',
    position: { x: 0, y: 0 },
    width: 400,
    height: 66,
    data: { nodeDepth: index === 0 ? 0 : 1, node: {} },
  } as Node);

const createEdge = (index: number): Edge =>
  ({
    id: `edge-${index}`,
    source: 'node-0',
    target: 'node-1',
  } as Edge);

describe('getELKLayoutedElements large graph handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips ELK for graphs exceeding the very-large node threshold', async () => {
    const nodes = Array.from({ length: 1001 }, (_, index) => createNode(index));

    const result = await getELKLayoutedElements(nodes, []);

    expect(ELKLayout.layoutGraph).not.toHaveBeenCalled();
    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.edges).toEqual([]);
  });

  it('skips ELK for graphs exceeding the very-large edge threshold', async () => {
    const nodes = [createNode(0), createNode(1)];
    const edges = Array.from({ length: 4001 }, (_, index) => createEdge(index));

    const result = await getELKLayoutedElements(nodes, edges);

    expect(ELKLayout.layoutGraph).not.toHaveBeenCalled();
    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.edges).toHaveLength(edges.length);
  });

  it('uses reduced ELK thoroughness for moderately large graphs', async () => {
    const nodes = Array.from({ length: 501 }, (_, index) => createNode(index));

    await getELKLayoutedElements(nodes, []);

    expect(ELKLayout.layoutGraph).toHaveBeenCalledWith(expect.any(Array), [], {
      'elk.layered.thoroughness': '1',
    });
  });
});
