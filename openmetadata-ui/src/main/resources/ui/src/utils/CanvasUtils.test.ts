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
import { Edge, Node, Viewport } from 'reactflow';
import {
  BoundingBox,
  boundsIntersect,
  drawArrowMarker,
  getBezierEndTangentAngle,
  getEdgeAngle,
  getEdgeBounds,
  getEdgeCoordinates,
  getNodeHeight,
  getViewportBounds,
  hasSignificantViewportChange,
  inverseTransformPoint,
  isEdgeInViewport,
  setupCanvas,
  transformPoint,
} from './CanvasUtils';

const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = {
    scale: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;

  jest.spyOn(canvas, 'getContext').mockReturnValue(ctx);

  return canvas;
};

const createMockNode = (
  id: string,
  columns?: number,
  isRootNode = false
): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {
    node: { columns: columns ? Array(columns).fill({}) : [] },
    isRootNode,
  },
  width: 400,
  height: 100,
});

const createMockEdge = (
  id: string,
  source: string,
  target: string,
  isColumnLineage = false
): Edge => ({
  id,
  source,
  target,
  data: { isColumnLineage },
});

describe('CanvasUtils', () => {
  describe('setupCanvas', () => {
    it('sets up canvas with correct dimensions', () => {
      const canvas = createMockCanvas();
      const width = 800;
      const height = 600;

      setupCanvas(canvas, width, height);

      expect(canvas.width).toBe(width * window.devicePixelRatio);
      expect(canvas.height).toBe(height * window.devicePixelRatio);
      expect(canvas.style.width).toBe(`${width}px`);
      expect(canvas.style.height).toBe(`${height}px`);
    });

    it('scales context by device pixel ratio', () => {
      const canvas = createMockCanvas();
      const ctx = setupCanvas(canvas, 800, 600);

      expect(ctx.scale).toHaveBeenCalledWith(
        window.devicePixelRatio,
        window.devicePixelRatio
      );
    });

    it('throws error when canvas context is not available', () => {
      const canvas = document.createElement('canvas');
      jest.spyOn(canvas, 'getContext').mockReturnValue(null);

      expect(() => setupCanvas(canvas, 800, 600)).toThrow(
        'Could not get 2D context from canvas'
      );
    });

    it('accepts willReadFrequently parameter', () => {
      const canvas = createMockCanvas();
      const getContextSpy = jest.spyOn(canvas, 'getContext');

      setupCanvas(canvas, 800, 600, true);

      expect(getContextSpy).toHaveBeenCalledWith('2d', {
        willReadFrequently: true,
      });
    });
  });

  describe('getNodeHeight', () => {
    it('returns base height for node without columns', () => {
      const node = createMockNode('node1', 0);

      expect(getNodeHeight(node, false)).toBe(66);
    });

    it('returns increased height for node with columns', () => {
      const node = createMockNode('node1', 5);

      expect(getNodeHeight(node, true, 5)).toBe(286.25);
    });

    it('adds extra height for root node', () => {
      const node = createMockNode('node1', 0, true);

      expect(getNodeHeight(node, false)).toBe(76);
    });

    it('combines column and root node height adjustments', () => {
      const node = createMockNode('node1', 5, true);

      expect(getNodeHeight(node, true, 5)).toBe(296.25);
    });
  });

  describe('getEdgeCoordinates', () => {
    describe('validation', () => {
      it('returns null when source node is missing', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2');
        const targetNode = createMockNode('node2');

        const result = getEdgeCoordinates(edge, undefined, targetNode);

        expect(result).toBeNull();
      });

      it('returns null when target node is missing', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2');
        const sourceNode = createMockNode('node1');

        const result = getEdgeCoordinates(edge, sourceNode, undefined);

        expect(result).toBeNull();
      });

      it('returns null when source node width is missing', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2');
        const sourceNode = createMockNode('node1');
        const targetNode = createMockNode('node2');
        sourceNode.width = undefined;

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).toBeNull();
      });

      it('returns null when source node height is missing', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2');
        const sourceNode = createMockNode('node1');
        const targetNode = createMockNode('node2');
        sourceNode.height = undefined;

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).toBeNull();
      });

      it('returns null when target node dimensions are missing', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2');
        const sourceNode = createMockNode('node1');
        const targetNode = createMockNode('node2');
        targetNode.width = undefined;

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).toBeNull();
      });
    });

    describe('entity lineage', () => {
      it('calculates coordinates for node-level lineage', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', false);
        const sourceNode = createMockNode('node1');
        sourceNode.position = { x: 0, y: 0 };
        const targetNode = createMockNode('node2');
        targetNode.position = { x: 500, y: 0 };

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).toEqual({
          sourceX: 400,
          sourceY: 33,
          targetX: 490,
          targetY: 33,
        });
      });

      it('calculates coordinates at different positions', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', false);
        const sourceNode = createMockNode('node1');
        sourceNode.position = { x: 100, y: 200 };
        const targetNode = createMockNode('node2');
        targetNode.position = { x: 600, y: 300 };

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).not.toBeNull();
        expect(result?.sourceX).toBe(500);
        expect(result?.sourceY).toBe(233);
        expect(result?.targetX).toBe(590);
        expect(result?.targetY).toBe(333);
      });
    });

    describe('column lineage', () => {
      const createNodeWithFlattenColumns = (
        id: string,
        columnCount: number
      ): Node => {
        const node = createMockNode(id, columnCount);
        node.data.node.flattenColumns = Array(columnCount).fill({});

        return node;
      };

      it('calculates coordinates for column-level lineage', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        edge.sourceHandle = 'col1';
        edge.targetHandle = 'col2';

        const sourceNode = createNodeWithFlattenColumns('node1', 5);
        sourceNode.position = { x: 0, y: 0 };
        const targetNode = createNodeWithFlattenColumns('node2', 5);
        targetNode.position = { x: 500, y: 0 };

        const columnsInCurrentPages = new Map([
          ['node1', ['col1', 'col2']],
          ['node2', ['col1', 'col2']],
        ]);

        const result = getEdgeCoordinates(
          edge,
          sourceNode,
          targetNode,
          columnsInCurrentPages
        );

        expect(result).not.toBeNull();
        expect(result?.sourceX).toBe(400);
        expect(result?.targetX).toBe(500);
      });

      it('returns null when source handle not in current page', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        edge.sourceHandle = 'col1';
        edge.targetHandle = 'col2';

        const sourceNode = createNodeWithFlattenColumns('node1', 5);
        const targetNode = createNodeWithFlattenColumns('node2', 5);

        const columnsInCurrentPages = new Map([
          ['node1', ['col3']],
          ['node2', ['col2']],
        ]);

        const result = getEdgeCoordinates(
          edge,
          sourceNode,
          targetNode,
          columnsInCurrentPages
        );

        expect(result).toBeNull();
      });

      it('returns null when target handle not in current page', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        edge.sourceHandle = 'col1';
        edge.targetHandle = 'col2';

        const sourceNode = createNodeWithFlattenColumns('node1', 5);
        const targetNode = createNodeWithFlattenColumns('node2', 5);

        const columnsInCurrentPages = new Map([
          ['node1', ['col1']],
          ['node2', ['col4']],
        ]);

        const result = getEdgeCoordinates(
          edge,
          sourceNode,
          targetNode,
          columnsInCurrentPages
        );

        expect(result).toBeNull();
      });

      it('returns null when both handles not in current page', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        edge.sourceHandle = 'col1';
        edge.targetHandle = 'col2';

        const sourceNode = createNodeWithFlattenColumns('node1', 5);
        const targetNode = createNodeWithFlattenColumns('node2', 5);

        const columnsInCurrentPages = new Map([
          ['node1', ['col3']],
          ['node2', ['col4']],
        ]);

        const result = getEdgeCoordinates(
          edge,
          sourceNode,
          targetNode,
          columnsInCurrentPages
        );

        expect(result).toBeNull();
      });

      it('handles column at different indices correctly', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        edge.sourceHandle = 'col3';
        edge.targetHandle = 'col2';

        const sourceNode = createNodeWithFlattenColumns('node1', 5);
        sourceNode.position = { x: 0, y: 0 };
        const targetNode = createNodeWithFlattenColumns('node2', 5);
        targetNode.position = { x: 500, y: 0 };

        const columnsInCurrentPages = new Map([
          ['node1', ['col1', 'col2', 'col3']],
          ['node2', ['col1', 'col2', 'col3']],
        ]);

        const result = getEdgeCoordinates(
          edge,
          sourceNode,
          targetNode,
          columnsInCurrentPages
        );

        expect(result).not.toBeNull();
        expect(result?.sourceX).toBe(400);
        expect(result?.targetX).toBe(500);
      });

      it('falls back to entity lineage when columnsInCurrentPages not provided', () => {
        const edge = createMockEdge('edge1', 'node1', 'node2', true);
        const sourceNode = createMockNode('node1', 5);
        sourceNode.position = { x: 0, y: 0 };
        const targetNode = createMockNode('node2', 5);
        targetNode.position = { x: 500, y: 0 };

        const result = getEdgeCoordinates(edge, sourceNode, targetNode);

        expect(result).not.toBeNull();
        expect(result?.sourceX).toBe(400);
        expect(result?.targetX).toBe(490);
      });
    });
  });

  describe('getEdgeBounds', () => {
    it('returns null when edge coordinates cannot be calculated', () => {
      const edge = createMockEdge('edge1', 'node1', 'node2');

      const result = getEdgeBounds(edge, undefined, undefined);

      expect(result).toBeNull();
    });

    it('calculates bounds with padding', () => {
      const edge = createMockEdge('edge1', 'node1', 'node2', false);
      const sourceNode = createMockNode('node1');
      sourceNode.position = { x: 0, y: 0 };
      const targetNode = createMockNode('node2');
      targetNode.position = { x: 500, y: 100 };

      const result = getEdgeBounds(edge, sourceNode, targetNode);

      expect(result).not.toBeNull();
      expect(result!.minX).toBeLessThan(351);
      expect(result!.maxX).toBeGreaterThan(500);
      expect(result!.minY).toBeLessThan(0);
      expect(result!.maxY).toBeGreaterThan(100);
    });
  });

  describe('getViewportBounds', () => {
    it('calculates viewport bounds from viewport transform', () => {
      const viewport: Viewport = { x: 100, y: 50, zoom: 1 };

      const result = getViewportBounds(viewport, 800, 600);

      expect(result).toEqual({
        minX: -100,
        maxX: 700,
        minY: -50,
        maxY: 550,
      });
    });

    it('accounts for zoom level', () => {
      const viewport: Viewport = { x: 0, y: 0, zoom: 2 };

      const result = getViewportBounds(viewport, 800, 600);

      expect(result).toEqual({
        minX: -0,
        maxX: 400,
        minY: -0,
        maxY: 300,
      });
    });
  });

  describe('boundsIntersect', () => {
    it('returns true for overlapping bounds', () => {
      const a: BoundingBox = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      const b: BoundingBox = { minX: 50, maxX: 150, minY: 50, maxY: 150 };

      expect(boundsIntersect(a, b)).toBe(true);
    });

    it('returns false for non-overlapping bounds', () => {
      const a: BoundingBox = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      const b: BoundingBox = { minX: 200, maxX: 300, minY: 200, maxY: 300 };

      expect(boundsIntersect(a, b)).toBe(false);
    });

    it('returns true for touching bounds', () => {
      const a: BoundingBox = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      const b: BoundingBox = { minX: 100, maxX: 200, minY: 100, maxY: 200 };

      expect(boundsIntersect(a, b)).toBe(true);
    });

    it('returns true when one bound contains another', () => {
      const a: BoundingBox = { minX: 0, maxX: 200, minY: 0, maxY: 200 };
      const b: BoundingBox = { minX: 50, maxX: 150, minY: 50, maxY: 150 };

      expect(boundsIntersect(a, b)).toBe(true);
    });
  });

  describe('isEdgeInViewport', () => {
    it('returns false when edge bounds cannot be calculated', () => {
      const edge = createMockEdge('edge1', 'node1', 'node2');
      const viewport: Viewport = { x: 0, y: 0, zoom: 1 };

      const result = isEdgeInViewport(
        edge,
        undefined,
        undefined,
        viewport,
        800,
        600,
        new Map()
      );

      expect(result).toBe(false);
    });

    it('returns true when edge is in viewport', () => {
      const edge = createMockEdge('edge1', 'node1', 'node2', false);
      const sourceNode = createMockNode('node1');
      sourceNode.position = { x: 100, y: 100 };
      const targetNode = createMockNode('node2');
      targetNode.position = { x: 300, y: 100 };
      const viewport: Viewport = { x: 0, y: 0, zoom: 1 };

      const result = isEdgeInViewport(
        edge,
        sourceNode,
        targetNode,
        viewport,
        800,
        600,
        new Map()
      );

      expect(result).toBe(true);
    });

    it('returns false for column lineage when handles not in current page', () => {
      const edge = createMockEdge('edge1', 'node1', 'node2', true);
      edge.sourceHandle = 'col1';
      edge.targetHandle = 'col2';

      const sourceNode = createMockNode('node1', 5);
      sourceNode.position = { x: 100, y: 100 };
      const targetNode = createMockNode('node2', 5);
      targetNode.position = { x: 300, y: 100 };
      const viewport: Viewport = { x: 0, y: 0, zoom: 1 };

      const columnsInCurrentPages = new Map([
        ['node1', ['col3']],
        ['node2', ['col4']],
      ]);

      const result = isEdgeInViewport(
        edge,
        sourceNode,
        targetNode,
        viewport,
        800,
        600,
        columnsInCurrentPages
      );

      expect(result).toBe(false);
    });
  });

  describe('hasSignificantViewportChange', () => {
    it('returns false for minimal changes', () => {
      const current: Viewport = { x: 100, y: 100, zoom: 1 };
      const previous: Viewport = { x: 100.05, y: 100.05, zoom: 1 };

      expect(hasSignificantViewportChange(current, previous)).toBe(false);
    });

    it('returns true for significant position change', () => {
      const current: Viewport = { x: 100, y: 100, zoom: 1 };
      const previous: Viewport = { x: 120, y: 100, zoom: 1 };

      expect(hasSignificantViewportChange(current, previous)).toBe(true);
    });

    it('returns true for significant zoom change', () => {
      const current: Viewport = { x: 100, y: 100, zoom: 1.5 };
      const previous: Viewport = { x: 100, y: 100, zoom: 1 };

      expect(hasSignificantViewportChange(current, previous)).toBe(true);
    });

    it('uses custom threshold', () => {
      const current: Viewport = { x: 100, y: 100, zoom: 1 };
      const previous: Viewport = { x: 105, y: 100, zoom: 1 };

      expect(hasSignificantViewportChange(current, previous, 10)).toBe(false);
      expect(hasSignificantViewportChange(current, previous, 1)).toBe(true);
    });
  });

  describe('transformPoint', () => {
    it('transforms point from canvas to screen coordinates', () => {
      const viewport: Viewport = { x: 50, y: 50, zoom: 2 };

      const result = transformPoint(100, 100, viewport);

      expect(result).toEqual({ x: 250, y: 250 });
    });

    it('handles negative viewport offset', () => {
      const viewport: Viewport = { x: -50, y: -50, zoom: 1 };

      const result = transformPoint(100, 100, viewport);

      expect(result).toEqual({ x: 50, y: 50 });
    });
  });

  describe('inverseTransformPoint', () => {
    it('transforms point from screen to canvas coordinates', () => {
      const viewport: Viewport = { x: 50, y: 50, zoom: 2 };

      const result = inverseTransformPoint(250, 250, viewport);

      expect(result).toEqual({ x: 100, y: 100 });
    });

    it('handles negative viewport offset', () => {
      const viewport: Viewport = { x: -50, y: -50, zoom: 1 };

      const result = inverseTransformPoint(50, 50, viewport);

      expect(result).toEqual({ x: 100, y: 100 });
    });
  });

  describe('drawArrowMarker', () => {
    it('draws arrow with correct transformations', () => {
      const canvas = createMockCanvas();
      const ctx = canvas.getContext('2d')!;

      drawArrowMarker(ctx, 100, 100, Math.PI / 4, '#000000');

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.translate).toHaveBeenCalledWith(100, 100);
      expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('uses correct color', () => {
      const canvas = createMockCanvas();
      const ctx = canvas.getContext('2d')!;

      drawArrowMarker(ctx, 100, 100, 0, '#ff0000');

      expect(ctx.strokeStyle).toBe('#ff0000');
      expect(ctx.fillStyle).toBe('#ff0000');
    });
  });

  describe('getEdgeAngle', () => {
    it('calculates angle for horizontal edge', () => {
      const angle = getEdgeAngle(0, 0, 100, 0);

      expect(angle).toBe(0);
    });

    it('calculates angle for vertical edge', () => {
      const angle = getEdgeAngle(0, 0, 0, 100);

      expect(angle).toBe(Math.PI / 2);
    });

    it('calculates angle for diagonal edge', () => {
      const angle = getEdgeAngle(0, 0, 100, 100);

      expect(angle).toBeCloseTo(Math.PI / 4);
    });

    it('calculates negative angle', () => {
      const angle = getEdgeAngle(100, 100, 0, 0);

      expect(angle).toBeCloseTo((-3 * Math.PI) / 4);
    });
  });

  describe('getBezierEndTangentAngle', () => {
    it('extracts tangent from cubic bezier path', () => {
      const pathString = 'M 0,0 C 50,0 50,100 100,100';

      const angle = getBezierEndTangentAngle(pathString, 0, 0, 100, 100);

      expect(angle).toBeDefined();
      expect(typeof angle).toBe('number');
    });

    it('falls back to chord angle for invalid path', () => {
      const pathString = 'M 0,0 L 100,100';

      const angle = getBezierEndTangentAngle(pathString, 0, 0, 100, 100);

      expect(angle).toBeCloseTo(Math.PI / 4);
    });

    it('handles degenerate bezier', () => {
      const pathString = 'M 0,0 C 100,100 100,100 100,100';

      const angle = getBezierEndTangentAngle(pathString, 0, 0, 100, 100);

      expect(angle).toBeCloseTo(Math.PI / 4);
    });

    it('handles multiple bezier segments', () => {
      const pathString = 'M 0,0 C 25,0 25,25 50,50 C 75,75 75,100 100,100';

      const angle = getBezierEndTangentAngle(pathString, 0, 0, 100, 100);

      expect(angle).toBeDefined();
    });
  });
});
