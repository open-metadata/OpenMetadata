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
import { useCallback, useRef, useState } from 'react';
import type { ItemCallback, Layout } from 'react-grid-layout';
import {
  GRID_VERTICAL_MARGIN,
  TAB_GRID_MAX_COLUMNS,
} from '../../constants/CustomizeWidgets.constants';
import type { WidgetConfig } from '../../interface/customization.interface';
import {
  FULL_PANEL_WIDTH,
  getColumnLockedDragHandlers,
  getGridRowAt,
  HALF_PANEL_WIDTH,
} from '../../utils/CustomizePage/GridLayoutDragUtils';

export type CrossPanelDrop =
  // Into the left panel: the drop point in its flow layout, and the width the
  // widget takes there.
  | { kind: 'in'; widget: WidgetConfig; row: number; x: number; w: number }
  // Out of the left panel, into the column beside it.
  | { kind: 'out'; widget: WidgetConfig; row: number };

// Where a drag would drop across the left panel's edge, while it is dragged.
export type CrossPanelDropTarget = 'panel' | 'beside';

// Side-panel widgets stay in their column and only reorder vertically.
const COLUMN_LOCKED_DRAG_HANDLERS =
  getColumnLockedDragHandlers(TAB_GRID_MAX_COLUMNS);

const getPointerTarget = (
  { clientX, clientY }: MouseEvent,
  panel: DOMRect
): CrossPanelDropTarget | null => {
  if (clientX > panel.right) {
    return 'beside';
  }
  const isOverPanel =
    clientX >= panel.left && clientY >= panel.top && clientY <= panel.bottom;

  return isOverPanel ? 'panel' : null;
};

// react-grid-layout applies the layout it hands to onDragStop, so taking the
// widget out of that array in place keeps it out of the grid it was dragged from.
const removeLayoutItemInPlace = (layout: Layout[], widgetId: string) => {
  const index = layout.findIndex(({ i }) => i === widgetId);
  if (index !== -1) {
    layout.splice(index, 1);
  }
};

interface UseLeftPanelCrossDropProps {
  leftPanelWidget?: WidgetConfig;
  tabLayout: WidgetConfig[];
  // Called when the panel's only widget is dropped beside the panel and stays.
  onLastPanelWidgetKept: () => void;
}

/**
 * Moves widgets between the tab grid and the left panel's nested grid, which
 * react-grid-layout cannot drag across on its own.
 *
 * Ordering contract: react-grid-layout calls a grid's onDragStop and then, in
 * the same call and before React re-renders, its onLayoutChange with the
 * layout onDragStop was handed. The drag-stop handlers take the dropped widget
 * out of that layout and leave the drop for the grid's layout handler, which
 * takes it with `takeDrop` and commits the move with the layout change in one
 * update. `takeDrop` clears the drop whichever handler takes it, so a drop
 * that is not applied cannot leak into a later, unrelated layout change.
 *
 * Both directions are hit-tested with the pointer against the panel's box.
 * Rows map one to one between the grids, which share row height and margin;
 * the panel's grid starts one margin of padding below the panel's top, so a
 * drop into it takes that off and a drop out of it does not.
 */
export const useLeftPanelCrossDrop = ({
  leftPanelWidget,
  tabLayout,
  onLastPanelWidgetKept,
}: UseLeftPanelCrossDropProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<CrossPanelDrop | null>(null);
  const [dropTarget, setDropTarget] = useState<CrossPanelDropTarget | null>(
    null
  );

  const takeDrop = useCallback(() => {
    const drop = dropRef.current;
    dropRef.current = null;

    return drop;
  }, []);

  const handleTabDrag = useCallback<ItemCallback>((...args) => {
    COLUMN_LOCKED_DRAG_HANDLERS.onDrag(...args);
    const panel = panelRef.current?.getBoundingClientRect();
    const isOverPanel = panel && getPointerTarget(args[4], panel) === 'panel';
    setDropTarget(isOverPanel ? 'panel' : null);
  }, []);

  // A side widget dropped over the panel moves into it at the drop point.
  const handleTabDragStop = useCallback<ItemCallback>(
    (layout, oldItem, newItem, placeholder, event, element) => {
      setDropTarget(null);
      const panel = panelRef.current?.getBoundingClientRect();
      const widget = tabLayout.find(({ i }) => i === newItem.i);
      const isDropIntoPanel =
        panel && widget && getPointerTarget(event, panel) === 'panel';
      if (!isDropIntoPanel || !leftPanelWidget) {
        COLUMN_LOCKED_DRAG_HANDLERS.onDragStop(
          layout,
          oldItem,
          newItem,
          placeholder,
          event,
          element
        );

        return;
      }

      const isFromSideColumn =
        widget.x >= leftPanelWidget.x + leftPanelWidget.w;
      removeLayoutItemInPlace(layout, newItem.i);
      dropRef.current = {
        kind: 'in',
        widget,
        row: getGridRowAt(event.clientY - panel.top - GRID_VERTICAL_MARGIN),
        x: event.clientX < panel.left + panel.width / 2 ? 0 : HALF_PANEL_WIDTH,
        // A side widget keeps its square shape as half the panel; a main-area
        // widget spans it.
        w: isFromSideColumn ? HALF_PANEL_WIDTH : FULL_PANEL_WIDTH,
      };
    },
    [leftPanelWidget, tabLayout]
  );

  const handlePanelDrag = useCallback<ItemCallback>((...args) => {
    const panel = panelRef.current?.getBoundingClientRect();
    const isBesidePanel =
      panel && getPointerTarget(args[4], panel) === 'beside';
    setDropTarget(isBesidePanel ? 'beside' : null);
  }, []);

  // A panel widget dropped right of the panel moves into the side column. The
  // panel keeps at least one widget.
  const handlePanelDragStop = useCallback<ItemCallback>(
    (layout, _oldItem, newItem, _placeholder, event) => {
      setDropTarget(null);
      const panel = panelRef.current?.getBoundingClientRect();
      const widget = leftPanelWidget?.children?.find(
        ({ i }) => i === newItem.i
      );
      if (!panel || !leftPanelWidget || !widget) {
        return;
      }
      if (getPointerTarget(event, panel) !== 'beside') {
        return;
      }
      if (layout.length === 1) {
        onLastPanelWidgetKept();

        return;
      }

      removeLayoutItemInPlace(layout, newItem.i);
      dropRef.current = {
        kind: 'out',
        widget,
        row: leftPanelWidget.y + getGridRowAt(event.clientY - panel.top),
      };
    },
    [leftPanelWidget, onLastPanelWidgetKept]
  );

  return {
    panelRef,
    dropTarget,
    takeDrop,
    handleTabDrag,
    handleTabDragStop,
    handlePanelDrag,
    handlePanelDragStop,
  };
};
