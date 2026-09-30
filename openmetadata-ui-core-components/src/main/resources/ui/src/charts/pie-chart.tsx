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
import { useCallback, useMemo } from 'react';
import { EChart } from './echart';
import { buildPieOption, isPieEmpty } from './options/pie';
import type { PieChartProps } from './props';
import type { ChartTheme } from './types';

/** Pie chart; a donut when `innerRadius` is set. */
export const PieChart = ({
  data,
  ariaLabel,
  innerRadius,
  centerLabel,
  showLabels,
  legend,
  tooltip,
  option,
  onSliceClick,
  height,
  isDark,
  loading,
  emptyState,
  className,
  'data-testid': dataTestId,
}: PieChartProps) => {
  const getOption = useCallback(
    (theme: ChartTheme) =>
      buildPieOption(
        { data, ariaLabel, innerRadius, showLabels, legend, tooltip, option },
        theme
      ),
    [data, ariaLabel, innerRadius, showLabels, legend, tooltip, option]
  );

  const onEvents = useMemo(
    () =>
      onSliceClick
        ? {
            click: (event: ECElementEvent) => {
              const datum = data[event.dataIndex];
              if (datum) {
                onSliceClick(datum, event);
              }
            },
          }
        : undefined,
    [data, onSliceClick]
  );

  return (
    <EChart
      ariaLabel={ariaLabel}
      className={className}
      data-testid={dataTestId}
      emptyState={emptyState}
      height={height}
      isDark={isDark}
      isEmpty={isPieEmpty(data)}
      loading={loading}
      option={getOption}
      onEvents={onEvents}>
      {centerLabel && (
        <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center">
          {centerLabel}
        </div>
      )}
    </EChart>
  );
};
