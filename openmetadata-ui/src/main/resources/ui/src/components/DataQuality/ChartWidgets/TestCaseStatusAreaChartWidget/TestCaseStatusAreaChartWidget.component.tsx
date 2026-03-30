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
  Skeleton,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined, last, toLower } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as SuccessIcon } from '../../../../assets/svg/ic-check.svg';
import { ReactComponent as FailedIcon } from '../../../../assets/svg/ic-warning-2.svg';
import { TestCaseStatus } from '../../../../generated/entity/feed/testCaseResult';
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
  showIcon = false,
  className,
  footerWhenEmpty,
}: TestCaseStatusAreaChartWidgetProps) => {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState<CustomAreaChartData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);

  const bodyElement = useMemo(() => {
    const latestValue = last(chartData)?.count ?? 0;
    let Icon = SuccessIcon;

    if (testCaseStatus === TestCaseStatus.Failed) {
      Icon = FailedIcon;
    }

    const showEmptyFooter =
      !isChartLoading && latestValue === 0 && Boolean(footerWhenEmpty);

    return (
      <>
        <div className="tw:flex tw:items-center tw:gap-4">
          {showIcon && (
            <div
              className={classNames(
                'test-case-status-icon',
                toLower(testCaseStatus)
              )}>
              <Icon />
            </div>
          )}
          <div className="chart-widget-header">
            <Typography
              as="p"
              className={classNames(
                'chart-widget-title tw:font-semibold tw:text-sm',
                {
                  'tw:mb-0': showIcon,
                }
              )}>
              {title}
            </Typography>
            <Typography
              as="h4"
              className="chart-widget-value chart-widget-link-underline"
              data-testid="total-value">
              {latestValue}
            </Typography>
          </div>
        </div>

        {showEmptyFooter ? (
          <Tooltip title={t('label.no-data')}>
            <div className="test-case-status-widget-footer">
              {footerWhenEmpty}
            </div>
          </Tooltip>
        ) : (
          <CustomAreaChart
            colorScheme={chartColorScheme}
            data={chartData}
            height={height}
            name={name}
          />
        )}
      </>
    );
  }, [
    title,
    chartData,
    name,
    chartColorScheme,
    height,
    footerWhenEmpty,
    isChartLoading,
    t,
    testCaseStatus,
    showIcon,
  ]);

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
  }, [chartFilter, testCaseStatus]);

  const containerClassName = classNames(
    'test-case-area-chart-widget-container tw:p-4',
    className,
    { 'chart-widget-link-no-underline': !isUndefined(redirectPath) }
  );

  if (isChartLoading) {
    return <Skeleton height={120} width="100%" />;
  }

  return (
    <div
      className={containerClassName}
      data-testid={`test-case-${testCaseStatus}-area-chart-widget`}>
      <div className="chart-widget-content">
        {redirectPath ? (
          <Link to={redirectPath}>{bodyElement}</Link>
        ) : (
          bodyElement
        )}
      </div>
    </div>
  );
};

export default TestCaseStatusAreaChartWidget;
