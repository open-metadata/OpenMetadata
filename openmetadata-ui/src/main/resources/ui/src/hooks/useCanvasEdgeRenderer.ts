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
import {
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Edge } from 'reactflow';
import { Position, useNodes, useReactFlow, useViewport } from 'reactflow';
import {
  CanvasButton,
  createCanvasButton,
  drawCanvasButton,
  ECanvasButtonType,
  isPointInButton,
} from '../utils/CanvasButtonUtils';
import {
  drawArrowMarker,
  getBezierEndTangentAngle,
  getEdgeCoordinates,
  isEdgeInViewport,
  setupCanvas,
} from '../utils/CanvasUtils';
import {
  computeEdgeStyle,
  computeEdgeVisualState,
  LineageEdgeColors,
} from '../utils/EdgeStyleUtils';
import { getEdgePathData } from '../utils/EntityLineageEdgeUtils';
import { getEntityName } from '../utils/EntityNameUtils';
import { useLineageStore } from './useLineageStore';

interface UseCanvasEdgeRendererProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  edges: Edge[];
  hoverEdge?: Edge | null;
  dqHighlightedEdges: Set<string>;
  pathHighlightedEdgeIds?: Set<string>;
  isPathHighlightActive?: boolean;
  colors: LineageEdgeColors;
  containerWidth: number;
  containerHeight: number;
}

interface EdgeHitEntry {
  edge: Edge;
  path: Path2D;
}

interface CanvasEdgePath {
  edgePath: string;
  edgeCenterX: number;
  edgeCenterY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  path: Path2D;
}

export interface CanvasButtonHitData {
  button: CanvasButton;
  edge: Edge;
}

const getCanvasEdgePath = (
  edge: Edge,
  getNode: ReturnType<typeof useReactFlow>['getNode'],
  columnsInCurrentPages: Parameters<typeof getEdgeCoordinates>[3]
): CanvasEdgePath | undefined => {
  const computedPath: Omit<CanvasEdgePath, 'path'> | undefined =
    edge.data?.computedPath;
  if (computedPath) {
    return { ...computedPath, path: new Path2D(computedPath.edgePath) };
  }
  const coords = getEdgeCoordinates(
    edge,
    getNode(edge.source),
    getNode(edge.target),
    columnsInCurrentPages
  );
  if (!coords) {
    return undefined;
  }
  const pathData = getEdgePathData(edge.source, edge.target, {
    ...coords,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  return { ...coords, ...pathData, path: new Path2D(pathData.edgePath) };
};

const getRollupWeight = (edge: Edge): number => {
  const weight = Number(edge.data?.weight ?? 1);

  return edge.data?.isRollup && Number.isFinite(weight) && weight > 1
    ? weight
    : 1;
};

const getRollupLabel = (edge: Edge, weight: number): string | undefined =>
  edge.data?.label ?? (weight > 1 ? String(weight) : undefined);

const drawEdgeArrow = (
  ctx: CanvasRenderingContext2D,
  pathData: CanvasEdgePath,
  stroke: string
) => {
  if (pathData.sourceX === undefined || pathData.targetX === undefined) {
    return;
  }
  const angle = getBezierEndTangentAngle(
    pathData.edgePath,
    pathData.sourceX,
    pathData.sourceY,
    pathData.targetX,
    pathData.targetY
  );
  drawArrowMarker(ctx, pathData.targetX, pathData.targetY, angle, stroke);
};

const getPathPaint = (
  style: ReturnType<typeof computeEdgeStyle>,
  weight: number,
  colors: LineageEdgeColors,
  isPathHighlightActive: boolean,
  isPathHighlighted: boolean
) => {
  const strokeWidth =
    weight > 1
      ? Math.max(
          style.strokeWidth,
          Math.min(7, style.strokeWidth + Math.log2(weight + 1))
        )
      : style.strokeWidth;
  if (!isPathHighlightActive) {
    return { ...style, strokeWidth };
  }

  return isPathHighlighted
    ? {
        ...style,
        stroke: colors.primary,
        strokeWidth: Math.max(strokeWidth + 1, 3),
      }
    : { ...style, strokeWidth, opacity: Math.min(style.opacity, 0.16) };
};

const drawRollupLabel = (
  ctx: CanvasRenderingContext2D,
  pathData: CanvasEdgePath,
  label: string,
  colors: LineageEdgeColors,
  stroke: string,
  opacity: number
) => {
  const paddingX = 6;
  const labelHeight = 18;
  ctx.save();
  ctx.font = '600 11px Inter, sans-serif';
  const labelWidth = ctx.measureText(label).width + paddingX * 2;
  const x = pathData.edgeCenterX - labelWidth / 2;
  const y = pathData.edgeCenterY - labelHeight / 2;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = colors.labelBackground;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, labelWidth, labelHeight, 9);
  } else {
    ctx.rect(x, y, labelWidth, labelHeight);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.labelText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pathData.edgeCenterX, pathData.edgeCenterY);
  ctx.restore();
};

const getEdgeButtonFlags = (edgeData: Edge['data']) => {
  const {
    isColumnLineage,
    edge: edgeDetails,
    columnFunctionValue,
    isExpanded,
  } = edgeData ?? {};

  return {
    hasPipeline: Boolean(
      !isColumnLineage &&
        edgeDetails?.pipeline &&
        getEntityName(edgeDetails.pipeline)
    ),
    hasFunction: Boolean(!isColumnLineage && columnFunctionValue && isExpanded),
  };
};

const getCanvasButtonHit = (
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  edgePathCacheRef: MutableRefObject<WeakMap<Edge, CanvasEdgePath>>,
  hoveredButtonRef: MutableRefObject<CanvasButton | null>,
  isDQEnabled: boolean
): CanvasButtonHitData | null => {
  const edgeData = edge.data ?? {};
  const { hasPipeline, hasFunction } = getEdgeButtonFlags(edgeData);

  if (!hasPipeline && !hasFunction) {
    return null;
  }

  const cachedPathData = edgePathCacheRef.current.get(edge);

  if (!cachedPathData) {
    return null;
  }

  const button = createCanvasButton(
    cachedPathData.edgeCenterX,
    cachedPathData.edgeCenterY,
    edge.id,
    hasPipeline ? ECanvasButtonType.Pipeline : ECanvasButtonType.Function,
    edgeData.edge?.pipeline?.pipelineStatus?.executionStatus,
    edgeData.isPipelineRootNode
  );

  const isButtonHovered =
    hoveredButtonRef.current?.edgeId === edge.id &&
    hoveredButtonRef.current?.type === button.type;

  ctx.save();
  drawCanvasButton(ctx, button, isButtonHovered, isDQEnabled);
  ctx.restore();

  return { button, edge };
};

export function useCanvasEdgeRenderer({
  canvasRef,
  dqHighlightedEdges,
  edges,
  hoverEdge,
  pathHighlightedEdgeIds,
  isPathHighlightActive = false,
  colors,
  containerWidth,
  containerHeight,
}: UseCanvasEdgeRendererProps) {
  const rafIdRef = useRef<number>();
  const isDirtyRef = useRef(false);
  const visibleEdgesRef = useRef<Edge[]>([]);
  const edgeHitPathsRef = useRef<EdgeHitEntry[]>([]);
  const canvasButtonsRef = useRef<CanvasButtonHitData[]>([]);
  const hoveredButtonRef = useRef<CanvasButton | null>(null);
  const [hoveredButton, setHoveredButton] = useState<CanvasButton | null>(null);
  const hitTestCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const edgePathCacheRef = useRef(new WeakMap<Edge, CanvasEdgePath>());

  const { getNode } = useReactFlow();
  const nodes = useNodes();

  const {
    tracedNodes,
    tracedColumns,
    selectedEdge,
    selectedColumn,
    columnsInCurrentPages,
    isRepositioning,
    setIsCanvasReady,
    isEditMode,
    isDQEnabled,
  } = useLineageStore();

  const viewport = useViewport();

  const drawEdge = useCallback(
    (ctx: CanvasRenderingContext2D, edge: Edge): Path2D | null => {
      let pathData = edgePathCacheRef.current.get(edge);

      if (!pathData) {
        pathData = getCanvasEdgePath(edge, getNode, columnsInCurrentPages);
      }

      if (!pathData) {
        return null;
      }
      edgePathCacheRef.current.set(edge, pathData);

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        selectedColumn,
        colors,
        edge.data?.isColumnLineage ?? false,
        edge.sourceHandle,
        edge.targetHandle,
        edge.id === hoverEdge?.id || selectedEdge?.id === edge.id
      );
      const weight = getRollupWeight(edge);
      const isPathHighlighted = pathHighlightedEdgeIds?.has(edge.id) ?? false;
      const paint = getPathPaint(
        style,
        weight,
        colors,
        isPathHighlightActive,
        isPathHighlighted
      );

      ctx.strokeStyle = paint.stroke;
      ctx.globalAlpha = paint.opacity;
      ctx.lineWidth = paint.strokeWidth;
      ctx.setLineDash(edge.animated ? [6, 4] : []);

      const { path } = pathData;
      ctx.stroke(path);

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      drawEdgeArrow(ctx, pathData, paint.stroke);

      const rollupLabel = getRollupLabel(edge, weight);

      if (rollupLabel) {
        const opacity = isPathHighlightActive && !isPathHighlighted ? 0.28 : 1;
        drawRollupLabel(
          ctx,
          pathData,
          String(rollupLabel),
          colors,
          paint.stroke,
          opacity
        );
      }

      return path;
    },
    [
      getNode,
      tracedNodes,
      tracedColumns,
      dqHighlightedEdges,
      selectedColumn,
      colors,
      columnsInCurrentPages,
      hoverEdge,
      selectedEdge,
      pathHighlightedEdgeIds,
      isPathHighlightActive,
    ]
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || !containerWidth || !containerHeight) {
      return;
    }

    const ctx = setupCanvas(canvas, containerWidth, containerHeight);
    ctx.clearRect(0, 0, containerWidth, containerHeight);
  }, [canvasRef, containerWidth, containerHeight]);

  const isCanvasReadyRef = useRef(false);

  const drawAllEdges = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || !containerWidth || !containerHeight) {
      return;
    }

    const ctx = setupCanvas(canvas, containerWidth, containerHeight);

    ctx.clearRect(0, 0, containerWidth, containerHeight);

    if (isRepositioning) {
      edgePathCacheRef.current = new WeakMap();
      visibleEdgesRef.current = [];
      edgeHitPathsRef.current = [];
      canvasButtonsRef.current = [];

      if (isCanvasReadyRef.current) {
        isCanvasReadyRef.current = false;
        setIsCanvasReady(false);
      }

      return;
    }

    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    const isEdgeTraced = (edge: Edge, tracedColumns: Set<string>) => {
      return (
        edge.data?.isColumnLineage &&
        (tracedColumns.has(edge.sourceHandle ?? '') ||
          tracedColumns.has(edge.targetHandle ?? ''))
      );
    };

    const visibleEdges = edges.filter(
      (edge) =>
        computeEdgeVisualState(edge, tracedNodes, tracedColumns) !== 'hidden' &&
        (isEdgeTraced(edge, tracedColumns) ||
          isEdgeInViewport(
            edge,
            getNode(edge.source),
            getNode(edge.target),
            viewport,
            containerWidth,
            containerHeight,
            columnsInCurrentPages
          ))
    );

    visibleEdgesRef.current = visibleEdges;

    const hitPaths: EdgeHitEntry[] = [];
    const canvasButtons: CanvasButtonHitData[] = [];

    visibleEdges.forEach((edge) => {
      ctx.save();
      const path = drawEdge(ctx, edge);
      ctx.restore();

      if (path) {
        hitPaths.push({ edge, path });
      }

      const buttonHit = getCanvasButtonHit(
        ctx,
        edge,
        edgePathCacheRef,
        hoveredButtonRef,
        isDQEnabled
      );

      if (buttonHit) {
        canvasButtons.push(buttonHit);
      }
    });

    edgeHitPathsRef.current = hitPaths;
    canvasButtonsRef.current = canvasButtons;

    ctx.restore();

    if (!isCanvasReadyRef.current) {
      isCanvasReadyRef.current = true;
      setIsCanvasReady(true);
    }
  }, [
    canvasRef,
    edges,
    nodes,
    viewport,
    containerWidth,
    containerHeight,
    drawEdge,
    tracedColumns,
    tracedNodes,
    columnsInCurrentPages,
    isRepositioning,
    setIsCanvasReady,
    isDQEnabled,
    isEditMode,
    getNode,
  ]);

  const getButtonAtPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      containerRect: DOMRect
    ): CanvasButtonHitData | null => {
      const x = (clientX - containerRect.left - viewport.x) / viewport.zoom;
      const y = (clientY - containerRect.top - viewport.y) / viewport.zoom;

      for (const buttonData of canvasButtonsRef.current) {
        if (isPointInButton(x, y, buttonData.button)) {
          return buttonData;
        }
      }

      return null;
    },
    [viewport]
  );

  const getEdgeAtPoint = useCallback(
    (clientX: number, clientY: number, containerRect: DOMRect): Edge | null => {
      // Convert screen coordinates to flow-space (same coordinate space the
      // paths were drawn in, before the viewport transform was applied).
      const x = (clientX - containerRect.left - viewport.x) / viewport.zoom;
      const y = (clientY - containerRect.top - viewport.y) / viewport.zoom;

      // Ensure we have a scratch canvas context for isPointInStroke.
      if (!hitTestCtxRef.current) {
        const offscreen = new OffscreenCanvas(1, 1);
        hitTestCtxRef.current = offscreen.getContext(
          '2d'
        ) as unknown as CanvasRenderingContext2D;
      }

      const ctx = hitTestCtxRef.current;
      if (!ctx) {
        return null;
      }

      const hitLineWidth = 12 / viewport.zoom;
      ctx.lineWidth = hitLineWidth;

      for (const { edge, path } of edgeHitPathsRef.current) {
        if (ctx.isPointInStroke(path, x, y)) {
          return edge;
        }
      }

      return null;
    },
    [viewport]
  );

  const drawAllEdgesRef = useRef(drawAllEdges);
  drawAllEdgesRef.current = drawAllEdges;

  const scheduleRedraw = useCallback(() => {
    if (isDirtyRef.current) {
      return;
    }

    isDirtyRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      drawAllEdgesRef.current();
      isDirtyRef.current = false;
    });
  }, []);

  const onSetHoveredButton = useCallback((button: CanvasButton | null) => {
    if (
      hoveredButtonRef.current?.edgeId !== button?.edgeId ||
      hoveredButtonRef.current?.type !== button?.type
    ) {
      hoveredButtonRef.current = button;
      setHoveredButton(button);
    }
  }, []);

  useEffect(() => {
    edgePathCacheRef.current = new WeakMap();
  }, [edges, nodes, columnsInCurrentPages, isRepositioning]);

  useEffect(() => {
    scheduleRedraw();

    return () => {
      if (rafIdRef.current) {
        isDirtyRef.current = false;
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [
    edges,
    nodes,
    viewport,
    containerWidth,
    containerHeight,
    tracedColumns,
    tracedNodes,
    columnsInCurrentPages,
    isRepositioning,
    hoverEdge,
    selectedEdge,
    selectedColumn,
    dqHighlightedEdges,
    pathHighlightedEdgeIds,
    isPathHighlightActive,
    colors,
    hoveredButton,
    isDQEnabled,
    isEditMode,
    scheduleRedraw,
  ]);

  useEffect(() => {
    if (isRepositioning) {
      clearCanvas();
    }
  }, [isRepositioning, clearCanvas]);

  return {
    redraw: scheduleRedraw,
    visibleEdgesRef,
    getEdgeAtPoint,
    getButtonAtPoint,
    setHoveredButton: onSetHoveredButton,
    hoveredButton,
  };
}
