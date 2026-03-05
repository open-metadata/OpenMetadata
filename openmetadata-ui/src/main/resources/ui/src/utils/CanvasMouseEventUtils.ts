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
import { RefObject } from 'react';
import { Edge } from 'reactflow';
import { CanvasButton } from './CanvasButtonUtils';

interface CanvasMouseEventHandlerRefs {
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
  hoverTimeoutRef: RefObject<NodeJS.Timeout | null>;
  isOverPopoverRef: RefObject<boolean>;
}

export function createCanvasClickHandler(
  refs: CanvasMouseEventHandlerRefs
): (event: Event) => void {
  return (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const container = refs.containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();

    const buttonData = refs.getButtonAtPointRef.current?.(
      mouseEvent.clientX,
      mouseEvent.clientY,
      rect
    );

    if (buttonData && mouseEvent.currentTarget === mouseEvent.target) {
      refs.onEdgeClickRef.current?.(buttonData.edge, mouseEvent);

      return;
    }

    const edge = refs.getEdgeAtPointRef.current?.(
      mouseEvent.clientX,
      mouseEvent.clientY,
      rect
    );

    if (edge && mouseEvent.currentTarget === mouseEvent.target) {
      refs.onEdgeClickRef.current?.(edge, mouseEvent);
    }
  };
}

export function createCanvasMouseMoveHandler(
  refs: CanvasMouseEventHandlerRefs
): (event: Event) => void {
  return (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const container = refs.containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();

    if (refs.hoverTimeoutRef.current) {
      clearTimeout(refs.hoverTimeoutRef.current);
      refs.hoverTimeoutRef.current = null;
    }

    const buttonData = refs.getButtonAtPointRef.current?.(
      mouseEvent.clientX,
      mouseEvent.clientY,
      rect
    );

    if (buttonData) {
      refs.setHoveredButtonRef.current?.(buttonData.button);
      refs.onEdgeHoverRef.current?.(null);

      return;
    }

    if (!refs.isOverPopoverRef.current) {
      refs.hoverTimeoutRef.current = setTimeout(() => {
        refs.setHoveredButtonRef.current?.(null);
      }, 100);
    }

    const edge = refs.getEdgeAtPointRef.current?.(
      mouseEvent.clientX,
      mouseEvent.clientY,
      rect
    );
    refs.onEdgeHoverRef.current?.(edge as Edge);
  };
}

export function createCanvasMouseLeaveHandler(
  refs: CanvasMouseEventHandlerRefs
): () => void {
  return () => {
    if (refs.hoverTimeoutRef.current) {
      clearTimeout(refs.hoverTimeoutRef.current);
      refs.hoverTimeoutRef.current = null;
    }

    if (!refs.isOverPopoverRef.current) {
      refs.onEdgeHoverRef.current?.(null);
      refs.setHoveredButtonRef.current?.(null);
    }
  };
}
