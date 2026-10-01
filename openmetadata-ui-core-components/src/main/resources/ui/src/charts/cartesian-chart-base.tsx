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
import type { BarChartProps } from './props';
import { withTooltipRender } from './tooltip-render';
import type { CartesianBuildInput, ChartOption, ChartTheme } from './types';

type CartesianBuilder = <T extends object>(
  input: CartesianBuildInput<T>,
  theme: ChartTheme
) => ChartOption;

export type CartesianChartBaseProps<T extends object> = BarChartProps<T> & {
  build: CartesianBuilder;
};

/**
 * Shared body of the line, area, bar and composed charts: builds the option
 * from props + theme, maps clicks back to the caller's row, and renders
 * through `EChart`.
 */
export const CartesianChartBase = <T extends object>({
  build,
  data,
  xKey,
  series,
  ariaLabel,
  xAxis,
  yAxis,
  tooltip,
  legend,
  referenceLines,
  zoom,
  zoomVisiblePoints,
  option,
  layout,
  getBarStatus,
  showValueLabels,
  radius,
  onPointClick,
  onCategoryClick,
  height,
  isDark,
  loading,
  emptyState,
  className,
  'data-testid': dataTestId,
}: CartesianChartBaseProps<T>) => {
  const builtTooltip = useMemo(
    () => withTooltipRender(tooltip, data),
    [tooltip, data]
  );

  const getOption = useCallback(
    (theme: ChartTheme) =>
      build(
        {
          data,
          xKey,
          series,
          ariaLabel,
          xAxis,
          yAxis,
          tooltip: builtTooltip,
          legend,
          referenceLines,
          zoom,
          zoomVisiblePoints,
          categoryClickable: Boolean(onCategoryClick),
          option,
          layout,
          getBarStatus,
          showValueLabels,
          radius,
        },
        theme
      ),
    [
      build,
      data,
      xKey,
      series,
      ariaLabel,
      xAxis,
      yAxis,
      builtTooltip,
      legend,
      referenceLines,
      zoom,
      zoomVisiblePoints,
      onCategoryClick,
      option,
      layout,
      getBarStatus,
      showValueLabels,
      radius,
    ]
  );

  const onEvents = useMemo(() => {
    if (!onPointClick && !onCategoryClick) {
      return undefined;
    }

    return {
      click: (event: ECElementEvent) => {
        // An axis with triggerEvent also reports clicks on its title
        // (targetType 'axisName'); only a label click names a category.
        const isAxisClick =
          event.componentType === 'xAxis' || event.componentType === 'yAxis';
        const isAxisLabel =
          isAxisClick &&
          (event as { targetType?: string }).targetType === 'axisLabel';
        const datum = isAxisClick ? undefined : data[event.dataIndex];
        if (isAxisLabel) {
          onCategoryClick?.(String(event.value), event);
        }
        if (datum) {
          onPointClick?.(datum, String(event.seriesId), event);
        }
      },
    };
  }, [data, onPointClick, onCategoryClick]);

  return (
    <EChart
      ariaLabel={ariaLabel}
      className={className}
      data-testid={dataTestId}
      emptyState={emptyState}
      height={height}
      isDark={isDark}
      isEmpty={data.length === 0}
      loading={loading}
      option={getOption}
      onEvents={onEvents}
    />
  );
};
