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

import type { Edge, Node } from 'reactflow';
import { DependencyType } from '../../../generated/type/entityLineage';
import {
  DIRECT_EDGE_ELK_PRIORITY,
  getELKLayoutedElements,
  INDIRECT_EDGE_ELK_PRIORITY,
  toElkEdge,
} from './ElkLayoutUtils';

const mockLayoutGraph = jest.fn();

jest.mock('./ELKUtil/ELKUtil', () => ({
  __esModule: true,
  default: {
    layoutGraph: (...args: unknown[]) => mockLayoutGraph(...args),
  },
}));

jest.mock('../../../hooks/useLineageStore', () => ({
  useLineageStore: {
    getState: () => ({
      nodeFilterState: new Map<string, boolean>(),
      isColumnLevelLineage: false,
    }),
  },
}));

jest.mock('../../CanvasUtils', () => ({
  getNodeHeight: jest.fn(() => 80),
}));

describe('ElkLayoutUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toElkEdge', () => {
    it('assigns higher ELK priority to DIRECT and unset edges', () => {
      const directEdge: Edge = {
        id: 'e-direct',
        source: 'n1',
        target: 'n2',
        data: { edge: { dependencyType: DependencyType.Direct } },
      };
      const unsetEdge: Edge = {
        id: 'e-unset',
        source: 'n1',
        target: 'n3',
        data: { edge: {} },
      };

      expect(toElkEdge(directEdge)).toEqual({
        id: 'e-direct',
        sources: ['n1'],
        targets: ['n2'],
        layoutOptions: {
          'elk.priority': DIRECT_EDGE_ELK_PRIORITY,
          'elk.layered.priority.direction': DIRECT_EDGE_ELK_PRIORITY,
          'elk.layered.priority.shortness': DIRECT_EDGE_ELK_PRIORITY,
        },
      });
      expect(toElkEdge(unsetEdge).layoutOptions?.['elk.priority']).toBe(
        DIRECT_EDGE_ELK_PRIORITY
      );
    });

    it('assigns lower ELK priority to INDIRECT edges from edge or sceneEdge data', () => {
      const indirectEdge: Edge = {
        id: 'e-indirect',
        source: 'n1',
        target: 'n2',
        data: { edge: { dependencyType: DependencyType.Indirect } },
      };
      const sceneIndirectEdge: Edge = {
        id: 'e-scene-indirect',
        source: 'n2',
        target: 'n3',
        data: { sceneEdge: { dependencyType: DependencyType.Indirect } },
      };

      expect(toElkEdge(indirectEdge)).toEqual({
        id: 'e-indirect',
        sources: ['n1'],
        targets: ['n2'],
        layoutOptions: {
          'elk.priority': INDIRECT_EDGE_ELK_PRIORITY,
          'elk.layered.priority.direction': INDIRECT_EDGE_ELK_PRIORITY,
          'elk.layered.priority.shortness': INDIRECT_EDGE_ELK_PRIORITY,
        },
      });
      expect(toElkEdge(sceneIndirectEdge).layoutOptions?.['elk.priority']).toBe(
        INDIRECT_EDGE_ELK_PRIORITY
      );
      expect(Number(DIRECT_EDGE_ELK_PRIORITY)).toBeGreaterThan(
        Number(INDIRECT_EDGE_ELK_PRIORITY)
      );
    });
  });

  describe('getELKLayoutedElements', () => {
    it('passes prioritized ELK edges to ELKLayout.layoutGraph', async () => {
      mockLayoutGraph.mockResolvedValue({
        children: [
          { id: 'n1', x: 0, y: 0, height: 80 },
          { id: 'n2', x: 300, y: 0, height: 80 },
          { id: 'n3', x: 300, y: 120, height: 80 },
        ],
      });

      const nodes: Node[] = [
        { id: 'n1', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', position: { x: 0, y: 0 }, data: {} },
        { id: 'n3', position: { x: 0, y: 0 }, data: {} },
      ];
      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          data: { edge: { dependencyType: DependencyType.Direct } },
        },
        {
          id: 'e2',
          source: 'n1',
          target: 'n3',
          data: { edge: { dependencyType: DependencyType.Indirect } },
        },
      ];

      const result = await getELKLayoutedElements(nodes, edges);

      expect(mockLayoutGraph).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({
            id: 'e1',
            layoutOptions: expect.objectContaining({
              'elk.priority': DIRECT_EDGE_ELK_PRIORITY,
            }),
          }),
          expect.objectContaining({
            id: 'e2',
            layoutOptions: expect.objectContaining({
              'elk.priority': INDIRECT_EDGE_ELK_PRIORITY,
            }),
          }),
        ])
      );
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toEqual(edges);
    });
  });
});
