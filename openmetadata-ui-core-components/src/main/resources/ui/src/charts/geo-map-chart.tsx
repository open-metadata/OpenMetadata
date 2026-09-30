/*
 *  Copyright 2025 Collate.
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
import { useCallback, useEffect, useMemo } from 'react';
import { EChart } from './echart';
import { buildGeoMapOption, resolveGeoData } from './options/geo';
import type { GeoMapChartProps } from './props';
import { registerGeoMap } from './register';
import type { ChartTheme } from './types';

/**
 * Choropleth over caller-supplied geometry. The caller owns the map data:
 * loading the GeoJSON, trimming it, and resolving raw region values to
 * feature names (`resolveRegion`).
 */
export const GeoMapChart = ({
  geoJson,
  mapName,
  data,
  ariaLabel,
  resolveRegion,
  showScale,
  colorRange,
  tooltip,
  option,
  onRegionClick,
  onUnmatchedRegions,
  height,
  isDark,
  loading,
  emptyState,
  className,
  'data-testid': dataTestId,
}: GeoMapChartProps) => {
  // Registration is synchronous and must happen before the chart's first
  // setOption, which runs in the child's mount — so it happens during render.
  // It is idempotent per name.
  registerGeoMap(mapName, geoJson);

  const resolved = useMemo(
    () => resolveGeoData(data, resolveRegion),
    [data, resolveRegion]
  );
  const unmatchedKey = resolved.unmatched.join('\u0000');

  useEffect(() => {
    onUnmatchedRegions?.(resolved.unmatched);
    // Only re-report when the set of unmatched values changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmatchedKey, onUnmatchedRegions]);

  const getOption = useCallback(
    (theme: ChartTheme) =>
      buildGeoMapOption(
        {
          data,
          ariaLabel,
          mapName,
          resolveRegion,
          showScale,
          colorRange,
          tooltip,
          option,
        },
        theme
      ).option,
    [
      data,
      ariaLabel,
      mapName,
      resolveRegion,
      showScale,
      colorRange,
      tooltip,
      option,
    ]
  );

  const onEvents = useMemo(
    () =>
      onRegionClick
        ? {
            click: (event: ECElementEvent) => {
              const point = resolved.data.find((d) => d.name === event.name);
              if (point) {
                onRegionClick(
                  { region: point.name, value: point.value },
                  event
                );
              }
            },
          }
        : undefined,
    [resolved, onRegionClick]
  );

  return (
    <EChart
      ariaLabel={ariaLabel}
      className={className}
      data-testid={dataTestId}
      emptyState={emptyState}
      height={height}
      isDark={isDark}
      isEmpty={resolved.data.length === 0}
      loading={loading}
      option={getOption}
      onEvents={onEvents}
    />
  );
};
