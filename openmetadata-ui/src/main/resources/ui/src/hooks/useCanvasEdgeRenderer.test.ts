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
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import type { Edge, Node } from 'reactflow';
import type { LineageEdgeColors } from '../utils/EdgeStyleUtils';
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
  isRepositioning: false,
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
  computeEdgeVisualState: jest.fn().mockReturnValue('default'),
}));

jest.mock('../utils/EntityLineageEdgeUtils', () => ({
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
    rect: jest.fn(),
    roundRect: jest.fn(),
    measureText: jest.fn().mockReturnValue({ width: 12 }),
    fillText: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
  } as unknown as CanvasRenderingContext2D;

  jest.spyOn(canvas, 'getContext').mockReturnValue(ctx);

  return { canvas, ctx };
};

const createMockColors = (): LineageEdgeColors => ({
  primary: '#1890ff',
  columnHighlight: '#3F51B5',
  dqHighlight: '#F44336',
  labelBackground: '#FFFFFF',
  labelText: '#475467',
});

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
    mockUseLineageStore.isRepositioning = false;
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
      })
    );

    result.current.redraw();

    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  it('schedules a redraw when the active theme changes', () => {
    const colors = createMockColors();
    const dqHighlightedEdges = new Set<string>();
    const edges: Edge[] = [];
    const initialProps: { theme: 'light' | 'dark' } = { theme: 'light' };
    const { rerender } = renderHook(
      ({ theme }: { theme: 'light' | 'dark' }) =>
        useCanvasEdgeRenderer({
          canvasRef,
          colors,
          containerHeight: 600,
          containerWidth: 800,
          dqHighlightedEdges,
          edges,
          theme,
        }),
      { initialProps }
    );
    const initialRedrawCount = (requestAnimationFrame as jest.Mock).mock.calls
      .length;

    rerender({ theme: 'dark' });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(initialRedrawCount + 1);
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
      })
    );

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('uses the base stroke width for invalid rollup weights', () => {
    const edge = createMockEdge({
      data: {
        isColumnLineage: false,
        isRollup: true,
        weight: -2,
      },
    });
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) =>
      id === 'node-1' ? node1 : node2
    );

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(true);

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
      })
    );

    expect(mockCtx.lineWidth).toBe(2);
  });

  it('uses a rectangular label background when roundRect is unavailable', () => {
    const edge = createMockEdge({
      data: {
        isColumnLineage: false,
        isRollup: true,
        weight: 2,
      },
    });
    const node1 = createMockNode('node-1');
    const node2 = createMockNode('node-2');

    mockGetNode.mockImplementation((id: string) =>
      id === 'node-1' ? node1 : node2
    );
    Object.defineProperty(mockCtx, 'roundRect', {
      configurable: true,
      value: undefined,
    });

    const { isEdgeInViewport } = require('../utils/CanvasUtils');
    isEdgeInViewport.mockReturnValue(true);

    renderHook(() =>
      useCanvasEdgeRenderer({
        canvasRef,
        edges: [edge],
        dqHighlightedEdges: new Set(),
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
      })
    );

    expect(mockCtx.rect).toHaveBeenCalled();
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
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
        colors: createMockColors(),
        containerWidth: 800,
        containerHeight: 600,
        theme: 'light',
      })
    );

    expect(mockCtx.setLineDash).toHaveBeenCalledWith([6, 4]);
  });

  it('reuses drawn paths for visual changes and rebuilds changed geometry', () => {
    const path = {
      edgePath: 'M 0,0 C 100,0 100,100 200,100',
      edgeCenterX: 100,
      edgeCenterY: 50,
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 100,
    };
    const edge = createMockEdge({ data: { computedPath: path } });
    const props: Parameters<typeof useCanvasEdgeRenderer>[0] = {
      canvasRef,
      edges: [edge],
      dqHighlightedEdges: new Set<string>(),
      colors: createMockColors(),
      containerWidth: 800,
      containerHeight: 600,
      theme: 'light',
      isPathHighlightActive: false,
      pathHighlightedEdgeIds: new Set([edge.id]),
    };
    const { rerender } = renderHook(useCanvasEdgeRenderer, {
      initialProps: props,
    });
    const initialPath = (mockCtx.stroke as jest.Mock).mock.calls[0][0];
    mockUseViewport.mockReturnValue({ x: 25, y: 50, zoom: 1.5 });
    rerender(props);
    rerender({ ...props, isPathHighlightActive: true });

    expect(mockCtx.stroke).toHaveBeenLastCalledWith(initialPath);
    expect(mockCtx.strokeStyle).toBe(props.colors.primary);
    expect(Path2D).toHaveBeenCalledTimes(1);

    const strokeCount = (mockCtx.stroke as jest.Mock).mock.calls.length;
    rerender({ ...props, isPathHighlightActive: true, theme: 'dark' });

    expect(mockCtx.stroke).toHaveBeenCalledTimes(strokeCount + 1);
    expect(mockCtx.stroke).toHaveBeenLastCalledWith(initialPath);
    expect(Path2D).toHaveBeenCalledTimes(1);

    const movedPath = 'M 0,0 C 150,0 150,100 300,100';
    rerender({
      ...props,
      edges: [
        {
          ...edge,
          data: {
            computedPath: { ...path, edgePath: movedPath, targetX: 300 },
          },
        },
      ],
    });

    expect(Path2D).toHaveBeenLastCalledWith(movedPath);
    expect(Path2D).toHaveBeenCalledTimes(2);
    expect(mockCtx.stroke).not.toHaveBeenLastCalledWith(initialPath);
  });

  it('does not hit-test invisible edges while the graph is repositioning', () => {
    global.OffscreenCanvas = jest.fn().mockImplementation(() => ({
      getContext: () => ({ isPointInStroke: () => true }),
    })) as unknown as typeof OffscreenCanvas;
    const edge = createMockEdge();
    const props: Parameters<typeof useCanvasEdgeRenderer>[0] = {
      canvasRef,
      edges: [edge],
      dqHighlightedEdges: new Set<string>(),
      colors: createMockColors(),
      containerWidth: 800,
      containerHeight: 600,
      theme: 'light',
    };
    const { result, rerender } = renderHook(useCanvasEdgeRenderer, {
      initialProps: props,
    });
    const rect = new DOMRect(0, 0, 800, 600);

    expect(result.current.getEdgeAtPoint(50, 50, rect)).toBe(edge);

    mockUseLineageStore.isRepositioning = true;
    rerender(props);

    expect(result.current.visibleEdgesRef.current).toEqual([]);
    expect(result.current.getEdgeAtPoint(50, 50, rect)).toBeNull();
  });
});
