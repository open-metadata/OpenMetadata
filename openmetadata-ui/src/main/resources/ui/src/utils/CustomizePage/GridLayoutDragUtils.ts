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
import { orderBy } from 'lodash';
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

// Widths of a left panel widget, in fractions of the panel's width.
export const HALF_PANEL_WIDTH = 0.5;
export const FULL_PANEL_WIDTH = 1;

// Room for rounding, so widths that add up to the panel, such as four sixths
// and two sixths, still share a line.
const PANEL_WIDTH_TOLERANCE = 1e-9;

/**
 * Lays `children` out in the order given the way view mode draws them: left to
 * right, wrapping to a new line when a widget does not fit what is left of the
 * line, each line starting below the tallest widget of the line above.
 */
const flowLeftPanel = <T extends Layout>(children: T[]): T[] => {
  let lineTop = 0;
  let lineHeight = 0;
  let lineEnd = 0;

  return children.map((child) => {
    if (lineEnd + child.w > FULL_PANEL_WIDTH + PANEL_WIDTH_TOLERANCE) {
      lineTop += lineHeight;
      lineHeight = 0;
      lineEnd = 0;
    }
    const placed = { ...child, x: lineEnd, y: lineTop };
    lineEnd += child.w;
    lineHeight = Math.max(lineHeight, child.h);

    return placed;
  });
};

/**
 * The left panel's widgets where view mode draws them: by row and then column,
 * flowing left to right.
 *
 * View mode renders the panel as a flowing row of column spans and cannot draw
 * a gap, such as a half-width widget alone in the right half. The edit grid
 * shows and saves this layout, so both modes agree.
 */
export const getLeftPanelFlowLayout = <T extends Layout>(
  children: T[] = []
): T[] => flowLeftPanel(orderBy(children, ['y', 'x']));

/**
 * Grid rows the edit-mode left panel needs to hold its widgets.
 *
 * The panel is one static item in the tab grid, but its widgets live in a
 * nested grid that grows to fit them, so a stored height shorter than that grid
 * lets them spill over the widgets placed below the panel. The nested grid uses
 * the tab grid's row height and margin plus a vertical padding of one margin
 * top and bottom, which is the fraction added to its rows.
 */
export const getLeftPanelHeight = (children: Layout[] = []) => {
  const rows = Math.max(
    0,
    ...getLeftPanelFlowLayout(children).map(({ y, h }) => y + h)
  );

  return (
    rows + (2 * GRID_VERTICAL_MARGIN) / (GRID_ROW_HEIGHT + GRID_VERTICAL_MARGIN)
  );
};

/**
 * Scales a left panel widget to and from the panel's edit grid, which has as
 * many columns as the panel spans in the tab grid, so its widgets resize and
 * move in the same steps as the widgets beside it. Saved positions stay in
 * fractions of the panel's width, which view mode renders as column spans.
 */
export const toLeftPanelEditGrid = <T extends Layout>(
  widget: T,
  cols: number
): T => ({
  ...widget,
  x: Math.round(widget.x * cols),
  w: Math.round(widget.w * cols),
});

export const fromLeftPanelEditGrid = <T extends Layout>(
  widget: T,
  cols: number
): T => ({
  ...widget,
  x: widget.x / cols,
  w: widget.w / cols,
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
 * Places `widget` in the left panel, `w` wide (a fraction of the panel), taking
 * it out of the tab grid if it was there.
 *
 * It goes before the first widget at or after the drop point, `row` and `x` in
 * the panel's flow layout, and the panel is laid out again from there, so the
 * widget it lands on moves along to make room.
 */
export const placeWidgetInLeftPanel = (
  layout: WidgetConfig[],
  widget: WidgetConfig,
  { row, x, w }: { row: number; x: number; w: number }
): WidgetConfig[] =>
  layout
    .filter(({ i }) => i !== widget.i)
    .map((item) => {
      if (!isLeftPanelWidget(item)) {
        return item;
      }
      const children = getLeftPanelFlowLayout(item.children);
      const landedOn = children.findIndex(
        (child) => child.y > row || (child.y === row && child.x >= x)
      );
      const at = landedOn === -1 ? children.length : landedOn;

      return {
        ...item,
        children: flowLeftPanel([
          ...children.slice(0, at),
          { ...widget, w },
          ...children.slice(at),
        ]),
      };
    });

/**
 * Places `widget` in the column beside the left panel at `row` (a row as
 * drawn), taking it out of the panel if it was there. The tab grid is not laid
 * out by this code, so the widget is listed first: react-grid-layout's
 * compaction keeps the earlier of two items on the same row, so the widget
 * already at `row` in that column moves down below it.
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
            children: getLeftPanelFlowLayout(
              item.children?.filter(({ i }) => i !== widget.i)
            ),
          }
        : item
    ),
  ];
};
