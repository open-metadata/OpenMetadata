/*
 *  Copyright 2024 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import type { PieDatum } from '@openmetadata/ui-core-components/charts';
import {
  chartColor,
  PieChart,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';

import { isString } from 'lodash';
import { useCallback } from 'react';
import { CHART_SMALL_SIZE } from '../../../constants/Chart.constants';
import { formatNumberWithComma } from '../../../utils/NumberUtils';
import { CustomPieChartProps } from './Chart.interface';
import './chart.less';

const LEGEND_HIDDEN = { show: false };

const CustomPieChart = ({
  name,
  ariaLabel,
  data,
  label,
  minAngle = 3,
  showLegends = false,
  onSegmentClick,
}: CustomPieChartProps) => {
  const palette = useChartPalette();
  const centerLabel = isString(label) ? (
    <Typography color="secondary" size="text-sm" weight="medium">
      {label}
    </Typography>
  ) : (
    label
  );

  const handleSliceClick = useCallback(
    (slice: PieDatum) => {
      const index = data.findIndex((entry) => entry.name === slice.name);
      if (index >= 0) {
        onSegmentClick?.(data[index], index);
      }
    },
    [data, onSegmentClick]
  );

  return (
    <div className="custom-pie-chart tw:w-full tw:gap-3">
      <div className="tw:w-50" id={`${name}-pie-chart`}>
        <PieChart
          track
          ariaLabel={ariaLabel}
          centerLabel={centerLabel}
          data={data}
          height={CHART_SMALL_SIZE}
          innerRadius="60%"
          legend={LEGEND_HIDDEN}
          minAngle={minAngle}
          outerRadius="80%"
          onSliceClick={onSegmentClick ? handleSliceClick : undefined}
        />
      </div>

      {showLegends && (
        <div className="tw:flex tw:w-full tw:gap-2">
          {data.map((item, index) => (
            // The tile sits one step above its card. Light cards are gray-25, so bg-tertiary
            // reads as a tile. In dark the AI dashboard card is bg-surface, which resolves to
            // the same gray-800 as bg-tertiary, so dark steps up to bg-quaternary (gray-700).
            // No semantic token means "one step above bg-surface" in both themes.
            <div
              className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-center tw:gap-0.5 tw:rounded-lg tw:bg-tertiary tw:px-1 tw:py-2 tw:dark:bg-quaternary"
              data-testid={`legend-${item.name.toLowerCase()}`}
              key={item.name}>
              <Typography
                data-testid={`legend-count-${item.name.toLowerCase()}`}
                size="text-md"
                weight="semibold">
                {formatNumberWithComma(item.value)}
              </Typography>
              <span className="tw:flex tw:max-w-full tw:items-center tw:gap-1.5">
                <span
                  className="legend-dot tw:shrink-0"
                  style={{
                    backgroundColor: chartColor(palette, index, item.status),
                  }}
                />
                <Typography
                  ellipsis
                  className="tw:text-tertiary"
                  size="text-xs">
                  {item.name}
                </Typography>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomPieChart;
