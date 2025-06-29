/*
 *  Copyright 2025 Collate.
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
import { Card, Col, Row, Skeleton, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ReactComponent as ArrowDown } from '../../../assets/svg/down-full-arrow.svg';
import { ReactComponent as ArrowUp } from '../../../assets/svg/up-full-arrow.svg';
import { GREEN_1, RED_1 } from '../../../constants/Color.constants';
import { PLATFORM_INSIGHTS_CHART } from '../../../constants/ServiceInsightsTab.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getServiceInsightsWidgetPlaceholder,
  getTitleByChartType,
} from '../../../utils/ServiceInsightsTabUtils';
import { getReadableCountString } from '../../../utils/ServiceUtils';
import TotalDataAssetsWidget from '../TotalDataAssetsWidget/TotalDataAssetsWidget';
import './platform-insights-widget.less';
import { PlatformInsightsWidgetProps } from './PlatformInsightsWidget.interface';

function PlatformInsightsWidget({
  chartsData,
  isLoading,
  serviceName,
  workflowStatesData,
}: Readonly<PlatformInsightsWidgetProps>) {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();

  const showPlaceholder = useMemo(() => {
    return chartsData.every((chart) => chart.noRecords);
  }, [chartsData]);

  return (
    <div className="service-insights-widget widget-flex-col platform-insights-card">
      <Typography.Text className="font-medium text-lg">
        {t('label.entity-insight-plural', { entity: t('label.platform') })}
      </Typography.Text>
      <Typography.Text className="text-grey-muted text-sm">
        {t('message.platform-insight-description')}
      </Typography.Text>

      {/* Don't remove this class name, it is used for exporting the platform insights chart */}
      <Row className="m-t-lg export-platform-insights-chart" gutter={16}>
        <Col span={12}>
          <TotalDataAssetsWidget
            serviceName={serviceName}
            workflowStatesData={workflowStatesData}
          />
        </Col>
        <Col className="other-charts-container" span={12}>
          {isLoading
            ? PLATFORM_INSIGHTS_CHART.map((chartType) => (
                <Card
                  className="widget-info-card other-charts-card"
                  key={chartType}>
                  <Skeleton
                    active
                    loading={isLoading}
                    paragraph={{ rows: 2 }}
                  />
                </Card>
              ))
            : chartsData.map((chart) => {
                const icon = chart.isIncreased ? (
                  <ArrowUp color={GREEN_1} height={11} width={11} />
                ) : (
                  <ArrowDown color={RED_1} height={11} width={11} />
                );

                const showIcon = chart.percentageChange !== 0;

                const errorPlaceholder = getServiceInsightsWidgetPlaceholder({
                  chartType: chart.chartType,
                  height: 30,
                  width: 30,
                  theme,
                  placeholderClassName: 'm-t-lg border-none',
                });

                return (
                  <Card
                    className="widget-info-card other-charts-card"
                    key={chart.chartType}>
                    <Typography.Text className="font-semibold text-md">
                      {getTitleByChartType(chart.chartType)}
                    </Typography.Text>
                    {showPlaceholder ? (
                      errorPlaceholder
                    ) : (
                      <Row align="bottom" className="m-t-sm flex-1" gutter={8}>
                        <Col
                          className="flex flex-col justify-between h-full"
                          span={15}>
                          <Typography.Title level={3}>
                            {`${getReadableCountString(
                              chart.currentPercentage
                            )}%`}
                          </Typography.Title>
                          {!isUndefined(chart.percentageChange) && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {showIcon && icon}
                              <Typography.Text
                                className="font-medium text-sm"
                                style={{
                                  color: chart.isIncreased ? GREEN_1 : RED_1,
                                }}>
                                {`${getReadableCountString(
                                  chart.percentageChange
                                )}%`}
                              </Typography.Text>
                              <Typography.Text className="font-medium text-grey-muted text-sm">
                                {chart.numberOfDays === 1
                                  ? t('label.in-the-last-day')
                                  : t('label.in-last-number-of-days', {
                                      numberOfDays: chart.numberOfDays,
                                    })}
                              </Typography.Text>
                            </div>
                          )}
                        </Col>
                        <Col className="flex items-end h-full" span={9}>
                          <ResponsiveContainer
                            height="90%"
                            minHeight={90}
                            width="100%">
                            <AreaChart data={chart.data}>
                              <defs>
                                {[GREEN_1, RED_1].map((color) => (
                                  <linearGradient
                                    id={`color${color}`}
                                    key={color}
                                    x1="0"
                                    x2="0"
                                    y1="0"
                                    y2="1">
                                    <stop
                                      offset="1%"
                                      stopColor={color}
                                      stopOpacity={0.3}
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor={color}
                                      stopOpacity={0.05}
                                    />
                                  </linearGradient>
                                ))}
                              </defs>
                              <Area
                                dataKey="count"
                                fill={
                                  chart.isIncreased
                                    ? `url(#color${GREEN_1})`
                                    : `url(#color${RED_1})`
                                }
                                stroke={chart.isIncreased ? GREEN_1 : RED_1}
                                strokeWidth={2}
                                type="monotone"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Col>
                      </Row>
                    )}
                  </Card>
                );
              })}
        </Col>
      </Row>
    </div>
  );
}

export default PlatformInsightsWidget;
