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
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCountOfIncidentStatusTypeByDays } from '../../../../rest/dataQualityDashboardAPI';
import { CustomAreaChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';
import { IncidentTypeAreaChartWidgetProps } from '../../DataQuality.interface';
import '../chart-widgets.less';

const IncidentTypeAreaChartWidget = ({
  incidentStatusType,
  title,
  name,
  chartFilter,
  redirectPath,
}: IncidentTypeAreaChartWidgetProps) => {
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartData, setChartData] = useState<CustomAreaChartData[]>([]);

  const totalValueElement = useMemo(() => {
    const totalValue = chartData.reduce((acc, curr) => {
      return acc + curr.count;
    }, 0);

    return (
      <Typography.Paragraph
        className="font-medium text-xl m-b-0 chart-total-count-value-link"
        data-testid="total-value">
        {redirectPath ? (
          <Link className="font-medium text-xl" to={redirectPath}>
            {totalValue}
          </Link>
        ) : (
          totalValue
        )}
      </Typography.Paragraph>
    );
  }, [chartData]);

  const getCountOfIncidentStatus = async () => {
    setIsChartLoading(true);
    try {
      const { data } = await fetchCountOfIncidentStatusTypeByDays(
        incidentStatusType,
        chartFilter
      );
      const updatedData = data.map((item) => ({
        timestamp: +item.timestamp,
        count: +item.stateId,
      }));
      setChartData(updatedData);
    } catch (error) {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    getCountOfIncidentStatus();
  }, [chartFilter]);

  return (
    <Card
      data-testid={`incident-${incidentStatusType}-type-area-chart-widget-container`}
      loading={isChartLoading}>
      <Typography.Paragraph className="text-xs text-grey-muted">
        {title}
      </Typography.Paragraph>
      {totalValueElement}
      <CustomAreaChart data={chartData} name={name} />
    </Card>
  );
};

export default IncidentTypeAreaChartWidget;
