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
import { isEqual } from 'lodash';
import { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { LayoutDropTarget } from './CustomPropertiesWidget.interface';
import { getLayoutDropIndex } from './CustomPropertiesWidget.utils';
import {
  DragItem,
  UseLayoutItemDragOptions,
} from './useLayoutReorder.interface';

/**
 * Drop state of a reorderable list or grid. The container is the drop zone,
 * so a drop in the gap between items still lands; the order changes only on
 * drop, so items do not reflow under the pointer.
 */
export const useLayoutReorder = (
  dragType: string,
  onMove: (fromIndex: number, toIndex: number) => void
) => {
  const [dropTarget, setDropTarget] = useState<LayoutDropTarget>();
  // The drop can fire before the hover's state update renders (a quick drag),
  // so the drop reads the latest target from a ref, not from state.
  const dropTargetRef = useRef<LayoutDropTarget>();

  const updateDropTarget = (next?: LayoutDropTarget) => {
    dropTargetRef.current = next;
    setDropTarget((current) => (isEqual(current, next) ? current : next));
  };

  const handleHover = (fromIndex: number, target: LayoutDropTarget) =>
    updateDropTarget(
      getLayoutDropIndex(fromIndex, target) === undefined ? undefined : target
    );

  const clearDropTarget = () => updateDropTarget(undefined);

  const [, drop] = useDrop<DragItem>({
    accept: dragType,
    drop: (dragged) => {
      const target = dropTargetRef.current;
      const toIndex = target
        ? getLayoutDropIndex(dragged.index, target)
        : undefined;
      if (toIndex !== undefined) {
        onMove(dragged.index, toIndex);
      }
      clearDropTarget();
    },
  });

  const containerRef = (node: HTMLElement | null) => {
    drop(node);
  };

  return { dropTarget, handleHover, clearDropTarget, containerRef };
};

/** Drag source and hover target of one item; drag starts from `handleRef`. */
export const useLayoutItemDrag = <T extends HTMLElement>({
  dragType,
  index,
  axis,
  isDisabled = false,
  onHover,
  onDragEnd,
}: UseLayoutItemDragOptions) => {
  const itemRef = useRef<T>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: dragType,
    item: { index },
    canDrag: !isDisabled,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: onDragEnd,
  });

  const [, drop] = useDrop<DragItem>({
    accept: dragType,
    hover: (dragged, monitor) => {
      const rect = itemRef.current?.getBoundingClientRect();
      const pointer = monitor.getClientOffset();
      if (!rect || !pointer) {
        return;
      }
      const isBefore =
        axis === 'y'
          ? pointer.y < rect.top + rect.height / 2
          : pointer.x < rect.left + rect.width / 2;
      onHover(dragged.index, { index, side: isBefore ? 'before' : 'after' });
    },
  });

  preview(drop(itemRef));

  const handleRef = (node: HTMLElement | null) => {
    drag(node);
  };

  return { itemRef, handleRef, isDragging };
};
