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

import type { ECElementEvent } from 'echarts';
import type { ReactNode } from 'react';
import type {
  CartesianBuildInput,
  ChartOption,
  GeoJson,
  GeoMapBuildInput,
  GeoMapDatum,
  PieBuildInput,
} from './types';

/** Props every chart component shares, on top of its build input. */
export interface ChartCommonProps {
  /** Accessible name of the chart. Translated by the caller. */
  ariaLabel: string;
  height?: number | string;
  /** Forces a colour mode. Detected from `.dark-mode` when omitted. */
  isDark?: boolean;
  loading?: boolean;
  /** Shown instead of the chart when there is no data. */
  emptyState?: ReactNode;
  /** Merged into the built option last. Objects merge, arrays replace. */
  option?: ChartOption;
  className?: string;
  'data-testid'?: string;
}

/**
 * Line, area and composed chart props.
 *
 * The option is rebuilt whenever a prop changes identity, so pass memoized
 * `data`, `series`, axis and tooltip props from components that re-render
 * often. Legend selection and the zoom window survive a rebuild either way.
 */
export interface CartesianChartProps<T extends object>
  extends Omit<
      CartesianBuildInput<T>,
      'layout' | 'getBarColor' | 'showValueLabels' | 'radius'
    >,
    ChartCommonProps {
  onPointClick?: (datum: T, seriesKey: string, event: ECElementEvent) => void;
}

export interface BarChartProps<T extends object>
  extends CartesianChartProps<T>,
    Pick<
      CartesianBuildInput<T>,
      'layout' | 'getBarColor' | 'showValueLabels' | 'radius'
    > {}

export interface PieChartProps extends PieBuildInput, ChartCommonProps {
  /** Rendered in the middle of the chart, typically for a donut total. */
  centerLabel?: ReactNode;
  onSliceClick?: (
    datum: PieBuildInput['data'][number],
    event: ECElementEvent
  ) => void;
}

export interface GeoMapChartProps extends GeoMapBuildInput, ChartCommonProps {
  /** Map geometry, already loaded (and trimmed, if wanted) by the caller. */
  geoJson: GeoJson;
  /** Receives the resolved region name and its summed value. */
  onRegionClick?: (datum: GeoMapDatum, event: ECElementEvent) => void;
  /** Raw region values that matched no feature, e.g. to explain blank areas. */
  onUnmatchedRegions?: (raw: string[]) => void;
}
