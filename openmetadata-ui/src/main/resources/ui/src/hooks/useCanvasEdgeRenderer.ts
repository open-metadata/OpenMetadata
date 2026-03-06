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
import { RefObject, useCallback, useEffect, useRef } from 'react';
import { Edge, Position, useNodes, useReactFlow, useViewport } from 'reactflow';
import {
  drawArrowMarker,
  getBezierEndTangentAngle,
  getEdgeCoordinates,
  isEdgeInViewport,
  setupCanvas,
} from '../utils/CanvasUtils';
import { computeEdgeStyle } from '../utils/EdgeStyleUtils';
import { getEdgePathData } from '../utils/EntityLineageUtils';
import { useLineageStore } from './useLineageStore';

interface UseCanvasEdgeRendererProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  edges: Edge[];
  hoverEdge?: Edge | null;
  dqHighlightedEdges: Set<string>;
  theme: Theme;
  containerWidth: number;
  containerHeight: number;
}

interface EdgeHitEntry {
  edge: Edge;
  path: Path2D;
}

export function useCanvasEdgeRenderer({
  canvasRef,
  dqHighlightedEdges,
  edges,
  hoverEdge,
  theme,
  containerWidth,
  containerHeight,
}: UseCanvasEdgeRendererProps) {
  const rafIdRef = useRef<number>();
  const isDirtyRef = useRef(false);
  const visibleEdgesRef = useRef<Edge[]>([]);
  // Stores the Path2D for each visible edge so mouse-move hit testing can use
  // isPointInStroke instead of pixel read-back, which is unreliable due to
  // anti-aliasing and color-profile transformations on macOS.
  const edgeHitPathsRef = useRef<EdgeHitEntry[]>([]);
  // A temporary off-screen canvas used solely for isPointInStroke calls.
  // Path2D.isPointInStroke requires a CanvasRenderingContext2D to resolve
  // the current lineWidth and transform, so we keep one around.
  const hitTestCtxRef = useRef<CanvasRenderingContext2D | null>(null);

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
  } = useLineageStore();

  const viewport = useViewport();

  const drawEdge = useCallback(
    (ctx: CanvasRenderingContext2D, edge: Edge): Path2D | null => {
      const computedPath = edge.data?.computedPath;

      if (!computedPath) {
        const coords = getEdgeCoordinates(
          edge,
          getNode(edge.source),
          getNode(edge.target),
          columnsInCurrentPages
        );
        if (!coords) {
          return null;
        }

        const pathData = getEdgePathData(edge.source, edge.target, {
          sourceX: coords.sourceX,
          sourceY: coords.sourceY,
          targetX: coords.targetX,
          targetY: coords.targetY,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });

        const style = computeEdgeStyle(
          edge,
          tracedNodes,
          tracedColumns,
          dqHighlightedEdges,
          selectedColumn,
          theme,
          edge.data?.isColumnLineage ?? false,
          edge.sourceHandle,
          edge.targetHandle,
          edge.id === hoverEdge?.id || selectedEdge?.id === edge.id
        );

        ctx.strokeStyle = style.stroke;
        ctx.globalAlpha = style.opacity;
        ctx.lineWidth = style.strokeWidth;
        ctx.setLineDash(edge.animated ? [6, 4] : []);

        const path = new Path2D(pathData.edgePath);
        ctx.stroke(path);

        ctx.globalAlpha = 1;
        ctx.setLineDash([]);

        const angle = getBezierEndTangentAngle(
          pathData.edgePath,
          coords.sourceX,
          coords.sourceY,
          coords.targetX,
          coords.targetY
        );
        drawArrowMarker(
          ctx,
          coords.targetX,
          coords.targetY,
          angle,
          style.stroke
        );

        return path;
      }

      const pathData = computedPath;

      const style = computeEdgeStyle(
        edge,
        tracedNodes,
        tracedColumns,
        dqHighlightedEdges,
        selectedColumn,
        theme,
        edge.data?.isColumnLineage ?? false,
        edge.sourceHandle,
        edge.targetHandle,
        edge.id === hoverEdge?.id || selectedEdge?.id === edge.id
      );

      ctx.strokeStyle = style.stroke;
      ctx.globalAlpha = style.opacity;
      ctx.lineWidth = style.strokeWidth;
      ctx.setLineDash(edge.animated ? [6, 4] : []);

      const path = new Path2D(pathData.edgePath);
      ctx.stroke(path);

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      if (pathData.sourceX && pathData.targetX) {
        const angle = getBezierEndTangentAngle(
          pathData.edgePath,
          pathData.sourceX,
          pathData.sourceY,
          pathData.targetX,
          pathData.targetY
        );
        drawArrowMarker(
          ctx,
          pathData.targetX,
          pathData.targetY,
          angle,
          style.stroke
        );
      }

      return path;
    },
    [
      nodes,
      tracedNodes,
      tracedColumns,
      dqHighlightedEdges,
      selectedColumn,
      theme,
      columnsInCurrentPages,
      hoverEdge,
      selectedEdge,
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
        isEdgeTraced(edge, tracedColumns) ||
        isEdgeInViewport(
          edge,
          getNode(edge.source),
          getNode(edge.target),
          viewport,
          containerWidth,
          containerHeight,
          columnsInCurrentPages
        )
    );

    visibleEdgesRef.current = visibleEdges;

    const hitPaths: EdgeHitEntry[] = [];

    visibleEdges.forEach((edge) => {
      ctx.save();
      const path = drawEdge(ctx, edge);
      ctx.restore();

      if (path) {
        hitPaths.push({ edge, path });
      }
    });

    edgeHitPathsRef.current = hitPaths;

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
  ]);

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

      // Use a hit tolerance that gives a comfortable target regardless of zoom.
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
    theme,
  ]);

  useEffect(() => {
    if (isRepositioning) {
      clearCanvas();
    }
  }, [isRepositioning, clearCanvas]);

  return { redraw: scheduleRedraw, visibleEdgesRef, getEdgeAtPoint };
}
