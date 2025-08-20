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
import { Card, Col, Collapse, Row, Skeleton, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowSvg from '../../../assets/svg/ic-arrow-down.svg?react';
import ArrowUp from '../../../assets/svg/ic-trend-up.svg?react';
import { GREEN_1, RED_1 } from '../../../constants/Color.constants';
import { PLATFORM_INSIGHTS_CHARTS } from '../../../constants/ServiceInsightsTab.constants';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { getTitleByChartType } from '../../../utils/ServiceInsightsTabUtils';
import { getReadableCountString } from '../../../utils/ServiceUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import './platform-insights-widget.less';
import { PlatformInsightsWidgetProps } from './PlatformInsightsWidget.interface';

function PlatformInsightsWidget({
  chartsData,
  isLoading,
}: Readonly<PlatformInsightsWidgetProps>) {
  const { serviceCategory } =
    useRequiredParams<{ serviceCategory: ServiceTypes }>();
  const { t } = useTranslation();

  const { filteredCharts, filteredChartsData, containerClassName } =
    useMemo(() => {
      const filteredCharts = PLATFORM_INSIGHTS_CHARTS.filter((chart) =>
        chart === SystemChartType.HealthyDataAssets
          ? serviceCategory === ServiceCategory.DATABASE_SERVICES
          : true
      );

      return {
        filteredCharts,
        filteredChartsData: chartsData.filter((chart) =>
          filteredCharts.includes(chart.chartType)
        ),
        containerClassName:
          filteredCharts.length === 4 ? 'four-chart-container' : '',
      };
    }, [serviceCategory, chartsData]);

  return (
    <Collapse
      className="service-insights-collapse-widget platform-insights-card"
      defaultActiveKey={['1']}
      expandIcon={() => (
        <div className="expand-icon-container">
          <Typography.Text className="text-primary">
            {t('label.view-more')}
          </Typography.Text>
          <ArrowSvg className="text-primary" height={14} width={14} />
        </div>
      )}
      expandIconPosition="end">
      <Collapse.Panel
        header={
          <div className="flex flex-col gap-1">
            <Typography.Text className="font-medium text-lg">
              {t('label.entity-insight-plural', {
                entity: t('label.platform'),
              })}
            </Typography.Text>
            <Typography.Text className="text-grey-muted text-sm">
              {t('message.platform-insight-description')}
            </Typography.Text>
          </div>
        }
        key="1">
        {/* Don't remove this class name, it is used for exporting the platform insights chart */}
        <Row className="export-platform-insights-chart" gutter={16}>
          <Col
            className={classNames('other-charts-container', containerClassName)}
            span={24}>
            {isLoading
              ? filteredCharts.map((chartType) => (
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
              : filteredChartsData.map((chart) => {
                  const icon = chart.isIncreased ? (
                    <ArrowUp color={GREEN_1} height={11} width={11} />
                  ) : (
                    <ArrowUp
                      className="flip-vertical"
                      color={RED_1}
                      height={11}
                      width={11}
                    />
                  );

                  const showIcon = chart.percentageChange !== 0;

                  return (
                    <Card
                      className="widget-info-card other-charts-card"
                      key={chart.chartType}>
                      <Typography.Text className="font-semibold text-sm">
                        {getTitleByChartType(chart.chartType)}
                      </Typography.Text>
                      <Row align="top" className="m-t-xs" gutter={8}>
                        <Col span={12}>
                          <Typography.Text className="current-percentage">
                            {`${getReadableCountString(
                              chart.currentPercentage
                            )}%`}
                          </Typography.Text>
                        </Col>
                        {!isUndefined(chart.percentageChange) && (
                          <Col
                            className="flex flex-col gap-1 items-end"
                            span={12}>
                            <div className="percent-change-tag">
                              {showIcon && icon}
                              <Typography.Text
                                className="font-medium text-xs"
                                style={{
                                  color: chart.isIncreased ? GREEN_1 : RED_1,
                                }}>
                                {`${getReadableCountString(
                                  chart.percentageChange
                                )}%`}
                              </Typography.Text>
                            </div>
                            <Typography.Text className="font-small text-grey-muted text-xs text-no-wrap">
                              {chart.numberOfDays === 1
                                ? t('label.in-the-last-day')
                                : t('label.in-last-number-of-days', {
                                    numberOfDays: chart.numberOfDays,
                                  })}
                            </Typography.Text>
                          </Col>
                        )}
                      </Row>
                    </Card>
                  );
                })}
          </Col>
        </Row>
      </Collapse.Panel>
    </Collapse>
  );
}

export default PlatformInsightsWidget;
