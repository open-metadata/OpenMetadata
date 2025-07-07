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
import { Card, Typography } from 'antd';
import { isNull, isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchIncidentTimeMetrics } from '../../../../rest/dataQualityDashboardAPI';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { CustomAreaChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';
import { IncidentTimeChartWidgetProps } from '../../DataQuality.interface';

const IncidentTimeChartWidget = ({
  incidentMetricType,
  name,
  title,
  chartFilter,
  height,
  redirectPath,
}: IncidentTimeChartWidgetProps) => {
  const [chartData, setChartData] = useState<CustomAreaChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);

  const avgTimeValue = useMemo(() => {
    const totalTime = chartData.reduce((acc, curr) => {
      return acc + curr.count;
    }, 0);

    const avgTime = totalTime > 0 ? totalTime / chartData.length : 0;

    return (
      <Typography.Paragraph
        className="font-medium text-xl m-b-0"
        data-testid="average-time">
        {chartData.length > 0
          ? convertMillisecondsToHumanReadableFormat(avgTime)
          : '--'}
      </Typography.Paragraph>
    );
  }, [chartData]);

  const getRespondTimeMetrics = async () => {
    setIsChartLoading(true);
    try {
      const { data } = await fetchIncidentTimeMetrics(
        incidentMetricType,
        chartFilter
      );
      const updatedData = data.reduce((act, cur) => {
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

      setChartData(updatedData);
    } catch {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    getRespondTimeMetrics();
  }, [chartFilter]);

  return (
    <Card
      data-testid={`incident-${incidentMetricType}-time-chart-widget`}
      loading={isChartLoading}>
      <Typography.Paragraph className="text-xs font-semibold">
        {title}
      </Typography.Paragraph>

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
