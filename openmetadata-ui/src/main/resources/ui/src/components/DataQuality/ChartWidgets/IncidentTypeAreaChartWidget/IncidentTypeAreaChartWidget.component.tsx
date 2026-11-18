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
import classNames from 'classnames';
import { isUndefined, last } from 'lodash';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchCountOfIncidentStatusTypeByDays } from '../../../../rest/dataQualityDashboardAPI';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';
import { IncidentTypeAreaChartWidgetProps } from '../../DataQuality.interface';
import '../chart-widgets.less';
import { EMPTY_CHART_DATA } from '../ChartWidgets.constants';

const IncidentTypeAreaChartWidget = ({
  incidentStatusTypes,
  title,
  description,
  name,
  chartFilter,
  redirectPath,
  height,
}: IncidentTypeAreaChartWidgetProps) => {
  const { data: chartData = EMPTY_CHART_DATA, isLoading: isChartLoading } =
    useQuery({
      queryKey: [
        'dq-dashboard',
        'incident-status-count',
        incidentStatusTypes,
        chartFilter,
      ],
      queryFn: async () => {
        const { data } = await fetchCountOfIncidentStatusTypeByDays(
          incidentStatusTypes,
          chartFilter
        );

        return data.map((item) => ({
          timestamp: +item.timestamp,
          count: +item.stateId,
        }));
      },
    });

  const bodyElement = useMemo(() => {
    // The headline is the latest daily bucket, not a total.
    // ADR:2026-11-16-incident-cards-describe-their-counts-as-daily-activity
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
        <CustomAreaChart
          ariaLabel={title}
          data={chartData}
          height={height}
          name={name}
        />
        <div className="tw:mt-4">
          <Typography
            as="p"
            color="secondary"
            data-testid="widget-description"
            size="text-xs">
            {description}
          </Typography>
        </div>
      </>
    );
  }, [title, description, chartData, name, height]);

  if (isChartLoading) {
    return (
      <Card
        className={classNames('custom-chart-background', {
          'chart-widget-link-no-underline': !isUndefined(redirectPath),
        })}
        data-testid={`incident-${incidentStatusTypes[0]}-type-area-chart-widget-container`}>
        <Skeleton height={120} width="100%" />
      </Card>
    );
  }

  return (
    <Card
      className={classNames('custom-chart-background', {
        'chart-widget-link-no-underline': !isUndefined(redirectPath),
      })}
      data-testid={`incident-${incidentStatusTypes[0]}-type-area-chart-widget-container`}>
      {redirectPath ? (
        <Link to={redirectPath}>{bodyElement}</Link>
      ) : (
        bodyElement
      )}
    </Card>
  );
};

export default IncidentTypeAreaChartWidget;
