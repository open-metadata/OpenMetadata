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
import { Typography as CoreTypography } from '@openmetadata/ui-core-components';
import type { PieDatum } from '@openmetadata/ui-core-components/charts';
import { PieChart } from '@openmetadata/ui-core-components/charts';
import { Space, Typography } from 'antd';
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
  const centerLabel = isString(label) ? (
    <CoreTypography color="secondary" size="text-sm" weight="medium">
      {label}
    </CoreTypography>
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
    <div className="custom-pie-chart">
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
        <Space wrap size={16}>
          {data.map((item) => (
            <Space align="center" key={item.name} size={8}>
              <div
                className="legend-dot"
                style={{ backgroundColor: item.color }}
              />
              <Typography.Paragraph className="text-grey-muted m-b-0 font-medium">
                {item.name}{' '}
                <Typography.Text
                  strong
                  className="text-grey-muted"
                  data-testid={`legend-count-${item.name.toLowerCase()}`}>
                  {formatNumberWithComma(item.value)}
                </Typography.Text>
              </Typography.Paragraph>
            </Space>
          ))}
        </Space>
      )}
    </div>
  );
};

export default CustomPieChart;
