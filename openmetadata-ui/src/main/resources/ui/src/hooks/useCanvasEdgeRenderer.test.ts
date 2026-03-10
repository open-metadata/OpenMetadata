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
import { renderHook } from '@testing-library/react';
import { RefObject } from 'react';
import { Edge, Node } from 'reactflow';
import { useCanvasEdgeRenderer } from './useCanvasEdgeRenderer';

const mockGetNode = jest.fn();
const mockUseNodes = jest.fn().mockReturnValue([]);
const mockUseReactFlow = jest.fn().mockReturnValue({ getNode: mockGetNode });
const mockUseViewport = jest.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 });

jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  useNodes: () => mockUseNodes(),
  useReactFlow: () => mockUseReactFlow(),
  useViewport: () => mockUseViewport(),
  Position: {
    Left: 'left',
    Right: 'right',
  },
}));

const mockUseLineageStore = {
  tracedNodes: new Set<string>(),
  tracedColumns: new Set<string>(),
  selectedEdge: undefined,
  selectedColumn: undefined,
  columnsInCurrentPages: new Map<string, string[]>(),
  setIsCanvasReady: jest.fn(),
};

jest.mock('./useLineageStore', () => ({
  useLineageStore: () => mockUseLineageStore,
}));

jest.mock('../utils/CanvasUtils', () => ({
  setupCanvas: jest.fn((canvas) => canvas.getContext('2d')),
  getEdgeCoordinates: jest.fn().mockReturnValue({
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
  }),
  isEdgeInViewport: jest.fn().mockReturnValue(true),
  drawArrowMarker: jest.fn(),
  getBezierEndTangentAngle: jest.fn().mockReturnValue(0),
}));

jest.mock('../utils/EdgeStyleUtils', () => ({
  computeEdgeStyle: jest.fn().mockReturnValue({
    stroke: '#000',
    opacity: 1,
    strokeWidth: 2,
  }),
}));

jest.mock('../utils/EntityLineageUtils', () => ({
  getEdgePathData: jest.fn().mockReturnValue({
    edgePath: 'M 0,0 C 100,0 100,100 200,100',
    edgeCenterX: 100,
    edgeCenterY: 50,
  }),
}));

const createMockCanvas = () => {
  const canvas = document.createElement('canvas');
  const ctx = {
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    stroke: jest.fn(),
    drawImage: jest.fn(),
    setLineDash: jest.fn(),
    isPointInStroke: jest.fn().mockReturnValue(false),
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 2,
    lineCap: 'butt',
    lineJoin: 'miter',
    fillStyle: '',
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
  } as unknown as CanvasRenderingContext2D;

  jest.spyOn(canvas, 'getContext').mockReturnValue(ctx);

  return { canvas, ctx };
};

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

const createMockEdge = (overrides: Partial<Edge> = {}): Edge => ({
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  data: {
    isColumnLineage: false,
  },
  ...overrides,
});

const createMockNode = (id: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { node: {}, isRootNode: false },
  width: 400,
  height: 100,
});

describe('useCanvasEdgeRenderer', () => {
  let canvasRef: RefObject<HTMLCanvasElement>;
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    jest.clearAllMocks();
    const { canvas, ctx } = createMockCanvas();
    mockCanvas = canvas;
    mockCtx = ctx;
    canvasRef = { current: mockCanvas };

    global.requestAnimationFrame = jest.fn((cb) => {
      cb(0);

      return 0;
    });
    global.cancelAnimationFrame = jest.fn();
    global.OffscreenCanvas = jest.fn().mockImplementation(() => ({
      getContext: jest.fn().mockReturnValue({
        lineWidth: 2,
        isPointInStroke: jest.fn().mockReturnValue(false),
      }),
    })) as unknown as typeof OffscreenCanvas;
    global.Path2D = jest.fn().mockImplementation((path?: string) => ({
      path,
    })) as unknown as typeof Path2D;
  });

  it('initializes without errors', () => {
    const { result } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(result.current.redraw).toBeDefined();
    expect(result.current.getEdgeAtPoint).toBeDefined();
  });

  it('schedules redraw when called', () => {
    const { result } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    result.current.redraw();

    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('draws visible edges', () => {
    const edge = createMockEdge();
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('filters edges by viewport visibility', () => {
    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(false);

    const edge = createMockEdge();

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(isEdgeInViewport).toHaveBeenCalled();
  });

  it('includes traced column edges even if outside viewport', () => {
    const edge = createMockEdge({
      data: {
        isColumnLineage: true,
      },
      sourceHandle: 'col1',
      targetHandle: 'col2',
    });

    mockUseLineageStore.tracedColumns = new Set(['col1', 'col2']);

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(false);

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('returns edge at point when hit test succeeds', () => {
    const mockOffscreenCtx = {
      lineWidth: 2,
      isPointInStroke: jest.fn().mockReturnValue(true),
    };

    (global.OffscreenCanvas as jest.Mock).mockImplementation(() => ({
      getContext: jest.fn().mockReturnValue(mockOffscreenCtx),
    }));

    const edge = createMockEdge();
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(true);

    const { result } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    const containerRect = {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as DOMRect;
    const foundEdge = result.current.getEdgeAtPoint(50, 50, containerRect);

    expect(foundEdge).toBe(edge);
  });

  it('returns null when no edge is found at point', () => {
    const edge = createMockEdge();
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    const { result } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    const containerRect = {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as DOMRect;
    const foundEdge = result.current.getEdgeAtPoint(1000, 1000, containerRect);

    expect(foundEdge).toBeNull();
  });

  it('adjusts hit tolerance based on zoom level', () => {
    mockUseViewport.mockReturnValue({ x: 0, y: 0, zoom: 2 });

    const edge = createMockEdge();
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    const mockOffscreenCtx = {
      lineWidth: 2,
      isPointInStroke: jest.fn().mockReturnValue(false),
    };

    (global.OffscreenCanvas as jest.Mock).mockImplementation(() => ({
      getContext: jest.fn().mockReturnValue(mockOffscreenCtx),
    }));

    const { result } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    const containerRect = {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    } as DOMRect;
    result.current.getEdgeAtPoint(50, 50, containerRect);

    expect(mockOffscreenCtx.lineWidth).toBe(6);
  });

  it('handles edges with computedPath', () => {
    const edge = createMockEdge({
      data: {
        isColumnLineage: false,
        computedPath: {
          edgePath: 'M 0,0 C 100,0 100,100 200,100',
          edgeCenterX: 100,
          edgeCenterY: 50,
          sourceX: 0,
          sourceY: 0,
          targetX: 200,
          targetY: 100,
        },
      },
    });

    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(true);

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('cancels animation frame on unmount', () => {
    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = jest.fn(() => 123);

    const { unmount } = renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(123);

    global.requestAnimationFrame = originalRAF;
  });

  it('handles animated edges with dashed lines', () => {
    const edge = createMockEdge({ animated: true });
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'node-1') {
        return node1;
      }
      if (id === 'node-2') {
        return node2;
      }

      return undefined;
    });

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(true);

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        theme: createMockTheme(),
        containerWidth: 800,
        containerHeight: 600,
      })
    );

    expect(mockCtx.setLineDash).toHaveBeenCalledWith([6, 4]);
  });
});
