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
import { Theme } from '@mui/material';
import { Edge } from 'reactflow';
import {
  clearEdgeStyleCache,
  computeEdgeStyle,
  invalidateEdgeStyles,
} from './EdgeStyleUtils';

const createMockTheme = (): Theme =>
  ({
    palette: {
      primary: { main: '#1890ff' },
      allShades: {
        indigo: { 600: '#3F51B5' },
        error: { 600: '#F44336' },
      },
    },
  } as unknown as Theme);

const createMockEdge = (
  id: string,
  fromEntityId?: string,
  toEntityId?: string
): Edge => ({
  id,
  source: 'node1',
  target: 'node2',
  data: {
    edge: {
      fromEntity: { id: fromEntityId },
      toEntity: { id: toEntityId },
    },
  },
});

describe('EdgeStyleUtils', () => {
  let theme: Theme;

  beforeEach(() => {
    theme = createMockTheme();
    clearEdgeStyleCache();
  });

  describe('computeEdgeStyle', () => {
    it('returns default style for untraced edge', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style).toEqual({
        stroke: 'rgba(177, 177, 183)',
        opacity: 1,
        strokeWidth: 2,
      });
    });

    it('highlights traced node edges', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set(['entity1', 'entity2']);
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.stroke).toBe(theme.palette.primary.main);
      expect(style.opacity).toBe(1);
    });

    it('dims edges when other edges are traced', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set(['entity3', 'entity4']);
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.opacity).toBe(0.3);
    });

    it('highlights column lineage edges when traced', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set(['col1', 'col2']);
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        true,
        'col1',
        'col2'
      );

      expect(style.stroke).toBe(theme.palette.primary.main);
      expect(style.opacity).toBe(1);
    });

    it('uses indigo color for selected column', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set(['col1', 'col2']);
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        'col1',
        theme,
        true,
        'col1',
        'col2'
      );

      expect(style.stroke).toBe(theme.palette.allShades.indigo[600]);
    });

    it('highlights DQ edges with error color', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set(['edge1']);

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.stroke).toBe(theme.palette.allShades.error[600]);
      expect(style.opacity).toBe(1);
    });

    it('highlights hovered edges', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false,
        undefined,
        undefined,
        true
      );

      expect(style.stroke).toBe(theme.palette.primary.main);
    });

    it('caches edge styles', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      const style2 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1).toBe(style2);
    });

    it('returns different styles for different cache keys', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes1 = new Set<string>();
      const tracedNodes2 = new Set(['entity1', 'entity2']);
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1 = computeEdgeStyle(
        edge,
        tracedNodes1,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      const style2 = computeEdgeStyle(
        edge,
        tracedNodes2,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1).not.toBe(style2);
      expect(style1.stroke).not.toBe(style2.stroke);
    });

    it('handles edges without entity data', () => {
      const edge: Edge = {
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        data: {},
      };
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style).toBeDefined();
      expect(style.stroke).toBe('rgba(177, 177, 183)');
    });

    it('requires both source and target columns for column lineage highlighting', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set(['col1']);
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        true,
        'col1',
        'col3'
      );

      expect(style.opacity).toBe(0.3);
    });

    it('dims edges when columns are traced but edge is not column lineage', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set(['col1', 'col2']);
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.opacity).toBe(0.3);
    });

    it('prioritizes DQ highlighting over other styles', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set(['entity1', 'entity2']);
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set(['edge1']);

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.stroke).toBe(theme.palette.allShades.error[600]);
    });

    it('maintains consistent strokeWidth', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style.strokeWidth).toBe(2);
    });
  });

  describe('clearEdgeStyleCache', () => {
    it('clears all cached styles', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      clearEdgeStyleCache();

      const style2 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1).toEqual(style2);
      expect(style1).not.toBe(style2);
    });
  });

  describe('invalidateEdgeStyles', () => {
    it('invalidates specific edge styles', () => {
      const edge1 = createMockEdge('edge1', 'entity1', 'entity2');
      const edge2 = createMockEdge('edge2', 'entity3', 'entity4');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1a = computeEdgeStyle(
        edge1,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      const style2a = computeEdgeStyle(
        edge2,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      invalidateEdgeStyles(['edge1']);

      const style1b = computeEdgeStyle(
        edge1,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      const style2b = computeEdgeStyle(
        edge2,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1a).not.toBe(style1b);
      expect(style2a).toBe(style2b);
    });

    it('invalidates multiple edge styles', () => {
      const edge1 = createMockEdge('edge1', 'entity1', 'entity2');
      const edge2 = createMockEdge('edge2', 'entity3', 'entity4');
      const edge3 = createMockEdge('edge3', 'entity5', 'entity6');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      computeEdgeStyle(
        edge1,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      computeEdgeStyle(
        edge2,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      const style3a = computeEdgeStyle(
        edge3,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      invalidateEdgeStyles(['edge1', 'edge2']);

      const style3b = computeEdgeStyle(
        edge3,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style3a).toBe(style3b);
    });

    it('handles empty invalidation list', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      invalidateEdgeStyles([]);

      const style2 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1).toBe(style2);
    });

    it('handles invalidation of non-existent edges', () => {
      const edge = createMockEdge('edge1', 'entity1', 'entity2');
      const tracedNodes = new Set<string>();
      const tracedColumns = new Set<string>();
      const dqHighlightedEdges = new Set<string>();

      const style1 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      invalidateEdgeStyles(['edge2', 'edge3']);

      const style2 = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        undefined,
        theme,
        false
      );

      expect(style1).toBe(style2);
    });
  });
});
