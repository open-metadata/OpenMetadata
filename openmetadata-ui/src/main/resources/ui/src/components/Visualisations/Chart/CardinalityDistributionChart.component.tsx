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

import { Box, Card, Divider, Typography, useTheme } from '@mui/material';
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
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_BLUE_1 } from '../../../constants/Color.constants';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { ColumnProfile } from '../../../generated/entity/data/table';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
} from '../../../utils/ChartUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { DataPill } from '../../common/DataPill/DataPill.styled';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export interface CardinalityDistributionChartProps {
  data: {
    firstDayData?: ColumnProfile;
    currentDayData?: ColumnProfile;
  };
  noDataPlaceholderText?: string | React.ReactNode;
}

const CardinalityDistributionChart = ({
  data,
  noDataPlaceholderText,
}: CardinalityDistributionChartProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const showSingleGraph =
    isUndefined(data.firstDayData?.cardinalityDistribution) ||
    isUndefined(data.currentDayData?.cardinalityDistribution);

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
  );

  if (
    isUndefined(data.firstDayData?.cardinalityDistribution) &&
    isUndefined(data.currentDayData?.cardinalityDistribution)
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

  const renderTooltip: TooltipProps<string | number, string>['content'] = (
    props
  ) => {
    const { active, payload } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <Card
          sx={{
            p: '10px',
            bgcolor: theme.palette.allShades.white,
          }}>
          <Typography
            sx={{
              color: theme.palette.allShades.gray[900],
              fontWeight: theme.typography.fontWeightMedium,
              fontSize: theme.typography.pxToRem(12),
            }}>
            {data.name}
          </Typography>
          <Divider
            sx={{
              my: 2,
              borderStyle: 'dashed',
              borderColor: theme.palette.allShades.gray[300],
            }}
          />
          <Box className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
            <Typography
              sx={(theme) => ({
                color: theme.palette.allShades.gray[700],
                fontSize: theme.typography.pxToRem(11),
              })}>
              {t('label.count')}
            </Typography>
            <Typography
              sx={(theme) => ({
                color: theme.palette.allShades.gray[900],
                fontWeight: theme.typography.fontWeightMedium,
                fontSize: theme.typography.pxToRem(11),
              })}>
              {tooltipFormatter(data.count)}
            </Typography>
          </Box>
          <Box className="d-flex items-center justify-between gap-6 p-b-xss text-sm">
            <Typography
              sx={(theme) => ({
                color: theme.palette.allShades.gray[700],
                fontSize: theme.typography.pxToRem(11),
              })}>
              {t('label.percentage')}
            </Typography>
            <Typography
              sx={(theme) => ({
                color: theme.palette.allShades.gray[900],
                fontWeight: theme.typography.fontWeightMedium,
                fontSize: theme.typography.pxToRem(11),
              })}>
              {`${data.percentage}%`}
            </Typography>
          </Box>
        </Card>
      );
    }

    return null;
  };

  const dataEntries = Object.entries(data).filter(
    ([, columnProfile]) => !isUndefined(columnProfile?.cardinalityDistribution)
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
        if (
          isUndefined(columnProfile) ||
          isUndefined(columnProfile?.cardinalityDistribution)
        ) {
          return;
        }

        const cardinalityData = columnProfile.cardinalityDistribution;

        const graphData =
          cardinalityData.categories?.map((category, i) => ({
            name: category,
            count: cardinalityData.counts?.[i] || 0,
            percentage: cardinalityData.percentages?.[i] || 0,
          })) || [];

        const graphDate = customFormatDateTime(
          columnProfile?.timestamp || 0,
          'MMM dd, yyyy'
        );

        return (
          <Box
            key={key}
            sx={{
              flex: showSingleGraph ? '1 1 100%' : '1 1 50%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              px: showSingleGraph ? 4 : 6,
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
              <DataPill data-testid="date">{graphDate}</DataPill>
              <DataPill data-testid="cardinality-tag">
                {`${t('label.total-entity', {
                  entity: t('label.category-plural'),
                })}: ${cardinalityData.categories?.length || 0}`}
              </DataPill>
            </Box>
            <Box sx={{ flex: 1, minHeight: 350 }}>
              <ResponsiveContainer
                debounce={200}
                id={`${key}-cardinality`}
                minHeight={300}>
                <BarChart
                  className="w-full"
                  data={graphData}
                  layout="vertical"
                  margin={{ left: 16 }}>
                  <CartesianGrid
                    horizontal={renderHorizontalGridLine}
                    stroke={GRAPH_BACKGROUND_COLOR}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    padding={{ left: 16, right: 16 }}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(props) => axisTickFormatter(props, '%')}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    allowDataOverflow
                    axisLine={false}
                    dataKey="name"
                    padding={{ top: 16, bottom: 16 }}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: string) =>
                      value?.length > 15 ? `${value.slice(0, 15)}...` : value
                    }
                    tickLine={false}
                    type="category"
                    width={120}
                  />
                  <Legend />
                  <Tooltip
                    content={renderTooltip}
                    cursor={{
                      stroke: theme.palette.grey[200],
                      strokeDasharray: '3 3',
                    }}
                  />
                  <Bar
                    dataKey="percentage"
                    fill={CHART_BLUE_1}
                    radius={[0, 8, 8, 0]}
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

export default CardinalityDistributionChart;
