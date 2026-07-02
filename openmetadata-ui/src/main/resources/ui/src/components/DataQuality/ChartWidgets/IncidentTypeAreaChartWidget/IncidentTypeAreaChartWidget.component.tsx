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
  height,
}: IncidentTypeAreaChartWidgetProps) => {
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartData, setChartData] = useState<CustomAreaChartData[]>([]);

  const bodyElement = useMemo(() => {
    const latestValue = last(chartData)?.count ?? 0;

    return (
      <>
        <div className="tw:mb-4">
          <Typography as="p" className="text-sm font-semibold">
            {title}
          </Typography>
        </div>
        <Typography
          as="p"
          className="chart-widget-link-underline"
          data-testid="total-value"
          size="text-xl"
          weight="semibold">
          {latestValue}
        </Typography>
        <CustomAreaChart data={chartData} height={height} name={name} />
      </>
    );
  }, [title, chartData, name, height]);

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
  }, [chartFilter, incidentStatusType]);

  if (isChartLoading) {
    return (
      <Card className="custom-chart-background">
        <Skeleton height={120} width="100%" />
      </Card>
    );
  }

  return (
    <Card
      className={classNames('custom-chart-background', {
        'chart-widget-link-no-underline': !isUndefined(redirectPath),
      })}
      data-testid={`incident-${incidentStatusType}-type-area-chart-widget-container`}>
      {redirectPath ? (
        <Link to={redirectPath}>{bodyElement}</Link>
      ) : (
        bodyElement
      )}
    </Card>
  );
};

export default IncidentTypeAreaChartWidget;
