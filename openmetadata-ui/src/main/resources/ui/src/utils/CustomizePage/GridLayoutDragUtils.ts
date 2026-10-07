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
import { ItemCallback, Layout, utils } from 'react-grid-layout';
import {
  GRID_ROW_HEIGHT,
  GRID_VERTICAL_MARGIN,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import type { WidgetConfig } from '../../interface/customization.interface';

/**
 * Drag callbacks for react-grid-layout that keep a widget in the column it
 * started in, so dragging only reorders it vertically.
 *
 * RGL snaps the item to whichever column the pointer is over, which leaves
 * side-panel widgets stranded between columns. It lets these callbacks mutate
 * the layout it is about to apply: `onDrag` gets the live layout and
 * `onDragStop` the final one, so the column is restored in place and the
 * other items re-flow around it.
 */
export const getColumnLockedDragHandlers = (cols: number) => {
  const lockToStartColumn: ItemCallback = (
    layout: Layout[],
    oldItem: Layout,
    newItem: Layout,
    placeholder: Layout
  ) => {
    const item = layout.find(({ i }) => i === newItem.i);
    if (!item || item.x === oldItem.x) {
      return;
    }

    // moveElement pushes whatever now collides out of the item's way, so the
    // item keeps the slot it was dropped into.
    utils.moveElement(
      layout,
      item,
      oldItem.x,
      item.y,
      true,
      false,
      'vertical',
      cols
    );
    newItem.x = oldItem.x;
    if (placeholder) {
      placeholder.x = oldItem.x;
    }

    utils.compact(layout, 'vertical', cols).forEach((settled) => {
      const target = layout.find(({ i }) => i === settled.i);
      if (target) {
        target.x = settled.x;
        target.y = settled.y;
      }
    });
  };

  return { onDrag: lockToStartColumn, onDragStop: lockToStartColumn };
};

/**
 * `layout` where react-grid-layout draws it: in bounds and compacted upward.
 *
 * RGL lays out stored positions on mount without reporting the result, so a
 * stored layout can still hold positions it never drew, such as an item past
 * the last column or a gap above an item.
 */
const getDrawnLayout = <T extends Layout>(layout: T[], cols: number): T[] => {
  // compact drops unknown fields, so only the drawn x and y are copied back.
  const drawn = utils.compact(
    layout.map((item) => ({
      ...item,
      x: Math.max(0, Math.min(item.x, cols - item.w)),
    })),
    'vertical',
    cols
  );

  return layout.map((item, index) => ({
    ...item,
    x: drawn[index].x,
    y: drawn[index].y,
  }));
};

/**
 * Grid rows the edit-mode left panel needs to hold its widgets.
 *
 * The panel is one static item in the tab grid, but its widgets live in a
 * nested one-column grid that grows to fit them, so a stored height shorter
 * than that grid lets them spill over the widgets placed below the panel. The
 * nested grid uses the tab grid's row height and margin plus a vertical padding
 * of one margin top and bottom, which is the fraction added to its rows.
 */
export const getLeftPanelHeight = (children: Layout[] = []) => {
  const rows = Math.max(
    0,
    ...getDrawnLayout(children, 1).map(({ y, h }) => y + h)
  );

  return (
    rows + (2 * GRID_VERTICAL_MARGIN) / (GRID_ROW_HEIGHT + GRID_VERTICAL_MARGIN)
  );
};

/**
 * Columns the left panel's grid uses in edit mode: the six the panel spans in
 * the tab grid, so its widgets resize and move in the same steps as the
 * widgets beside it. Saved positions stay in fractions of the panel width,
 * which view mode renders as column spans, so edit mode scales them in and
 * back out.
 */
export const LEFT_PANEL_EDIT_COLS = 6;

export const toLeftPanelEditGrid = <T extends Layout>(widget: T): T => ({
  ...widget,
  x: widget.x * LEFT_PANEL_EDIT_COLS,
  w: widget.w * LEFT_PANEL_EDIT_COLS,
});

export const fromLeftPanelEditGrid = <T extends Layout>(widget: T): T => ({
  ...widget,
  x: widget.x / LEFT_PANEL_EDIT_COLS,
  w: widget.w / LEFT_PANEL_EDIT_COLS,
});

/**
 * Grid row at `offset` px below the top of a grid's first row, in the row
 * height and margin both the tab grid and the left panel's grid use.
 */
export const getGridRowAt = (offset: number) =>
  Math.max(0, Math.floor(offset / (GRID_ROW_HEIGHT + GRID_VERTICAL_MARGIN)));

const isLeftPanelWidget = ({ i }: WidgetConfig) =>
  i.startsWith(DetailPageWidgetKeys.LEFT_PANEL);

/**
 * Places `widget` in the left panel's one-column grid at `row` (a row as
 * drawn), taking it out of the tab grid if it was there.
 *
 * A widget that fits the column beside the panel keeps that shape: it takes the
 * half of the panel at `x` (0 or 0.5), next to its neighbour. A wider one spans
 * the panel. It is listed first: react-grid-layout's compaction keeps the
 * earlier of two items on the same row, so the widget already at `row` moves
 * down below it.
 */
export const placeWidgetInLeftPanel = (
  layout: WidgetConfig[],
  widget: WidgetConfig,
  row: number,
  x: number,
  cols: number
): WidgetConfig[] =>
  layout
    .filter(({ i }) => i !== widget.i)
    .map((item) => {
      if (!isLeftPanelWidget(item)) {
        return item;
      }
      const isHalfWidth = widget.w <= cols - (item.x + item.w);

      return {
        ...item,
        children: [
          {
            ...widget,
            x: isHalfWidth ? x : 0,
            y: row,
            w: isHalfWidth ? 0.5 : 1,
          },
          ...getDrawnLayout(item.children ?? [], 1),
        ],
      };
    });

/**
 * Places `widget` in the column beside the left panel at `row` (a row as
 * drawn), taking it out of the panel if it was there. Listed first for the
 * same reason as in `placeWidgetInLeftPanel`.
 */
export const placeWidgetBesideLeftPanel = (
  layout: WidgetConfig[],
  widget: WidgetConfig,
  row: number,
  cols: number
): WidgetConfig[] => {
  const panel = layout.find(isLeftPanelWidget);
  if (!panel) {
    return layout;
  }

  const x = panel.x + panel.w;

  return [
    { ...widget, x, y: row, w: cols - x },
    ...getDrawnLayout(layout, cols).map((item) =>
      isLeftPanelWidget(item)
        ? {
            ...item,
            children: item.children?.filter(({ i }) => i !== widget.i),
          }
        : item
    ),
  ];
};
