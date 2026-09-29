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
import { Card, Skeleton, Typography } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isNull, isUndefined } from 'lodash';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchIncidentTimeMetrics } from '../../../../rest/dataQualityDashboardAPI';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { CustomAreaChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';
import { IncidentTimeChartWidgetProps } from '../../DataQuality.interface';
import '../chart-widgets.less';
import { EMPTY_CHART_DATA } from '../ChartWidgets.constants';

const IncidentTimeChartWidget = ({
  incidentMetricType,
  name,
  title,
  chartFilter,
  height,
  redirectPath,
}: IncidentTimeChartWidgetProps) => {
  const { data: chartData = EMPTY_CHART_DATA, isLoading: isChartLoading } =
    useQuery({
      queryKey: [
        'dq-dashboard',
        'incident-time-metrics',
        incidentMetricType,
        chartFilter,
      ],
      queryFn: async () => {
        const { data } = await fetchIncidentTimeMetrics(
          incidentMetricType,
          chartFilter
        );

        return data.reduce((act, cur) => {
          if (isNull(cur['metrics.value'])) {
            return act;
          }

          return [
            ...act,
            {
              timestamp: +cur.timestamp,
              count: +cur['metrics.value'],
            },
          ];
        }, [] as CustomAreaChartData[]);
      },
    });

  const avgTimeValue = useMemo(() => {
    const totalTime = chartData.reduce((acc, curr) => {
      return acc + curr.count;
    }, 0);

    const avgTime = totalTime > 0 ? totalTime / chartData.length : 0;

    return (
      <Typography
        as="p"
        data-testid="average-time"
        size="text-xl"
        weight="semibold">
        {chartData.length > 0
          ? convertMillisecondsToHumanReadableFormat(avgTime)
          : '--'}
      </Typography>
    );
  }, [chartData]);

  if (isChartLoading) {
    return (
      <Card
        className="custom-chart-background"
        data-testid={`incident-${incidentMetricType}-time-chart-widget`}>
        <Skeleton height={120} width="100%" />
      </Card>
    );
  }

  return (
    <Card
      className="custom-chart-background"
      data-testid={`incident-${incidentMetricType}-time-chart-widget`}>
      <div className="tw:mb-4">
        <Typography as="p" className="text-sm font-semibold">
          {title}
        </Typography>
      </div>

      {isUndefined(redirectPath) ? (
        avgTimeValue
      ) : (
        <Link to={redirectPath}>{avgTimeValue}</Link>
      )}

      <CustomAreaChart
        data={chartData}
        height={height}
        name={name}
        valueFormatter={convertMillisecondsToHumanReadableFormat}
      />
    </Card>
  );
};

export default IncidentTimeChartWidget;
