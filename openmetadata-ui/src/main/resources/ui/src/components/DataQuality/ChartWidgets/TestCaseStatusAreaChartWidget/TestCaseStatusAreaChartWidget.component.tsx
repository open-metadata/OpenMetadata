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
import { isUndefined, last, toLower } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTestCaseStatusMetricsByDays } from '../../../../rest/dataQualityDashboardAPI';
import { CustomAreaChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';
import { TestCaseStatusAreaChartWidgetProps } from '../../DataQuality.interface';
import '../chart-widgets.less';
import './test-case-status-area-chart-widget.less';

const TestCaseStatusAreaChartWidget = ({
  testCaseStatus,
  name,
  title,
  chartColorScheme,
  chartFilter,
  height,
  redirectPath,
}: TestCaseStatusAreaChartWidgetProps) => {
  const [chartData, setChartData] = useState<CustomAreaChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);

  const bodyElement = useMemo(() => {
    const latestValue = last(chartData)?.count ?? 0;

    return (
      <>
        <Typography.Paragraph className="text-xs font-semibold">
          {title}
        </Typography.Paragraph>
        <Typography.Paragraph
          className="font-medium text-xl m-b-0 chart-widget-link-underline"
          data-testid="total-value">
          {latestValue}
        </Typography.Paragraph>
        <CustomAreaChart
          colorScheme={chartColorScheme}
          data={chartData}
          height={height}
          name={name}
        />
      </>
    );
  }, [title, chartData, name, chartColorScheme, height]);

  const getTestCaseStatusMetrics = async () => {
    setIsChartLoading(true);
    try {
      const { data } = await fetchTestCaseStatusMetricsByDays(
        testCaseStatus,
        chartFilter
      );
      const updatedData = data.map((cur) => {
        return {
          timestamp: +cur.timestamp,
          count: +cur['testCase.fullyQualifiedName'],
        };
      });

      setChartData(updatedData);
    } catch {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    getTestCaseStatusMetrics();
  }, [chartFilter]);

  return (
    <Card
      className={classNames(
        'test-case-area-chart-widget-container',
        toLower(testCaseStatus),
        {
          'chart-widget-link-no-underline': !isUndefined(redirectPath),
        }
      )}
      data-testid={`test-case-${testCaseStatus}-area-chart-widget`}
      loading={isChartLoading}>
      {redirectPath ? (
        <Link to={redirectPath}>{bodyElement}</Link>
      ) : (
        bodyElement
      )}
    </Card>
  );
};

export default TestCaseStatusAreaChartWidget;
