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
import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { last, round } from 'lodash';
import { ServiceTypes } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ReactComponent as ArrowDown } from '../../../assets/svg/down-full-arrow.svg';
import { ReactComponent as ArrowUp } from '../../../assets/svg/up-full-arrow.svg';
import { GREEN_1, RED_1 } from '../../../constants/Color.constants';
import { useFqn } from '../../../hooks/useFqn';
import {
  getMultiChartsPreviewByName,
  SystemChartType,
} from '../../../rest/DataInsightAPI';
import Fqn from '../../../utils/Fqn';
import {
  aggregateChartsDataByType,
  getSummaryChartName,
  getTitleByChartType,
} from '../../../utils/PlatformInsightsWidgetUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TotalDataAssetsWidget from '../TotalDataAssetsWidget/TotalDataAssetsWidget';
import './platform-insights-widget.less';
import { ChartSeriesData } from './PlatformInsightsWidget.interface';

function PlatformInsightsWidget() {
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();
  const { fqn: serviceName } = useFqn();
  const { t } = useTranslation();
  const [chartsData, setChartsData] = useState<ChartSeriesData[]>([]);

  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const fetchChartsData = async () => {
    try {
      const currentTimestampInMs = Date.now();
      const sevenDaysAgoTimestampInMs =
        currentTimestampInMs - 7 * 24 * 60 * 60 * 1000;

      const chartsData = await getMultiChartsPreviewByName(
        [
          SystemChartType.PercentageOfServiceWithDescription, // TODO: Replace this with PII chart
          SystemChartType.NumberOfDataAssetWithDescription,
          SystemChartType.NumberOfDataAssetWithOwner,
          SystemChartType.TotalDataAssetsWithTierSummaryCard,
          SystemChartType.PercentageOfDataAssetWithDescription,
          SystemChartType.PercentageOfDataAssetWithOwner,
          SystemChartType.TotalDataAssetsByTier,
        ],
        {
          start: sevenDaysAgoTimestampInMs,
          end: currentTimestampInMs,
          filter: `{"query":{"bool":{"must":[{"term":{"service.name.keyword":"${nameWithoutQuotes}"}}]}}}`,
        }
      );

      const results = [
        SystemChartType.PercentageOfDataAssetWithDescription,
        SystemChartType.PercentageOfServiceWithDescription, // TODO: Replace this with PII chart
        SystemChartType.TotalDataAssetsByTier,
        SystemChartType.PercentageOfDataAssetWithOwner,
      ].map((chartType) => {
        const chartData = chartsData[chartType];
        const summaryChartName = getSummaryChartName(chartType);
        const summaryChartData = chartsData[summaryChartName];

        const data = aggregateChartsDataByType(
          chartData,
          serviceCategory,
          chartType
        );

        const firstDayValue = data.length > 1 ? data[0]?.value : 0;
        const lastDayValue = data[data.length - 1]?.value;

        const percentageChange =
          ((lastDayValue - firstDayValue) /
            (firstDayValue === 0 ? lastDayValue : firstDayValue)) *
          100;

        const isIncreased = lastDayValue >= firstDayValue;

        return {
          chartType,
          data,
          isIncreased,
          percentageChange: isNaN(percentageChange)
            ? 0
            : round(Math.abs(percentageChange), 2),
          currentCount: round(last(summaryChartData.results)?.count ?? 0, 2),
        };
      });

      setChartsData(results);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchChartsData();
  }, []);

  const { otherChartsData } = useMemo(
    () => ({
      otherChartsData: chartsData.filter(
        (chart) => chart.chartType !== SystemChartType.TotalDataAssets
      ),
    }),
    [chartsData]
  );

  return (
    <Card className="service-insights-widget widget-flex-col platform-insights-card">
      <Typography.Text className="font-medium text-lg">
        {t('label.entity-insight-plural', { entity: t('label.platform') })}
      </Typography.Text>
      <Typography.Text className="text-grey-muted">
        {t('message.platform-insight-description')}
      </Typography.Text>

      <Row className="m-t-sm" gutter={16}>
        <Col span={12}>
          <TotalDataAssetsWidget />
        </Col>
        <Col className="other-charts-container" span={12}>
          {otherChartsData.map((chart) => (
            <Card
              className="widget-info-card other-charts-card"
              key={chart.chartType}>
              <Typography.Text className="font-semibold text-md">
                {getTitleByChartType(chart.chartType)}
              </Typography.Text>
              <Row align="bottom" className="m-t-sm flex-1" gutter={8}>
                <Col className="flex flex-col justify-between h-full" span={14}>
                  <Typography.Title level={3}>
                    {chart.currentCount}
                  </Typography.Title>
                  <div className="flex items-center gap-1 flex-wrap">
                    {chart.isIncreased ? (
                      <ArrowUp color={GREEN_1} height={11} width={11} />
                    ) : (
                      <ArrowDown color={RED_1} height={11} width={11} />
                    )}
                    <Typography.Text
                      className="font-medium text-sm"
                      style={{
                        color: chart.isIncreased ? GREEN_1 : RED_1,
                      }}>
                      {`${chart.percentageChange}%`}
                    </Typography.Text>
                    <Typography.Text className="font-medium text-grey-muted text-sm">
                      {t('label.vs-last-month')}
                    </Typography.Text>
                  </div>
                </Col>
                <Col className="flex items-end h-full" span={10}>
                  <ResponsiveContainer height={70} width="100%">
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
                        dataKey="value"
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
            </Card>
          ))}
        </Col>
      </Row>
    </Card>
  );
}

export default PlatformInsightsWidget;
