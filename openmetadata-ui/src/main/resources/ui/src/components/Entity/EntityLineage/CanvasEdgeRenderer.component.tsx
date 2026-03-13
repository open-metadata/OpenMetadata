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
import { useTheme } from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edge, useReactFlow, useViewport } from 'reactflow';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { useCanvasEdgeRenderer } from '../../../hooks/useCanvasEdgeRenderer';
import { useCanvasMouseEvents } from '../../../hooks/useCanvasMouseEvents';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { ECanvasButtonType } from '../../../utils/CanvasButtonUtils';
import { calculateEdgeMidpoints } from '../../../utils/EdgeMidpointUtils';
import { clearEdgeStyleCache } from '../../../utils/EdgeStyleUtils';
import { isPlaywrightEnv } from '../../../utils/PlaywrightUtils';
import { getAbsolutePosition } from '../../../utils/ViewportUtils';
import { CanvasButtonPopover } from './CanvasButtonPopover.component';

export interface CanvasEdgeRendererProps {
  dqHighlightedEdges: Set<string>;
  hoverEdge: Edge | null;
  onEdgeClick?: (edge: Edge, event: MouseEvent) => void;
  onEdgeHover?: (edge: Edge | null) => void;
}

export const CanvasEdgeRenderer: React.FC<CanvasEdgeRendererProps> = ({
  dqHighlightedEdges,
  onEdgeClick,
  onEdgeHover,
  hoverEdge,
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const { isEditMode, columnsInCurrentPages, isCanvasReady } =
    useLineageStore();
  const { edges } = useLineageProvider();
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  // Keep stable refs for callbacks and getEdgeAtPoint so the pane event listener effect
  // doesn't re-run on every render.
  const onEdgeClickRef = useRef(onEdgeClick);
  const onEdgeHoverRef = useRef(onEdgeHover);
  const getEdgeAtPointRef = useRef<
    ((x: number, y: number, rect: DOMRect) => Edge | null) | null
  >(null);
  const getButtonAtPointRef = useRef<typeof getButtonAtPoint | null>(null);
  const setHoveredButtonRef = useRef<typeof setHoveredButton | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOverPopoverRef = useRef(false);

  useEffect(() => {
    onEdgeClickRef.current = onEdgeClick;
  }, [onEdgeClick]);

  useEffect(() => {
    onEdgeHoverRef.current = onEdgeHover;
  }, [onEdgeHover]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearEdgeStyleCache();
    };
  }, []);

  const {
    redraw,
    getEdgeAtPoint,
    getButtonAtPoint,
    setHoveredButton,
    hoveredButton,
  } = useCanvasEdgeRenderer({
    canvasRef,
    edges,
    dqHighlightedEdges,
    theme,
    hoverEdge,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
  });

  useEffect(() => {
    getEdgeAtPointRef.current = getEdgeAtPoint;
  }, [getEdgeAtPoint]);

  useEffect(() => {
    getButtonAtPointRef.current = getButtonAtPoint;
  }, [getButtonAtPoint]);

  useEffect(() => {
    setHoveredButtonRef.current = setHoveredButton;
  }, [setHoveredButton]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const isPlaywright = useMemo(() => isPlaywrightEnv(), []);

  const edgeMidpoints = useMemo(() => {
    if (!isPlaywright || !isCanvasReady) {
      return [];
    }

    return calculateEdgeMidpoints(edges, getNode, columnsInCurrentPages);
  }, [isPlaywright, edges, getNode, columnsInCurrentPages, isCanvasReady]);

  const hoveredEdge = useMemo(() => {
    if (!hoveredButton) {
      return null;
    }

    return edges.find((edge) => edge.id === hoveredButton.edgeId);
  }, [hoveredButton, edges]);

  const { handleClick, handleMouseMove, handleMouseLeave } =
    useCanvasMouseEvents({
      containerRef,
      getEdgeAtPointRef,
      getButtonAtPointRef,
      setHoveredButtonRef,
      onEdgeClickRef,
      onEdgeHoverRef,
      hoverTimeoutRef,
      isOverPopoverRef,
    });

  // Attach listeners to the ReactFlow pane element — it sits on top of the
  // canvas and captures all pointer events before they reach us.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // The pane is a sibling rendered by ReactFlow inside the same wrapper.
    // Walk up to the ReactFlow root and find the pane from there.
    const flowWrapper = container.closest('.react-flow');
    if (!flowWrapper) {
      return;
    }

    const pane = flowWrapper.querySelector('.react-flow__pane');
    if (!pane) {
      return;
    }

    pane.addEventListener('click', handleClick);
    pane.addEventListener('mousemove', handleMouseMove);
    pane.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      pane.removeEventListener('click', handleClick);
      pane.removeEventListener('mousemove', handleMouseMove);
      pane.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isEditMode, handleClick, handleMouseMove, handleMouseLeave]);

  return (
    <div
      className="lineage-canvas-container"
      ref={containerRef}
      style={{ pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {edgeMidpoints.map((midpoint) =>
        midpoint?.dataTestId ? (
          <button
            data-testid={midpoint.dataTestId}
            key={midpoint.id}
            style={{
              ...getAbsolutePosition(
                midpoint.canvasX,
                midpoint.canvasY,
                viewport
              ),
              width: '20px',
              height: '20px',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              pointerEvents: 'all',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (midpoint.edge && onEdgeClickRef.current) {
                onEdgeClickRef.current(midpoint.edge, e.nativeEvent);
              }
            }}
          />
        ) : null
      )}
      {hoveredButton?.type === ECanvasButtonType.Pipeline &&
        hoveredEdge &&
        !isEditMode && (
          <CanvasButtonPopover
            hoverTimeoutRef={hoverTimeoutRef}
            hoveredButton={hoveredButton}
            hoveredEdge={hoveredEdge}
            isOverPopoverRef={isOverPopoverRef}
            viewport={viewport}
            onMouseLeave={() => {
              isOverPopoverRef.current = false;
              setHoveredButton(null);
              onEdgeHoverRef.current?.(null);
            }}
          />
        )}
    </div>
  );
};
