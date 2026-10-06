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

import type { FocusEventHandler, KeyboardEventHandler } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PixelChart, pointPixel } from './point-pixel';
import type { ChartPixel, ChartSeries } from './types';

export interface NavigationChart extends PixelChart {
  dispatchAction: (action: Record<string, unknown>) => void;
}

interface NavigablePoint {
  index: number;
  seriesKey: string;
}

const hasValue = (value: unknown) =>
  value !== null && value !== undefined && value !== '';

/** One point per row: the first non-band series that has a value there. */
export const navigablePoints = <T extends object>(
  data: T[],
  series: ChartSeries[]
): NavigablePoint[] => {
  const keys = series.filter((s) => s.type !== 'band').map((s) => s.key);

  return data.flatMap((datum, index) => {
    const seriesKey = keys.find((k) =>
      hasValue((datum as Record<string, unknown>)[k])
    );

    return seriesKey === undefined ? [] : [{ index, seriesKey }];
  });
};

interface PointNavigationOptions<T extends object> {
  data: T[];
  series: ChartSeries[];
  xKey: keyof T & string;
  isTime: boolean;
  horizontal: boolean;
  enabled: boolean;
  getChart: () => NavigationChart | undefined;
  onPointHover?: (datum: T, seriesKey: string, position: ChartPixel) => void;
  onPointLeave?: () => void;
  onPointClick?: (datum: T, seriesKey: string) => void;
  pointAriaLabel?: (datum: T, seriesKey: string) => string;
}

interface PointNavigation {
  containerProps: {
    tabIndex?: number;
    onKeyDown?: KeyboardEventHandler;
    onFocus?: FocusEventHandler;
    onBlur?: FocusEventHandler;
  };
  announcement: string;
}

const NO_POINT = -1;

// Keys that act on the active point; without one they stay with the browser,
// so Space still scrolls the page after a mouse focus.
const ACTIVE_POINT_KEYS = new Set(['Enter', ' ', 'Escape']);

// A mouse click also focuses the chart; only keyboard focus starts navigation.
// Browsers without :focus-visible throw, and the first arrow key still starts it.
const isKeyboardFocus = (element: Element) => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

/**
 * Keyboard navigation over a chart's points: one Tab stop, then arrow keys.
 * Focus starts on the last point (the newest run on a time axis).
 */
export const usePointNavigation = <T extends object>({
  data,
  series,
  xKey,
  isTime,
  horizontal,
  enabled,
  getChart,
  onPointHover,
  onPointLeave,
  onPointClick,
  pointAriaLabel,
}: PointNavigationOptions<T>): PointNavigation => {
  const points = useMemo(() => navigablePoints(data, series), [data, series]);
  const activeRef = useRef(NO_POINT);
  const highlightedRef = useRef<string>();
  const [announcement, setAnnouncement] = useState('');

  const downplay = useCallback(() => {
    if (highlightedRef.current !== undefined) {
      getChart()?.dispatchAction({
        type: 'downplay',
        seriesId: highlightedRef.current,
      });
      highlightedRef.current = undefined;
    }
  }, [getChart]);

  const moveTo = useCallback(
    (position: number) => {
      const point = points[position];
      const chart = getChart();
      const datum = point && data[point.index];
      if (!point || !datum) {
        return;
      }
      activeRef.current = position;
      downplay();
      chart?.dispatchAction({
        type: 'highlight',
        seriesId: point.seriesKey,
        dataIndex: point.index,
      });
      highlightedRef.current = point.seriesKey;
      setAnnouncement(pointAriaLabel?.(datum, point.seriesKey) ?? '');
      const pixel =
        chart &&
        pointPixel(chart, datum, xKey, point.seriesKey, isTime, horizontal);
      if (pixel) {
        onPointHover?.(datum, point.seriesKey, pixel);
      }
    },
    [
      points,
      data,
      getChart,
      downplay,
      pointAriaLabel,
      xKey,
      isTime,
      horizontal,
      onPointHover,
    ]
  );

  const leave = useCallback(() => {
    activeRef.current = NO_POINT;
    downplay();
    setAnnouncement('');
    onPointLeave?.();
  }, [downplay, onPointLeave]);

  const select = useCallback(() => {
    const point = points[activeRef.current];
    const datum = point && data[point.index];
    if (point && datum) {
      onPointClick?.(datum, point.seriesKey);
    }
  }, [points, data, onPointClick]);

  const leaveIfActive = useCallback(() => {
    const wasActive = activeRef.current !== NO_POINT;
    if (wasActive) {
      leave();
    }

    return wasActive;
  }, [leave]);

  const onKeyDown = useCallback<KeyboardEventHandler>(
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const last = points.length - 1;
      const active = activeRef.current;
      const targets: Partial<Record<string, () => unknown>> = {
        ArrowLeft: () =>
          moveTo(active === NO_POINT ? last : Math.max(active - 1, 0)),
        ArrowRight: () =>
          moveTo(active === NO_POINT ? last : Math.min(active + 1, last)),
        Home: () => moveTo(0),
        End: () => moveTo(last),
        Enter: select,
        ' ': select,
        Escape: leaveIfActive,
      };
      const handler = targets[event.key];
      const isActionable =
        handler && (active !== NO_POINT || !ACTIVE_POINT_KEYS.has(event.key));
      if (isActionable) {
        event.preventDefault();
        handler();
      }
    },
    [points, moveTo, select, leaveIfActive]
  );

  const onFocus = useCallback<FocusEventHandler>(
    (event) => {
      if (isKeyboardFocus(event.currentTarget)) {
        moveTo(points.length - 1);
      }
    },
    [points, moveTo]
  );

  return {
    containerProps: enabled
      ? { tabIndex: 0, onKeyDown, onFocus, onBlur: leaveIfActive }
      : {},
    announcement,
  };
};
