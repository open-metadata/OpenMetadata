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
jest.mock('./EntityLinkUtils', () => ({
  getEntityLinkFromType: jest.fn().mockReturnValue('/test/entity/path'),
}));

import { Graph, NodePortStyleProps } from '@antv/g6';
import { ELK } from 'elkjs/lib/elk-api';
import {
  BIDIRECTIONAL_CURVE_OFFSET,
  DIMMED_OPACITY,
  EDGE_HIGHLIGHT_LINE_WIDTH,
  EDGE_LINE_WIDTH,
  MAX_NODE_WIDTH,
  NODE_NEUTRAL_COLOR,
  RING_STRETCH_MAX,
} from '../components/KnowledgeGraph/KnowledgeGraph.constants';
import { getRelationStyle } from '../components/KnowledgeGraph/KnowledgeGraph.relations';
import {
  applyInitialFocus,
  assignRadialPorts,
  buildEdgeBaseStyle,
  buildEdgeDimStyle,
  buildEdgeHighlightStyle,
  buildNodeUpdateData,
  computeELKPositions,
  computeELKRadialPositions,
  computeLabelPlacements,
  computeNodeWidth,
  countRelationCategories,
  findHighlightPath,
  getColorSetForType,
  setupGraphEventHandlers,
  stretchRingToViewport,
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

type TestNode = ReturnType<typeof makeNode>;
type TestEdge = ReturnType<typeof makeEdge>;

const makeAdjMaps = (nodes: TestNode[], edges: TestEdge[]) => {
  const fwdAdj = new Map<string, Array<{ target: string; edgeId: string }>>();
  nodes.forEach((n) => fwdAdj.set(n.id, []));
  edges.forEach((e) =>
    fwdAdj.get(e.source)?.push({ target: e.target, edgeId: e.id })
  );

  return { fwdAdj };
};

const makeNodeMap = (nodes: TestNode[]) => new Map(nodes.map((n) => [n.id, n]));

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

    it('gives different entity types different colors', () => {
      expect(getColorSetForType('table').main).not.toBe(
        getColorSetForType('dashboard').main
      );
    });

    it('ignores case and separators when matching a type', () => {
      expect(getColorSetForType('databaseSchema')).toEqual(
        getColorSetForType('database_schema')
      );
    });

    it('collapses every service type onto the shared service color', () => {
      expect(getColorSetForType('databaseService')).toEqual(
        getColorSetForType('messagingService')
      );
    });

    it('falls back to the neutral color for an unknown type', () => {
      const unknown = getColorSetForType('somethingNobodyHasHeardOf');

      expect(unknown.main).toBe(NODE_NEUTRAL_COLOR.fallback);
    });
  });

  describe('findHighlightPath', () => {
    it('returns only the origin node when origin equals clicked node', () => {
      const nodes = [makeNode('A')];
      const { fwdAdj } = makeAdjMaps(nodes, []);
      const result = findHighlightPath('A', 'A', fwdAdj);

      expect([...result.nodeIds]).toEqual(['A']);
      expect(result.edgeIds.size).toBe(0);
    });

    it('includes origin, target, and their connecting edge for a direct connection', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const edges = [makeEdge('e1', 'A', 'B')];
      const { fwdAdj } = makeAdjMaps(nodes, edges);
      const result = findHighlightPath('A', 'B', fwdAdj);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
    });

    it('returns empty sets when there is no path between nodes', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const { fwdAdj } = makeAdjMaps(nodes, []);
      const result = findHighlightPath('A', 'B', fwdAdj);

      expect(result.nodeIds.size).toBe(0);
      expect(result.edgeIds.size).toBe(0);
    });

    it('includes all intermediate nodes and edges in a multi-hop path', () => {
      const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
      const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'C')];
      const { fwdAdj } = makeAdjMaps(nodes, edges);
      const result = findHighlightPath('A', 'C', fwdAdj);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.nodeIds.has('C')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
      expect(result.edgeIds.has('e2')).toBe(true);
    });

    it('combines both directions for bidirectional edges', () => {
      const nodes = [makeNode('A'), makeNode('B')];
      const edges = [makeEdge('e1', 'A', 'B'), makeEdge('e2', 'B', 'A')];
      const { fwdAdj } = makeAdjMaps(nodes, edges);
      const result = findHighlightPath('A', 'B', fwdAdj);

      expect(result.nodeIds.has('A')).toBe(true);
      expect(result.nodeIds.has('B')).toBe(true);
      expect(result.edgeIds.has('e1')).toBe(true);
      expect(result.edgeIds.has('e2')).toBe(true);
    });
  });

  describe('buildEdgeHighlightStyle', () => {
    it('keeps the relation family color and dash while thickening the line', () => {
      const result = buildEdgeHighlightStyle('ontology', 'Mapped to');
      const style = getRelationStyle('ontology');

      expect(result.stroke).toBe(style.color);
      expect(result.lineDash).toEqual(style.lineDash);
      expect(result.lineWidth).toBe(EDGE_HIGHLIGHT_LINE_WIDTH);
      expect(result.opacity).toBe(1);
      expect(result.zIndex).toBe(100);
    });

    it('colors the arrowhead to match the line so direction stays readable', () => {
      const result = buildEdgeHighlightStyle('ontology', 'Mapped to');
      const { color } = getRelationStyle('ontology');

      expect(result.endArrowFill).toBe(color);
      expect(result.endArrowStroke).toBe(color);
    });

    it('gives different relation families different colors', () => {
      expect(buildEdgeHighlightStyle('lineage', 'Downstream').stroke).not.toBe(
        buildEdgeHighlightStyle('ownership', 'Owned by').stroke
      );
    });

    it('restores the label a dim pass cleared, so the focused edge is readable', () => {
      // The regression this guards: G6 merges style updates, so promoting a
      // dimmed edge with a partial style left it as the only unlabelled edge.
      const dimmed = buildEdgeDimStyle('lineage');
      const focused = buildEdgeHighlightStyle('lineage', 'Downstream');

      expect(dimmed.labelText).toBe('');
      expect({ ...dimmed, ...focused }.labelText).toBe('Downstream');
      expect({ ...dimmed, ...focused }.labelBackground).toBe(true);
      expect({ ...dimmed, ...focused }.opacity).toBe(1);
    });

    it('leaves the label off when the labels toggle is off', () => {
      expect(
        buildEdgeHighlightStyle('lineage', 'Downstream', false).labelText
      ).toBe('');
    });
  });

  describe('buildEdgeBaseStyle', () => {
    it('dashes non-lineage families so they stay separable without color', () => {
      expect(buildEdgeBaseStyle('lineage', 'Downstream').lineDash).toEqual([]);
      expect(
        buildEdgeBaseStyle('ontology', 'Mapped to').lineDash.length
      ).toBeGreaterThan(0);
    });

    it('drops the label text and pill when labels are turned off', () => {
      const withLabels = buildEdgeBaseStyle('structure', 'Has column', true);
      const withoutLabels = buildEdgeBaseStyle(
        'structure',
        'Has column',
        false
      );

      expect(withLabels.labelText).toBe('Has column');
      expect(withLabels.labelBackground).toBe(true);
      expect(withoutLabels.labelText).toBe('');
      expect(withoutLabels.labelBackground).toBe(false);
    });

    it('keeps the stroke identical whether or not labels are shown', () => {
      expect(buildEdgeBaseStyle('quality', 'Validates', false).stroke).toBe(
        buildEdgeBaseStyle('quality', 'Validates', true).stroke
      );
    });
  });

  describe('buildEdgeDimStyle', () => {
    it('fades the edge and hides its label but keeps the family color', () => {
      const result = buildEdgeDimStyle('governance');

      expect(result.opacity).toBe(DIMMED_OPACITY);
      expect(result.labelText).toBe('');
      expect(result.stroke).toBe(getRelationStyle('governance').color);
    });
  });

  describe('countRelationCategories', () => {
    it('returns all-zero counts for null input', () => {
      const counts = countRelationCategories(null);

      expect(Object.values(counts).every((count) => count === 0)).toBe(true);
    });

    it('buckets each edge into its relation family', () => {
      const counts = countRelationCategories({
        nodes: [
          { id: 'a', label: 'A', type: 'table' },
          { id: 'b', label: 'B', type: 'table' },
          { id: 'c', label: 'C', type: 'user' },
          { id: 'd', label: 'D', type: 'glossaryTerm' },
        ],
        edges: [
          { from: 'a', to: 'b', label: 'downstream' },
          { from: 'a', to: 'c', label: 'ownedBy' },
          { from: 'a', to: 'd', label: 'mappedTo' },
        ],
      });

      expect(counts.lineage).toBe(1);
      expect(counts.ownership).toBe(1);
      expect(counts.ontology).toBe(1);
      expect(counts.structure).toBe(0);
    });

    it('counts every raw edge, not the merged ones the canvas draws', () => {
      const counts = countRelationCategories({
        nodes: [
          { id: 'a', label: 'A', type: 'table' },
          { id: 'b', label: 'B', type: 'table' },
        ],
        edges: [
          { from: 'a', to: 'b', label: 'downstream' },
          { from: 'a', to: 'b', label: 'derivedFrom' },
        ],
      });

      expect(counts.lineage).toBe(2);
    });
  });

  describe('buildNodeUpdateData', () => {
    it('returns payload with zIndex 100 and highlighted true when highlighted', () => {
      const nodes = [makeNode('A')];
      const result = buildNodeUpdateData('A', makeNodeMap(nodes), true);

      expect(result.id).toBe('A');
      expect(result.style).toEqual({ zIndex: 100 });
      expect(result.data).toMatchObject({ highlighted: true });
    });

    it('returns payload with zIndex 0 and highlighted false when not highlighted', () => {
      const nodes = [makeNode('A')];
      const result = buildNodeUpdateData('A', makeNodeMap(nodes), false);

      expect(result.style).toEqual({ zIndex: 0 });
      expect(result.data).toMatchObject({ highlighted: false });
    });

    it('returns minimal payload when node id is not found', () => {
      const result = buildNodeUpdateData('Z', new Map(), true);

      expect(result.id).toBe('Z');
      expect(result.data).toEqual({ highlighted: true, dimmed: false });
    });

    it('marks the node dimmed so CustomNode can fade it', () => {
      const nodes = [makeNode('A')];
      const result = buildNodeUpdateData('A', makeNodeMap(nodes), false, true);

      expect(result.data).toMatchObject({ highlighted: false, dimmed: true });
    });
  });

  describe('computeLabelPlacements', () => {
    it('keeps a lone edge just off the crowded midpoint', () => {
      expect(computeLabelPlacements([{ from: 'a', to: 'b' }])).toEqual([0.4]);
    });

    it('spreads the anchors of edges that fan into the same node', () => {
      const placements = computeLabelPlacements([
        { from: 'a', to: 'hub' },
        { from: 'b', to: 'hub' },
        { from: 'c', to: 'hub' },
      ]);

      expect(new Set(placements).size).toBe(3);
      expect(Math.min(...placements)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...placements)).toBeLessThanOrEqual(1);
    });

    it('spreads the anchors of edges that fan out of the same node', () => {
      const placements = computeLabelPlacements([
        { from: 'hub', to: 'a' },
        { from: 'hub', to: 'b' },
      ]);

      expect(placements[0]).not.toBe(placements[1]);
    });

    it('returns one placement per edge', () => {
      const edges = [
        { from: 'a', to: 'hub' },
        { from: 'b', to: 'hub' },
        { from: 'c', to: 'd' },
      ];

      expect(computeLabelPlacements(edges)).toHaveLength(edges.length);
    });

    it('returns an empty list for an empty graph', () => {
      expect(computeLabelPlacements([])).toEqual([]);
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

    it('styles a unidirectional edge by relation family, without curveOffset', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'user' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'ownedBy' }],
      };
      const result = transformToG6Format(data);

      expect(result.edges).toHaveLength(1);
      expect(result.edges?.[0].style).toMatchObject({
        stroke: getRelationStyle('ownership').color,
        lineWidth: EDGE_LINE_WIDTH,
        labelPlacement: 0.4,
      });
      expect(result.edges?.[0].style).not.toHaveProperty('curveOffset');
    });

    it('records the relation family on the edge so hover can restyle it', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'table' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'downstream' }],
      };
      const result = transformToG6Format(data);

      expect(result.edges?.[0].data).toMatchObject({ category: 'lineage' });
    });

    it('gives edges of different families different strokes', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'table' },
          { id: 'n3', label: 'C', type: 'user' },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'downstream' },
          { from: 'n1', to: 'n3', label: 'ownedBy' },
        ],
      };
      const result = transformToG6Format(data);

      expect(result.edges?.[0].style?.stroke).not.toBe(
        result.edges?.[1].style?.stroke
      );
    });

    it('omits edge label text when labels are turned off', () => {
      const data = {
        nodes: [
          { id: 'n1', label: 'A', type: 'table' },
          { id: 'n2', label: 'B', type: 'table' },
        ],
        edges: [{ from: 'n1', to: 'n2', label: 'downstream' }],
      };
      const result = transformToG6Format(data, { showEdgeLabels: false });

      expect(result.edges?.[0].style?.labelText).toBe('');
      expect(result.edges?.[0].style?.stroke).toBe(
        getRelationStyle('lineage').color
      );
    });

    it('bows both edges of a bidirectional pair to opposite sides', () => {
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

      // G6 measures curveOffset along the direction of travel, so one positive
      // value bends each direction onto its own side — which is also what keeps
      // the two labels apart despite sharing an anchor fraction.
      result.edges?.forEach((edge) => {
        expect(edge.style?.curveOffset).toBe(BIDIRECTIONAL_CURVE_OFFSET);
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

  describe('stretchRingToViewport', () => {
    const cx = 660;
    const cy = 245;

    it('widens the ring and flattens it for a wide pane', () => {
      const stretched = stretchRingToViewport(
        new Map([
          ['right', { x: cx + 100, y: cy }],
          ['below', { x: cx, y: cy + 100 }],
        ]),
        cx,
        cy
      );

      expect(stretched.get('right')?.x).toBeGreaterThan(cx + 100);
      expect(stretched.get('below')?.y).toBeLessThan(cy + 100);
    });

    it('leaves the centre where it is', () => {
      const stretched = stretchRingToViewport(
        new Map([['focus', { x: cx, y: cy }]]),
        cx,
        cy
      );

      expect(stretched.get('focus')).toEqual({ x: cx, y: cy });
    });

    it('does not stretch a pane that is taller than it is wide', () => {
      const positions = new Map([['a', { x: 400, y: 100 }]]);

      expect(stretchRingToViewport(positions, 300, 500)).toBe(positions);
    });

    it('caps the stretch so spokes stay angularly distinct', () => {
      // An extremely wide pane must not flatten the ring into a line.
      const stretched = stretchRingToViewport(
        new Map([['a', { x: 1100, y: 100 }]]),
        1000,
        10
      );

      expect(stretched.get('a')?.x).toBe(1000 + 100 * RING_STRETCH_MAX);
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
      const nodeA = result.find((n) => n.id === 'A');

      expect(nodeA?.style?.ports).toEqual([leftPort]);
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
      const nodeA = result.find((n) => n.id === 'A');

      expect(nodeA?.style?.ports).toEqual([rightPort]);
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

      await applyInitialFocus(mockGraph as unknown as Graph, '');

      expect(mockGraph.focusElement).not.toHaveBeenCalled();
      expect(mockGraph.updateNodeData).not.toHaveBeenCalled();
    });

    it('calls focusElement, updateNodeData with highlighted flags, and draw', async () => {
      const mockGraph = {
        focusElement: jest.fn().mockResolvedValue(undefined),
        updateNodeData: jest.fn(),
        draw: jest.fn().mockResolvedValue(undefined),
      };

      await applyInitialFocus(mockGraph as unknown as Graph, 'focus');

      expect(mockGraph.focusElement).toHaveBeenCalledWith('focus');
      expect(mockGraph.updateNodeData).toHaveBeenCalledWith([
        { id: 'focus', data: { highlighted: true } },
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
      const mockGraph = graphOverride ?? buildMockGraph();

      return {
        ctx: {
          graph: mockGraph as unknown as Graph,
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
          showEdgeLabels: true,
          pendingHighlightRef: { current: null },
          selectedNodeIdRef: { current: null },
          setSelectedNode: jest.fn(),
          setEdgeTooltip: jest.fn(),
          canvasRef: { current: null },
        },
        graph: mockGraph,
      };
    };

    /** Runs the handler G6 would call for `event`. */
    const fire = (
      graph: ReturnType<typeof buildMockGraph>,
      event: string,
      target: { id: string }
    ) => {
      const entry = graph.on.mock.calls.find(
        ([name]: [string]) => name === event
      );
      entry?.[1]({ target, client: { x: 0, y: 0 } });
    };

    /** The node ids the last updateNodeData call marked focused / dimmed. */
    const lastNodeStates = (graph: ReturnType<typeof buildMockGraph>) => {
      const calls = graph.updateNodeData.mock.calls;
      const payload = calls.at(-1)?.[0] ?? [];

      return {
        focused: payload
          .filter(
            (n: { data?: { highlighted?: boolean } }) => n.data?.highlighted
          )
          .map((n: { id: string }) => n.id),
        dimmed: payload
          .filter((n: { data?: { dimmed?: boolean } }) => n.data?.dimmed)
          .map((n: { id: string }) => n.id),
      };
    };

    it('dims everything off the hovered path', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      fire(graph, 'node:pointerover', { id: 'B' });

      const { focused, dimmed } = lastNodeStates(graph);

      expect(focused).toEqual(expect.arrayContaining(['A', 'B']));
      expect(dimmed).toEqual([]);
    });

    it('keeps the hovered node lit when it has no path to the focus entity', () => {
      // C is not reachable from the focus node A, so the path is empty. Dimming
      // strictly by path would black out the graph including C itself.
      const graph = buildMockGraph();
      const { ctx } = buildCtx(graph);
      ctx.g6Nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
      ctx.graphDataNodes = [
        ...ctx.graphDataNodes,
        { id: 'C', type: 'table', fullyQualifiedName: 'ns.C', label: 'C' },
      ];
      setupGraphEventHandlers(ctx);

      fire(graph, 'node:pointerover', { id: 'C' });

      const { focused, dimmed } = lastNodeStates(graph);

      expect(focused).toEqual(['C']);
      expect(dimmed).toEqual(expect.arrayContaining(['A', 'B']));
    });

    it('restores every element when the pointer leaves with nothing selected', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      fire(graph, 'node:pointerover', { id: 'B' });
      graph.updateNodeData.mockClear();
      fire(graph, 'node:pointerleave', { id: 'B' });

      const { focused, dimmed } = lastNodeStates(graph);

      expect(focused).toEqual([]);
      expect(dimmed).toEqual([]);
    });

    it('registers all 8 expected G6 event handlers', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      expect(graph.on).toHaveBeenCalledTimes(8);

      const registeredEvents = graph.on.mock.calls.map(
        ([event]: [string]) => event
      );

      expect(registeredEvents).toContain('node:click');
      expect(registeredEvents).toContain('node:dblclick');
      expect(registeredEvents).toContain('node:pointerover');
      expect(registeredEvents).toContain('node:pointerleave');
      expect(registeredEvents).toContain('edge:pointerover');
      expect(registeredEvents).toContain('edge:pointerleave');
      expect(registeredEvents).toContain('edge:click');
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

  describe('setupGraphEventHandlers – edge events', () => {
    const buildMockGraph = () => ({
      on: jest.fn(),
      updateNodeData: jest.fn(),
      updateEdgeData: jest.fn(),
      focusElement: jest.fn().mockResolvedValue(undefined),
      draw: jest.fn().mockResolvedValue(undefined),
    });

    const buildCtx = (graphOverride?: ReturnType<typeof buildMockGraph>) => {
      const mockGraph = graphOverride ?? buildMockGraph();

      return {
        ctx: {
          graph: mockGraph as unknown as Graph,
          g6Nodes: [makeNode('A'), makeNode('B')],
          g6Edges: [
            {
              id: 'e1',
              source: 'A',
              target: 'B',
              data: { label: 'owns' },
            },
          ],
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
          showEdgeLabels: true,
          pendingHighlightRef: { current: null },
          selectedNodeIdRef: { current: null },
          setSelectedNode: jest.fn(),
          setEdgeTooltip: jest.fn(),
          canvasRef: { current: null },
        },
        graph: mockGraph,
      };
    };

    const getHandler = (
      graph: ReturnType<typeof buildMockGraph>,
      eventName: string
    ) => {
      const call = graph.on.mock.calls.find(([e]: [string]) => e === eventName);

      return call?.[1] as ((...args: unknown[]) => void) | undefined;
    };

    it('edge:pointerover calls setEdgeTooltip with correct position, labels, sourceLabel, targetLabel', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const handler = getHandler(graph, 'edge:pointerover');
      handler?.({ target: { id: 'e1' }, client: { x: 100, y: 200 } });

      expect(ctx.setEdgeTooltip).toHaveBeenCalledWith({
        x: 100,
        y: 200,
        edgeId: 'e1',
        labels: ['owns'],
        sourceLabel: 'A',
        targetLabel: 'B',
      });
    });

    it('edge:pointerover uses mergedLabels array when present', () => {
      const mockGraph = buildMockGraph();
      const { ctx } = buildCtx(mockGraph);
      ctx.g6Edges = [
        {
          id: 'e1',
          source: 'A',
          target: 'B',
          data: { label: 'rel1 · rel2', mergedLabels: ['rel1', 'rel2'] },
        },
      ] as unknown as typeof ctx.g6Edges;
      setupGraphEventHandlers(ctx);

      const handler = getHandler(mockGraph, 'edge:pointerover');
      handler?.({ target: { id: 'e1' }, client: { x: 0, y: 0 } });

      expect(ctx.setEdgeTooltip).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ['rel1', 'rel2'] })
      );
    });

    it('edge:pointerover highlights source and target nodes', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const handler = getHandler(graph, 'edge:pointerover');
      handler?.({ target: { id: 'e1' }, client: { x: 0, y: 0 } });

      const updatedIds = graph.updateNodeData.mock.calls.flatMap(
        (args: unknown[][]) =>
          (args[0] as Array<{ id: string }>).map((item) => item.id)
      );

      expect(updatedIds).toContain('A');
      expect(updatedIds).toContain('B');
    });

    it('edge:pointerleave calls setEdgeTooltip(null)', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const overHandler = getHandler(graph, 'edge:pointerover');
      overHandler?.({ target: { id: 'e1' }, client: { x: 0, y: 0 } });

      const leaveHandler = getHandler(graph, 'edge:pointerleave');
      leaveHandler?.();

      expect(ctx.setEdgeTooltip).toHaveBeenLastCalledWith(null);
    });

    it('edge:pointerleave resets edge style after hover', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const overHandler = getHandler(graph, 'edge:pointerover');
      overHandler?.({ target: { id: 'e1' }, client: { x: 0, y: 0 } });

      graph.updateEdgeData.mockClear();

      const leaveHandler = getHandler(graph, 'edge:pointerleave');
      leaveHandler?.();

      const resetIds = graph.updateEdgeData.mock.calls.flatMap(
        (args: unknown[][]) =>
          (args[0] as Array<{ id: string }>).map((item) => item.id)
      );

      expect(resetIds).toContain('e1');
    });

    it('edge:pointerleave re-applies path highlight when a node is selected', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const nodeClickHandler = getHandler(graph, 'node:click');
      nodeClickHandler?.({ target: { id: 'A' } });

      const overHandler = getHandler(graph, 'edge:pointerover');
      overHandler?.({ target: { id: 'e1' }, client: { x: 0, y: 0 } });

      graph.updateNodeData.mockClear();

      const leaveHandler = getHandler(graph, 'edge:pointerleave');
      leaveHandler?.();

      expect(graph.updateNodeData).toHaveBeenCalled();
    });

    it('edge:click focuses target when source is selected', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const nodeClickHandler = getHandler(graph, 'node:click');
      nodeClickHandler?.({ target: { id: 'A' } });

      const edgeClickHandler = getHandler(graph, 'edge:click');
      edgeClickHandler?.({ target: { id: 'e1' } });

      expect(graph.focusElement).toHaveBeenCalledWith(
        'B',
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });

    it('edge:click focuses source when target is selected', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const nodeClickHandler = getHandler(graph, 'node:click');
      nodeClickHandler?.({ target: { id: 'B' } });

      const edgeClickHandler = getHandler(graph, 'edge:click');
      edgeClickHandler?.({ target: { id: 'e1' } });

      expect(graph.focusElement).toHaveBeenCalledWith(
        'A',
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });

    it('edge:click defaults to target when nothing is selected', () => {
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const edgeClickHandler = getHandler(graph, 'edge:click');
      edgeClickHandler?.({ target: { id: 'e1' } });

      expect(graph.focusElement).toHaveBeenCalledWith(
        'B',
        expect.objectContaining({ duration: expect.any(Number) })
      );
    });

    it('node:dblclick calls window.open with entity URL', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const { ctx, graph } = buildCtx();
      setupGraphEventHandlers(ctx);

      const dblClickHandler = getHandler(graph, 'node:dblclick');
      dblClickHandler?.({ target: { id: 'B' } });

      expect(openSpy).toHaveBeenCalledWith(
        '/test/entity/path',
        '_blank',
        'noopener,noreferrer'
      );

      openSpy.mockRestore();
    });
  });
});
