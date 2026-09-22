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
import {
  Box,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
import { SummaryDonut } from '../SummaryDonut.component';
import { SummaryPieChartCardProps } from '../SummaryPanel.interface';
import './summary-pie-chart-card.style.less';

const SummaryPieChartCard = ({
  title,
  value,
  percentage,
  chartData,
  isLoading = false,
  showLegends = false,
  paddingAngle = 0,
  iconData,
}: SummaryPieChartCardProps) => {
  if (isLoading) {
    return (
      <Card className="pie-chart-summary-panel h-full">
        <Skeleton height={88} width="100%" />
      </Card>
    );
  }

  return (
    <Card className="pie-chart-summary-panel h-full">
      <Box align="center" gap={4} justify="between">
        <Box direction="col" gap={2}>
          <div className="summary-title-row">
            {iconData && (
              <div className={classNames('icon-container', iconData.className)}>
                {iconData.icon}
              </div>
            )}
            <Typography
              className="tw:whitespace-nowrap tw:text-secondary"
              size="text-md"
              weight="medium">
              {title}
            </Typography>
          </div>
          <Typography size="text-xl" weight="semibold">
            {formatNumberWithComma(value)}
          </Typography>
        </Box>

        <Box align="center" gap={4}>
          {showLegends && (
            <Box direction="col" gap={1}>
              {chartData.map((item) => (
                <Box align="center" gap={2} key={item.name}>
                  <span
                    className="legend-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <Typography
                    className="tw:whitespace-nowrap tw:text-tertiary"
                    size="text-sm"
                    weight="medium">
                    {item.name}{' '}
                    <span className="tw:font-semibold tw:text-primary">
                      {formatNumberWithComma(item.value)}
                    </span>
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <SummaryDonut
            chartData={chartData}
            paddingAngle={paddingAngle}
            percentage={percentage}
          />
        </Box>
      </Box>
    </Card>
  );
};

export default SummaryPieChartCard;
