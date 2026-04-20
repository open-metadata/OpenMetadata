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
import { MutableRefObject, RefObject, useCallback } from 'react';
import { Edge } from 'reactflow';
import { CanvasButton } from '../utils/CanvasButtonUtils';

interface UseCanvasMouseEventsProps {
  containerRef: RefObject<HTMLDivElement>;
  getEdgeAtPointRef: RefObject<
    ((x: number, y: number, rect: DOMRect) => Edge | null) | null
  >;
  getButtonAtPointRef: RefObject<
    | ((
        x: number,
        y: number,
        rect: DOMRect
      ) => {
        button: CanvasButton;
        edge: Edge;
      } | null)
    | null
  >;
  setHoveredButtonRef: RefObject<
    ((button: CanvasButton | null) => void) | null
  >;
  onEdgeClickRef: RefObject<
    ((edge: Edge, event: MouseEvent) => void) | undefined
  >;
  onEdgeHoverRef: RefObject<((edge: Edge | null) => void) | undefined>;
  hoverTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  isOverPopoverRef: MutableRefObject<boolean>;
}

export function useCanvasMouseEvents({
  containerRef,
  getEdgeAtPointRef,
  getButtonAtPointRef,
  setHoveredButtonRef,
  onEdgeClickRef,
  onEdgeHoverRef,
  hoverTimeoutRef,
  isOverPopoverRef,
}: UseCanvasMouseEventsProps) {
  const handleClick = useCallback(
    (event: Event) => {
      const mouseEvent = event as MouseEvent;
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

      if (buttonData && mouseEvent.currentTarget === mouseEvent.target) {
        onEdgeClickRef.current?.(buttonData.edge, mouseEvent);

        return;
      }

      const edge = getEdgeAtPointRef.current?.(
        mouseEvent.clientX,
        mouseEvent.clientY,
        rect
      );

      if (edge && mouseEvent.currentTarget === mouseEvent.target) {
        onEdgeClickRef.current?.(edge, mouseEvent);
      }
    },
    [containerRef, getButtonAtPointRef, getEdgeAtPointRef, onEdgeClickRef]
  );

  const handleMouseMove = useCallback(
    (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

      const buttonData = getButtonAtPointRef.current?.(
        mouseEvent.clientX,
        mouseEvent.clientY,
        rect
      );

      if (buttonData) {
        setHoveredButtonRef.current?.(buttonData.button);
        onEdgeHoverRef.current?.(null);

        return;
      }

      if (!isOverPopoverRef.current) {
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredButtonRef.current?.(null);
        }, 100);
      }

      const edge = getEdgeAtPointRef.current?.(
        mouseEvent.clientX,
        mouseEvent.clientY,
        rect
      );
      onEdgeHoverRef.current?.(edge as Edge);
    },
    [
      containerRef,
      getButtonAtPointRef,
      setHoveredButtonRef,
      onEdgeHoverRef,
      getEdgeAtPointRef,
      hoverTimeoutRef,
      isOverPopoverRef,
    ]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (!isOverPopoverRef.current) {
      onEdgeHoverRef.current?.(null);
      setHoveredButtonRef.current?.(null);
    }
  }, [hoverTimeoutRef, isOverPopoverRef, onEdgeHoverRef, setHoveredButtonRef]);

  return {
    handleClick,
    handleMouseMove,
    handleMouseLeave,
  };
}
