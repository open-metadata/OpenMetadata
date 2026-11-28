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
import { RefObject, useCallback } from 'react';
import { Edge } from 'reactflow';
import { CanvasButtonHitData } from '../utils/CanvasButtonUtils';

interface UseCanvasMouseEventsProps {
  containerRef: RefObject<HTMLDivElement>;
  getEdgeAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => Edge | null) | null
  >;
  getButtonAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => CanvasButtonHitData | null) | null
  >;
  onButtonHover: (hit: CanvasButtonHitData | null) => void;
  onEdgeClickRef: RefObject<
    ((edge: Edge, event: MouseEvent) => void) | undefined
  >;
  onEdgeHoverRef: RefObject<((edge: Edge | null) => void) | undefined>;
}

export function useCanvasMouseEvents({
  containerRef,
  getEdgeAtPointRef,
  getButtonAtPointRef,
  onButtonHover,
  onEdgeClickRef,
  onEdgeHoverRef,
}: UseCanvasMouseEventsProps) {
  const handleClick = useCallback(
    (mouseEvent: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();

      const buttonData = getButtonAtPointRef.current?.(
        mouseEvent.clientX,
        mouseEvent.clientY,
        rect
      );

      // The pane click also reaches ReactFlow's onPaneClick, which clears the
      // selection the edge click just made; stop it once an edge is hit.
      if (buttonData && mouseEvent.currentTarget === mouseEvent.target) {
        mouseEvent.stopPropagation();
        onEdgeClickRef.current?.(buttonData.edge, mouseEvent);

        return;
      }

      const edge = getEdgeAtPointRef.current?.(
        mouseEvent.clientX,
        mouseEvent.clientY,
        rect
      );

      if (edge && mouseEvent.currentTarget === mouseEvent.target) {
        mouseEvent.stopPropagation();
        onEdgeClickRef.current?.(edge, mouseEvent);
      }
    },
    [containerRef, getButtonAtPointRef, getEdgeAtPointRef, onEdgeClickRef]
  );

  const handlePointerLeave = useCallback(() => {
    onButtonHover(null);
    onEdgeHoverRef.current?.(null);
  }, [onButtonHover, onEdgeHoverRef]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons) {
        handlePointerLeave();

        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const hit =
        getButtonAtPointRef.current?.(event.clientX, event.clientY, rect) ??
        null;
      onButtonHover(hit);

      const edge = hit
        ? null
        : getEdgeAtPointRef.current?.(event.clientX, event.clientY, rect);
      onEdgeHoverRef.current?.(edge ?? null);
    },
    [
      containerRef,
      getButtonAtPointRef,
      getEdgeAtPointRef,
      handlePointerLeave,
      onButtonHover,
      onEdgeHoverRef,
    ]
  );

  return {
    handleClick,
    handlePointerMove,
    handlePointerLeave,
  };
}
