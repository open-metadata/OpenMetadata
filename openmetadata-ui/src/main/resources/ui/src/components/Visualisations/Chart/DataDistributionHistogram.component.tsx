/*
 *  Copyright 2023 Collate.
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

import { Box, useTheme } from '@mui/material';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_BLUE_1 } from '../../../constants/Color.constants';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { DEFAULT_HISTOGRAM_DATA } from '../../../constants/profiler.constant';
import { HistogramClass } from '../../../generated/entity/data/table';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
} from '../../../utils/ChartUtils';
import { CustomDQTooltip } from '../../../utils/DataQuality/DataQualityUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { DataPill } from '../../common/DataPill/DataPill.styled';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { DataDistributionHistogramProps } from './Chart.interface';

const DataDistributionHistogram = ({
  data,
  noDataPlaceholderText,
}: DataDistributionHistogramProps) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
  );

  const showSingleGraph =
    isUndefined(data.firstDayData?.histogram) ||
    isUndefined(data.currentDayData?.histogram);

  if (
    isUndefined(data.firstDayData?.histogram) &&
    isUndefined(data.currentDayData?.histogram)
  ) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
        }}>
        <ErrorPlaceHolder placeholderText={noDataPlaceholderText} />
      </Box>
    );
  }

  const dataEntries = Object.entries(data).filter(
    ([, columnProfile]) => !isUndefined(columnProfile?.histogram)
  );

  return (
    <Box
      data-testid="chart-container"
      sx={{
        display: 'flex',
        width: '100%',
        gap: 0,
      }}>
      {dataEntries.map(([key, columnProfile], index) => {
        const histogramData =
          (columnProfile?.histogram as HistogramClass) ||
          DEFAULT_HISTOGRAM_DATA;

        const graphData = histogramData.frequencies?.map((frequency, i) => ({
          name: histogramData?.boundaries?.[i],
          frequency,
        }));

        const graphDate = customFormatDateTime(
          columnProfile?.timestamp || 0,
          'MMM dd, yyyy'
        );

        const skewColorTheme = columnProfile?.nonParametricSkew
          ? columnProfile?.nonParametricSkew > 0
            ? theme.palette.allShades.success
            : theme.palette.allShades.error
          : theme.palette.allShades.info;

        return (
          <Box
            key={key}
            sx={{
              flex: showSingleGraph ? '1 1 100%' : '1 1 50%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              px: showSingleGraph ? 4 : 3,
              py: 2,
              borderRight:
                !showSingleGraph && index === 0
                  ? `1px solid ${theme.palette.grey[200]}`
                  : 'none',
            }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 5,
              }}>
              <DataPill>{graphDate}</DataPill>
              <DataPill
                sx={{
                  backgroundColor: skewColorTheme[100],
                  color: skewColorTheme[900],
                }}>
                {`${t('label.skew')}: ${
                  columnProfile?.nonParametricSkew || '--'
                }`}
              </DataPill>
            </Box>
            <Box sx={{ flex: 1, minHeight: 350 }}>
              <ResponsiveContainer
                debounce={200}
                height="100%"
                id={`${key}-histogram`}
                width="100%">
                <BarChart
                  data={graphData}
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid
                    horizontal={renderHorizontalGridLine}
                    stroke={GRAPH_BACKGROUND_COLOR}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="name"
                    padding={{ left: 16, right: 16 }}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDataOverflow
                    axisLine={false}
                    padding={{ top: 16, bottom: 16 }}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(props) => axisTickFormatter(props)}
                    tickLine={false}
                  />
                  <Legend />
                  <Tooltip
                    content={
                      <CustomDQTooltip
                        displayDateInHeader={false}
                        timeStampKey="name"
                        valueFormatter={(value) => tooltipFormatter(value)}
                      />
                    }
                    cursor={{
                      fill: theme.palette.grey[100],
                      stroke: theme.palette.grey[200],
                      strokeDasharray: '3 3',
                    }}
                  />
                  <Bar
                    barSize={22}
                    dataKey="frequency"
                    fill={CHART_BLUE_1}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default DataDistributionHistogram;
