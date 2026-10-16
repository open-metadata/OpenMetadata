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
import { useCallback, useMemo, useState } from 'react';
import type { WidgetConfig } from '../../../interface/customization.interface';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import type { TopicCollapseValue } from '../Widgets/Common/TopicWidget/TopicCollapseContext';
import type { TopicsViewMode } from './TopicsSectionHeader';

/**
 * The grid is rendered at a quarter of the layout's row height, with every
 * height and offset multiplied to match.
 *
 * A widget row is 133px, and react-grid-layout cannot allocate less than one
 * row — so a collapsed card, which needs about 90px for its header, was being
 * given a full row and leaving ~58px of empty cell under every one of them.
 * Subdividing lets a collapsed card take three quarter-rows (96px) instead.
 *
 * Display-only: the saved layout still stores `h: 3` for a normal widget, and
 * the persona editor still renders against the unsubdivided grid.
 */
const ROW_SUBDIVISIONS = 4;

/**
 * Height of one subdivided row, chosen so a subdivided widget is exactly as
 * tall as it was before. react-grid-layout sizes an item `h * (row + margin) -
 * margin`, so matching `h * (R + m) === h * S * (r + m)` gives this.
 */
const subdividedRowHeight = (rowHeight: number, margin: number) =>
  (rowHeight + margin) / ROW_SUBDIVISIONS - margin;

/** Three quarter-rows ≈ 96px, just clear of a header-only card. */
const COLLAPSED_WIDGET_HEIGHT = 3;

export interface TopicsView {
  collapseValue: TopicCollapseValue;
  isEveryWidgetCollapsed: boolean;
  toggleAll: () => void;
  viewMode: TopicsViewMode;
  setViewMode: (mode: TopicsViewMode) => void;
  columns: number;
  /** The persona layout with the view's overrides applied. */
  displayLayout: WidgetConfig[];
  /** Row height the grid must be rendered at for `displayLayout` to be sized right. */
  rowHeight: number;
  /** Pixel height of a `displayLayout` entry, matching how the grid sizes it. */
  widgetHeight: (h: number) => number;
}

/**
 * Collapse and grid/list state for the topic cards, and the layout that falls
 * out of them.
 *
 * The overrides are derived, never written back: collapsing a card or switching
 * to list view must not read as a layout edit the persona editor would then
 * offer to save. Both reset on navigation, matching the prototype — neither is
 * a persisted preference.
 */
export const useTopicsView = (layout: WidgetConfig[]): TopicsView => {
  const margin = customizeMyDataPageClassBase.landingPageWidgetMargin;
  const rowHeight = subdividedRowHeight(
    customizeMyDataPageClassBase.landingPageRowHeight,
    margin
  );
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [viewMode, setViewMode] = useState<TopicsViewMode>('grid');

  const collapseValue = useMemo<TopicCollapseValue>(
    () => ({
      isCollapsed: (widgetKey) => collapsedKeys.has(widgetKey),
      isEnabled: true,
      toggle: (widgetKey) =>
        setCollapsedKeys((previous) => {
          const next = new Set(previous);
          if (!next.delete(widgetKey)) {
            next.add(widgetKey);
          }

          return next;
        }),
    }),
    [collapsedKeys]
  );

  const isEveryWidgetCollapsed =
    layout.length > 0 && layout.every((widget) => collapsedKeys.has(widget.i));

  const toggleAll = useCallback(
    () =>
      setCollapsedKeys(
        isEveryWidgetCollapsed
          ? new Set<string>()
          : new Set(layout.map((widget) => widget.i))
      ),
    [isEveryWidgetCollapsed, layout]
  );

  const displayLayout = useMemo<WidgetConfig[]>(() => {
    const sized = layout.map((widget) =>
      collapsedKeys.has(widget.i)
        ? {
            ...widget,
            h: COLLAPSED_WIDGET_HEIGHT,
            y: widget.y * ROW_SUBDIVISIONS,
          }
        : {
            ...widget,
            h: widget.h * ROW_SUBDIVISIONS,
            y: widget.y * ROW_SUBDIVISIONS,
          }
    );

    if (viewMode !== 'list') {
      return sized;
    }

    // One full-width column in reading order; react-grid-layout compacts the
    // rows, so `y` only has to carry the order.
    return [...sized]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((widget, index) => ({ ...widget, w: 1, x: 0, y: index }));
  }, [layout, collapsedKeys, viewMode]);

  return {
    collapseValue,
    columns:
      viewMode === 'list'
        ? 1
        : customizeMyDataPageClassBase.landingPageMaxGridSize,
    displayLayout,
    isEveryWidgetCollapsed,
    rowHeight,
    // react-grid-layout's own sizing, so a deferred widget reserves exactly the
    // space the grid is about to give it.
    widgetHeight: (h) => h * (rowHeight + margin) - margin,
    setViewMode,
    toggleAll,
    viewMode,
  };
};
