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

// The ESM build: `lib/core` is CommonJS, and Vite's dev interop hands a
// default import of it the module object instead of the component.
import ReactEChartsCore from 'echarts-for-react/esm/core';
import type { ECElementEvent, EChartsType } from 'echarts';
import { ReactNode, useMemo, useRef } from 'react';
import { Skeleton } from '@/components/base/skeleton/skeleton';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { applyZoomWindow, ZoomWindow } from './options/common';
import { REPLACE_MERGE_KEYS } from './options/merge';
import { echarts, registerChartParts } from './register';
import { buildChartTheme } from './theme';
import type { ChartOption, ChartTheme } from './types';
import { useIsDarkMode } from './use-is-dark-mode';

registerChartParts();

const DEFAULT_HEIGHT = 300;
const DEFAULT_WIDTH = '100%';
const RENDER_OPTS = { renderer: 'svg' } as const;

export interface EChartProps {
  /** A ready option, or a function that builds it from the active theme. */
  option: ChartOption | ((theme: ChartTheme) => ChartOption);
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  height?: number | string;
  width?: number | string;
  /** Forces a colour mode. Detected from `.dark-mode` when omitted. */
  isDark?: boolean;
  onEvents?: Record<string, (event: ECElementEvent) => void>;
  /** Receives the ECharts instance once it exists. */
  onChartReady?: (chart: EChartsType) => void;
  loading?: boolean;
  isEmpty?: boolean;
  /** Shown instead of the chart when `isEmpty`. */
  emptyState?: ReactNode;
  className?: string;
  'data-testid'?: string;
  /** Overlay drawn above the chart, e.g. a donut's centre label. */
  children?: ReactNode;
}

interface DataZoomEvent {
  start?: number;
  end?: number;
  batch?: Array<{ start?: number; end?: number }>;
}

// A slider drag reports start/end on the event; an inside (wheel/drag) zoom
// reports them in `batch`.
const zoomWindowOf = (event: DataZoomEvent): ZoomWindow | undefined => {
  const { start, end } = event.batch?.[0] ?? event;

  return start === undefined || end === undefined ? undefined : { start, end };
};

const withAria = (option: ChartOption, ariaLabel: string): ChartOption =>
  option.aria
    ? option
    : { ...option, aria: { enabled: true, label: { description: ariaLabel } } };

/**
 * Lower-layer chart: renders any ECharts option with the charts theme, the
 * SVG renderer, and shared loading / empty / accessibility handling.
 */
export const EChart = ({
  option,
  ariaLabel,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  isDark,
  onEvents,
  onChartReady,
  loading = false,
  isEmpty = false,
  emptyState,
  className,
  'data-testid': dataTestId,
  children,
}: EChartProps) => {
  const { t } = useCoreTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  // The range the user zoomed to, re-applied whenever the option is rebuilt.
  const zoomRef = useRef<ZoomWindow>();
  const dark = useIsDarkMode(containerRef, isDark);
  const theme = buildChartTheme({ isDark: dark });
  const resolved = useMemo(
    () =>
      applyZoomWindow(
        withAria(
          typeof option === 'function' ? option(theme) : option,
          ariaLabel
        ),
        zoomRef.current
      ),
    [option, theme, ariaLabel]
  );
  const events = useMemo(
    () => ({
      ...onEvents,
      datazoom: (event: ECElementEvent) => {
        zoomRef.current =
          zoomWindowOf(event as unknown as DataZoomEvent) ?? zoomRef.current;
        onEvents?.datazoom?.(event);
      },
    }),
    [onEvents]
  );
  const size = { height, width };
  const showChart = !loading && !isEmpty;

  return (
    <div
      className={cx('tw:relative', className)}
      data-testid={dataTestId}
      ref={containerRef}>
      {loading && (
        <div aria-busy="true">
          <Skeleton height={height} variant="rounded" width={width} />
        </div>
      )}
      {!loading && isEmpty && (
        <div
          className="tw:flex tw:items-center tw:justify-center tw:text-sm tw:text-tertiary"
          role="status"
          style={size}>
          {emptyState ?? t('label.no-data-found')}
        </div>
      )}
      {showChart && (
        <ReactEChartsCore
          lazyUpdate
          echarts={echarts}
          notMerge={false}
          option={resolved}
          opts={RENDER_OPTS}
          replaceMerge={REPLACE_MERGE_KEYS}
          style={size}
          onChartReady={onChartReady}
          onEvents={events}
        />
      )}
      {showChart && children}
    </div>
  );
};
