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
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';
import { useNodes, useReactFlow, useViewport } from 'reactflow';
import { useTheme } from '../../../context/UntitledUIThemeProvider/theme-provider';
import { useCanvasEdgeRenderer } from '../../../hooks/useCanvasEdgeRenderer';
import { useCanvasMouseEvents } from '../../../hooks/useCanvasMouseEvents';
import { useLineageEdgeColors } from '../../../hooks/useLineageEdgeColors';
import { useLineageStore } from '../../../hooks/useLineageStore';
import {
  CanvasButtonHitData,
  CanvasPipelinePreview,
  getCanvasPipelinePreview,
  isSameCanvasButtonPosition,
} from '../../../utils/CanvasButtonUtils';
import { calculateEdgeMidpoints } from '../../../utils/EdgeMidpointUtils';
import { clearEdgeStyleCache } from '../../../utils/EdgeStyleUtils';
import { isPlaywrightEnv } from '../../../utils/PlaywrightUtils';
import { getAbsolutePosition } from '../../../utils/ViewportUtils';
import { CanvasButtonPopover } from './CanvasButtonPopover.component';

export interface CanvasEdgeRendererProps {
  dqHighlightedEdges: Set<string>;
  hoverEdge: Edge | null;
  edges?: Edge[];
  nodes?: Node[];
  pathHighlightedEdgeIds?: Set<string>;
  isPathHighlightActive?: boolean;
  onEdgeClick?: (edge: Edge, event: MouseEvent) => void;
  onEdgeHover?: (edge: Edge | null) => void;
}

interface PipelineAnchor {
  preview: CanvasPipelinePreview;
  isHovered: boolean;
}

export const CanvasEdgeRenderer: React.FC<CanvasEdgeRendererProps> = ({
  dqHighlightedEdges,
  edges: edgesOverride,
  nodes: nodesOverride,
  pathHighlightedEdgeIds,
  isPathHighlightActive,
  onEdgeClick,
  onEdgeHover,
  hoverEdge,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const edgeColors = useLineageEdgeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pipelineAnchor, setPipelineAnchor] = useState<PipelineAnchor>();
  const { columnsInCurrentPages, isCanvasReady, tracedNodes, tracedColumns } =
    useLineageStore();
  const providerEdges = useLineageStore((s) => s.edges);
  const providerNodes = useLineageStore((s) => s.nodes);
  const edges = edgesOverride ?? providerEdges;
  const nodes = nodesOverride ?? providerNodes;
  const { getNode } = useReactFlow();
  const flowNodes = useNodes();
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

  const onButtonHover = useCallback((hit: CanvasButtonHitData | null) => {
    setHoveredButtonRef.current?.(hit?.button ?? null);

    const preview = hit ? getCanvasPipelinePreview(hit) : undefined;
    setPipelineAnchor((anchor) => {
      if (!preview) {
        return anchor?.isHovered ? { ...anchor, isHovered: false } : anchor;
      }
      if (
        anchor?.isHovered &&
        anchor.preview.key === preview.key &&
        anchor.preview.executionStatus === preview.executionStatus &&
        isSameCanvasButtonPosition(anchor.preview.button, preview.button)
      ) {
        return anchor;
      }

      return { preview, isHovered: true };
    });
  }, []);

  const onButtonsDrawn = useCallback((buttons: CanvasButtonHitData[]) => {
    setPipelineAnchor((anchor) => {
      if (!anchor) {
        return anchor;
      }
      const hit = buttons.find(
        ({ button }) => button.edgeId === anchor.preview.button.edgeId
      );
      const preview = hit ? getCanvasPipelinePreview(hit) : undefined;

      // If the canvas moves the icon, the old hit no longer owns the portal.
      if (
        !preview ||
        anchor.preview.key !== preview.key ||
        !isSameCanvasButtonPosition(anchor.preview.button, preview.button)
      ) {
        return undefined;
      }

      return anchor.preview.executionStatus === preview.executionStatus
        ? anchor
        : { ...anchor, preview };
    });
  }, []);

  const { redraw, getEdgeAtPoint, getButtonAtPoint, setHoveredButton } =
    useCanvasEdgeRenderer({
      canvasRef,
      edges,
      dqHighlightedEdges,
      colors: edgeColors,
      hoverEdge,
      pathHighlightedEdgeIds,
      isPathHighlightActive,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      theme,
      onButtonsDrawn,
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

  useLayoutEffect(() => {
    setPipelineAnchor(undefined);
    setHoveredButtonRef.current?.(null);
  }, [
    viewport.x,
    viewport.y,
    viewport.zoom,
    containerSize.width,
    containerSize.height,
  ]);

  const isPlaywright = useMemo(() => isPlaywrightEnv(), []);

  const edgeMidpoints = useMemo(() => {
    if (!isPlaywright || !isCanvasReady) {
      return [];
    }

    return calculateEdgeMidpoints(
      edges,
      getNode,
      columnsInCurrentPages,
      tracedNodes,
      tracedColumns
    );
    // `nodes` and `flowNodes` are recompute triggers: getNode is identity-stable,
    // and only React Flow's nodes change while a drag is in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPlaywright,
    edges,
    nodes,
    flowNodes,
    getNode,
    columnsInCurrentPages,
    isCanvasReady,
    tracedNodes,
    tracedColumns,
  ]);

  const anchorKey = pipelineAnchor?.preview.key;
  const releaseAnchor = useCallback(() => {
    setPipelineAnchor((anchor) =>
      anchor && anchor.preview.key === anchorKey && !anchor.isHovered
        ? undefined
        : anchor
    );
  }, [anchorKey]);

  const { handleClick, handlePointerMove, handlePointerLeave } =
    useCanvasMouseEvents({
      containerRef,
      getEdgeAtPointRef,
      getButtonAtPointRef,
      onButtonHover,
      onEdgeClickRef,
      onEdgeHoverRef,
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

    const pane = flowWrapper.querySelector<HTMLElement>('.react-flow__pane');
    if (!pane) {
      return;
    }

    pane.addEventListener('click', handleClick);
    pane.addEventListener('pointermove', handlePointerMove);
    pane.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      pane.removeEventListener('click', handleClick);
      pane.removeEventListener('pointermove', handlePointerMove);
      pane.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [handleClick, handlePointerMove, handlePointerLeave]);

  return (
    <div
      className="lineage-canvas-container"
      ref={containerRef}
      style={{ pointerEvents: 'none' }}>
      <canvas
        aria-hidden
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {edgeMidpoints.map((midpoint) =>
        midpoint?.dataTestId ? (
          <button
            aria-label={t('label.edge')}
            data-edge-state={midpoint.visualState}
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
      {pipelineAnchor && (
        <CanvasButtonPopover
          isHovered={pipelineAnchor.isHovered}
          key={pipelineAnchor.preview.key}
          preview={pipelineAnchor.preview}
          viewport={viewport}
          onCloseComplete={releaseAnchor}
        />
      )}
    </div>
  );
};
