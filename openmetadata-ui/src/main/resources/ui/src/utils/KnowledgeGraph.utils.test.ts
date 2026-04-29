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

jest.mock('@antv/g6', () => ({}));
jest.mock('./EntityUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/test/entity/path'),
}));

import { Graph, NodePortStyleProps } from '@antv/g6';
import { ELK } from 'elkjs/lib/elk-api';
import {
  applyInitialFocus,
  assignRadialPorts,
  buildEdgeHighlightStyle,
  buildNodeUpdateData,
  COLOR_SETS,
  computeELKPositions,
  computeELKRadialPositions,
  computeNodeWidth,
  findHighlightPath,
  getColorSetForType,
  MAX_NODE_WIDTH,
  setupGraphEventHandlers,
  transformToG6Format,
} from './KnowledgeGraph.utils';
import ELKLayout from './Lineage/Layout/ELKUtil/ELKUtil';

const makeNode = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  data: { label: id, ...extra },
  style: {},
});

const makeEdge = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
});

describe('KnowledgeGraph.utils', () => {
  describe('computeNodeWidth', () => {
    it('returns minimum width for a very short label and type', () => {
      expect(computeNodeWidth('a', 'x')).toBe(120);
    });

    it('returns MAX_NODE_WIDTH when the label is very long', () => {
      const longLabel = 'VeryLongEntityLabelThatExceedsMaximumWidth';

      expect(computeNodeWidth(longLabel, 'sometype')).toBe(MAX_NODE_WIDTH);
    });

    it('returns a computed width for a typical label', () => {
      // 'MyTable'(7) * 9.5 = 66.5, 'table'(5) * 7.5 + 8 = 45.5
      // approxWidth = 8 + 14 + 8 + 66.5 + 8 + 45.5 + 8 = 158
      expect(computeNodeWidth('MyTable', 'table')).toBe(158);
    });

    it('returns minimum width for empty strings', () => {
      expect(computeNodeWidth('', '')).toBe(120);
    });
  });

  describe('getColorSetForType', () => {
    it('returns an object with main and light hex color strings', () => {
      const result = getColorSetForType('table');

      expect(result).toHaveProperty('main');
      expect(result).toHaveProperty('light');
      expect(result.main).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.light).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('always returns the same color for the same type', () => {
      expect(getColorSetForType('table')).toEqual(getColorSetForType('table'));
      expect(getColorSetForType('pipeline')).toEqual(
        getColorSetForType('pipeline')
      );
    });

    it('returns a value from the COLOR_SETS array', () => {
      const result = getColorSetForType('dashboard');

      expect(COLOR_SETS).toContainEqual(result);
    });
  });

  describe('findHighlightPath', () => {
    it('returns only the origin node when origin equals clicked node', () => {
      const result = findHighlightPath('A', 'A', [makeNode('A')], []);

      expect([...result.nodeIds]).toEqual(['A']);
      expect(result.edgeIds.size).toBe(0);
    });

    it('includes origin, target, and their connecting edge for a direct connection', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const edges = [makeEdge('e1', 'A', 'B')];
      const result = findHighlightPath('A', 'B', nodes, edges);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
    });

    it('returns empty sets when there is no path between nodes', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const result = findHighlightPath('A', 'B', nodes, []);

      expect(result.nodeIds.size).toBe(0);
      expect(result.edgeIds.size).toBe(0);
    });

    it('includes all intermediate nodes and edges in a multi-hop path', () => {
      const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
      const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
      const result = findHighlightPath('A', 'C', nodes, edges);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.nodeIds.has('C')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
      expect(result.edgeIds.has('e2')).toBe(true);
    });

    it('combines both directions for bidirectional edges', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'A')];
      const result = findHighlightPath('A', 'B', nodes, edges);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
      expect(result.edgeIds.has('e2')).toBe(true);
    });
  });

  describe('buildEdgeHighlightStyle', () => {
    it('returns correct highlight style with the provided primary color', () => {
      expect(buildEdgeHighlightStyle('#1677ff')).toEqual({
        stroke: '#1677ff',
        lineWidth: 2,
        opacity: 1,
        zIndex: 100,
        labelFontWeight: 500,
        labelBackgroundLineWidth: 2,
      });
    });
  });

  describe('buildNodeUpdateData', () => {
    it('returns payload with zIndex 100 and highlighted true when highlighted', () => {
      const nodes = [makeNode('A')];
      const result = buildNodeUpdateData('A', nodes, true);

      expect(result.id).toBe('A');
      expect(result.style).toEqual({ zIndex: 100 });
      expect(result.data).toMatchObject({ highlighted: true });
    });

    it('returns payload with zIndex 0 and highlighted false when not highlighted', () => {
      const nodes = [makeNode('A')];
      const result = buildNodeUpdateData('A', nodes, false);

      expect(result.style).toEqual({ zIndex: 0 });
      expect(result.data).toMatchObject({ highlighted: false });
    });

    it('returns minimal payload when node id is not found', () => {
      const result = buildNodeUpdateData('Z', [], true);

      expect(result.id).toBe('Z');
      expect(result.data).toEqual({ highlighted: true });
    });
  });

  describe('transformToG6Format', () => {
    it('returns empty nodes and edges for null input', () => {
      expect(transformToG6Format(null)).toEqual({ nodes: [], edges: [] });
    });

    it('maps a single node to G6 format with id, label, type, and color data', () => {
      const data = {
        nodes: [{ id: 'n1', label: 'MyTable', type: 'table' }],
        edges: [],
      };
      const result = transformToG6Format(data);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes?.[0].id).toBe('n1');
      expect(result.nodes?.[0].data).toMatchObject({
        label: 'MyTable',
        type: 'table',
      });
      expect(result.nodes?.[0].data).toHaveProperty('colorMain');
      expect(result.nodes?.[0].data).toHaveProperty('colorLight');
    });

    it('sets default stroke and lineWidth on unidirectional edges without curveOffset', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'user' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'owns' }],
      };
      const result = transformToG6Format(data);

      expect(result.edges).toHaveLength(1);
      expect(result.edges?.[0].style).toMatchObject({
        stroke: '#d9d9d9',
        lineWidth: 1.5,
        labelPlacement: 0.4,
      });
      expect(result.edges?.[0].style).not.toHaveProperty('curveOffset');
    });

    it('sets curveOffset 60 and labelPlacement 0.35 for bidirectional edges', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'user' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'owns' },
          { from: 'n2', to: 'n1', label: 'ownedBy' },
        ],
      };
      const result = transformToG6Format(data);

      expect(result.edges).toHaveLength(2);

      result.edges?.forEach((edge) => {
        expect(edge.style?.curveOffset).toBe(60);
        expect(edge.style?.labelPlacement).toBe(0.35);
      });
    });

    it('merges parallel same-direction edges into one with a combined label', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'table' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'rel1' },
          { from: 'n1', to: 'n2', label: 'rel2' },
        ],
      };
      const result = transformToG6Format(data);

      expect(result.edges).toHaveLength(1);
      expect(result.edges?.[0].style?.labelText).toBe('rel1 · rel2');
    });
  });

  describe('assignRadialPorts', () => {
    const leftPort = { key: 'left', placement: 'left' };
    const rightPort = { key: 'right', placement: 'right' };

    it('passes the focus node through unchanged (no ports added)', () => {
      const nodes = [
        { id: 'focus', style: { x: 200, y: 100 }, data: {} },
        { id: 'neighbor', style: { x: 100, y: 100 }, data: {} },
      ];
      const edges = [makeEdge('e1', 'focus', 'neighbor')];
      const result = assignRadialPorts(
        nodes,
        edges,
        'focus',
        200,
        leftPort as NodePortStyleProps,
        rightPort as NodePortStyleProps
      );
      const focusResult = result.find((n) => n.id === 'focus');

      expect(focusResult?.style?.ports).toBeUndefined();
    });

    it('assigns left port when all neighbors are to the left of the node', () => {
      const nodes = [
        { id: 'A', style: { x: 300, y: 100 }, data: {} },
        { id: 'B', style: { x: 100, y: 100 }, data: {} },
      ];
      const edges = [makeEdge('e1', 'A', 'B')];
      const result = assignRadialPorts(
        nodes,
        edges,
        'B',
        200,
        leftPort as NodePortStyleProps,
        rightPort as NodePortStyleProps
      );
      const nodeA = result.find((n) => n.id === 'A')!;

      expect(nodeA.style?.ports).toEqual([leftPort]);
    });

    it('assigns right port when all neighbors are to the right of the node', () => {
      const nodes = [
        { id: 'A', style: { x: 100, y: 100 }, data: {} },
        { id: 'B', style: { x: 300, y: 100 }, data: {} },
      ];
      const edges = [makeEdge('e1', 'A', 'B')];
      const result = assignRadialPorts(
        nodes,
        edges,
        'B',
        200,
        leftPort as NodePortStyleProps,
        rightPort as NodePortStyleProps
      );
      const nodeA = result.find((n) => n.id === 'A')!;

      expect(nodeA.style?.ports).toEqual([rightPort]);
    });
  });

  describe('computeELKPositions', () => {
    it('returns a Map', async () => {
      const result = await computeELKPositions([], []);

      expect(result).toBeInstanceOf(Map);
    });

    it('returns an empty Map for empty input', async () => {
      const result = await computeELKPositions([], []);

      expect(result.size).toBe(0);
    });

    it('extracts x and y coordinates from the ELK layout result', async () => {
      jest.spyOn(ELKLayout, 'getElk').mockReturnValueOnce({
        layout: jest.fn().mockResolvedValue({
          id: 'root',
          children: [
            { id: 'n1', x: 10, y: 20 },
            { id: 'n2', x: 30, y: 40 },
          ],
          edges: [],
        }),
      } as unknown as ELK);

      const nodes = [makeNode('n1'), makeNode('n2')];
      const result = await computeELKPositions(nodes, []);

      expect(result.get('n1')).toEqual({ x: 10, y: 20 });
      expect(result.get('n2')).toEqual({ x: 30, y: 40 });
    });
  });

  describe('computeELKRadialPositions', () => {
    it('returns a Map', async () => {
      const result = await computeELKRadialPositions([], [], 'focus', 0, 0);

      expect(result).toBeInstanceOf(Map);
    });

    it('places the focus node at the provided center coordinates', async () => {
      const nodes = [makeNode('focus')];
      const result = await computeELKRadialPositions(
        nodes,
        [],
        'focus',
        200,
        300
      );

      expect(result.get('focus')).toEqual({ x: 200, y: 300 });
    });

    it('falls back to uniform radial distribution when ELK layout throws', async () => {
      jest.spyOn(ELKLayout, 'getElk').mockReturnValueOnce({
        layout: jest.fn().mockRejectedValue(new Error('ELK error')),
      } as unknown as ELK);

      const nodes = [makeNode('focus'), makeNode('A')];
      const edges = [makeEdge('e1', 'focus', 'A')];
      const result = await computeELKRadialPositions(
        nodes,
        edges,
        'focus',
        0,
        0
      );

      expect(result.has('focus')).toBe(true);
      expect(result.has('A')).toBe(true);
    });
  });

  describe('applyInitialFocus', () => {
    it('does nothing when focusNodeId is empty', async () => {
      const mockGraph = {
        focusElement: jest.fn(),
        updateNodeData: jest.fn(),
        draw: jest.fn().mockResolvedValue(undefined),
      };

      await applyInitialFocus(mockGraph as unknown as Graph, [], '');

      expect(mockGraph.focusElement).not.toHaveBeenCalled();
      expect(mockGraph.updateNodeData).not.toHaveBeenCalled();
    });

    it('calls focusElement, updateNodeData with highlighted flags, and draw', async () => {
      const mockGraph = {
        focusElement: jest.fn().mockResolvedValue(undefined),
        updateNodeData: jest.fn(),
        draw: jest.fn().mockResolvedValue(undefined),
      };
      const nodes = [
        { id: 'focus', data: { label: 'FocusNode' }, style: {} },
        { id: 'other', data: { label: 'OtherNode' }, style: {} },
      ];

      await applyInitialFocus(mockGraph as unknown as Graph, nodes, 'focus');

      expect(mockGraph.focusElement).toHaveBeenCalledWith('focus');
      expect(mockGraph.updateNodeData).toHaveBeenCalledWith([
        {
          id: 'focus',
          data: { label: 'FocusNode', highlighted: true, dimmed: false },
        },
        {
          id: 'other',
          data: { label: 'OtherNode', highlighted: false, dimmed: false },
        },
      ]);
      expect(mockGraph.draw).toHaveBeenCalled();
    });
  });

  describe('setupGraphEventHandlers', () => {
    const buildMockGraph = () => ({
      on: jest.fn(),
      updateNodeData: jest.fn(),
      updateEdgeData: jest.fn(),
      draw: jest.fn().mockResolvedValue(undefined),
    });

    const buildCtx = (graphOverride?: ReturnType<typeof buildMockGraph>) => {
      const graph = graphOverride ?? buildMockGraph();

      return {
        ctx: {
          graph: graph as unknown as Graph,
          g6Nodes: [makeNode('A'), makeNode('B')],
          g6Edges: [makeEdge('e1', 'A', 'B')],
          focusNodeId: 'A',
          graphDataNodes: [
            {
              id: 'A',
              type: 'table',
              fullyQualifiedName: 'ns.A',
              label: 'A',
            },
            {
              id: 'B',
              type: 'user',
              fullyQualifiedName: 'user.B',
              label: 'B',
            },
          ],
          pendingHighlightRef: { current: null },
          selectedNodeIdRef: { current: null },
          setSelectedNode: jest.fn(),
        },
        graph: graph as unknown as Graph,
      };
    };

    it('registers all 5 expected G6 event handlers', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      expect(graph.on).toHaveBeenCalledTimes(5);

      const registeredEvents = graph.on.mock.calls.map(
        ([event]: [string]) => event
      );

      expect(registeredEvents).toContain('node:click');
      expect(registeredEvents).toContain('node:dblclick');
      expect(registeredEvents).toContain('node:pointerover');
      expect(registeredEvents).toContain('node:pointerleave');
      expect(registeredEvents).toContain('canvas:click');
    });

    it('calls setSelectedNode with the matched graph node on node:click', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const clickHandler = graph.on.mock.calls.find(
        ([e]: [string]) => e === 'node:click'
      )[1];
      clickHandler({ target: { id: 'B' } });

      expect(ctx.setSelectedNode).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'B' })
      );
    });

    it('calls setSelectedNode(null) on canvas:click', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const canvasClickHandler = graph.on.mock.calls.find(
        ([e]: [string]) => e === 'canvas:click'
      )[1];
      canvasClickHandler();

      expect(ctx.setSelectedNode).toHaveBeenCalledWith(null);
    });
  });
});
