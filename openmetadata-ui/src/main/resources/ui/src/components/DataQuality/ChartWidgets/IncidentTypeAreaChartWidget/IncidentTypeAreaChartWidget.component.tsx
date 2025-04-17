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
import classNames from 'classnames';
import { isUndefined, last } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
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

  const bodyElement = useMemo(() => {
    const latestValue = last(chartData)?.count ?? 0;

    return (
      <>
        <Typography.Paragraph className="text-xs font-semibold">
          {title}
        </Typography.Paragraph>
        <Typography.Paragraph
          className="font-medium chart-widget-link-underline text-xl m-b-0"
          data-testid="total-value">
          {latestValue}
        </Typography.Paragraph>
        <CustomAreaChart data={chartData} name={name} />
      </>
    );
  }, [title, chartData, name]);

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
    } catch {
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
      className={classNames({
        'chart-widget-link-no-underline': !isUndefined(redirectPath),
      })}
      data-testid={`incident-${incidentStatusType}-type-area-chart-widget-container`}
      loading={isChartLoading}>
      {redirectPath ? (
        <Link to={redirectPath}>{bodyElement}</Link>
      ) : (
        bodyElement
      )}
    </Card>
  );
};

export default IncidentTypeAreaChartWidget;
