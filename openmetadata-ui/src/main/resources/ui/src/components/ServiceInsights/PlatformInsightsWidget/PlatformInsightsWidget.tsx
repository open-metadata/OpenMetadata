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
import React, { useEffect, useState } from 'react';
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
import {
  aggregateChartsDataByType,
  getSummaryChartName,
  getTitleByChartType,
} from '../../../utils/PlatformInsightsWidgetUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
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

  const fetchChartsData = async () => {
    try {
      const currentTimestampInMs = Date.now();
      const oneMonthAgoTimestampInMs =
        currentTimestampInMs - 30 * 24 * 60 * 60 * 1000;

      const chartsData = await getMultiChartsPreviewByName(
        [
          SystemChartType.TotalDataAssetsSummaryCard,
          SystemChartType.NumberOfDataAssetWithDescription,
          SystemChartType.NumberOfDataAssetWithOwner,
          SystemChartType.TotalDataAssetsWithTierSummaryCard,
          SystemChartType.TotalDataAssets,
          SystemChartType.PercentageOfDataAssetWithDescription,
          SystemChartType.PercentageOfDataAssetWithOwner,
          SystemChartType.TotalDataAssetsByTier,
        ],
        {
          start: oneMonthAgoTimestampInMs,
          end: currentTimestampInMs,
          filter: `{"query":{"bool":{"must":[{"bool":{"must":[{"term":{"service.name.keyword":"${getEncodedFqn(
            escapeESReservedCharacters(serviceName)
          )}"}}]}}]}}}`,
        }
      );

      const results = [
        SystemChartType.TotalDataAssets,
        SystemChartType.PercentageOfDataAssetWithDescription,
        SystemChartType.PercentageOfDataAssetWithOwner,
        SystemChartType.TotalDataAssetsByTier,
      ].map((chartType) => {
        const chartData = chartsData[chartType];
        const summaryChartName = getSummaryChartName(chartType);
        const summaryChartData = chartsData[summaryChartName];

        const data = aggregateChartsDataByType(chartData, serviceCategory);

        const firstDayValue = data.length > 1 ? data[0]?.value : 0;
        const lastDayValue = data[data.length - 1]?.value;

        const percentageChange =
          ((lastDayValue - firstDayValue) /
            (firstDayValue === 0 ? 1 : firstDayValue)) *
          100;

        const isIncreased = lastDayValue > firstDayValue;

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

  return (
    <Card className="service-insights-widget platform-insights-card">
      <Typography.Text className="font-medium text-lg">
        {t('label.entity-insight-plural', { entity: t('label.platform') })}
      </Typography.Text>
      <Typography.Text className="text-grey-muted">
        {t('message.platform-insights-description')}
      </Typography.Text>
      <Row className="m-t-sm" gutter={16}>
        {chartsData.map((chart) => (
          <Col key={chart.chartType} span={6}>
            <Card>
              <Typography.Text className="font-semibold text-md">
                {getTitleByChartType(chart.chartType)}
              </Typography.Text>
              <Row align="bottom" className="m-t-sm" gutter={8}>
                <Col className="flex flex-col" span={16}>
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
                      className="font-medium"
                      style={{
                        color: chart.isIncreased ? GREEN_1 : RED_1,
                      }}>
                      {`${chart.percentageChange}%`}
                    </Typography.Text>
                    <Typography.Text className="font-medium text-grey-muted">
                      {t('label.vs-last-month')}
                    </Typography.Text>
                  </div>
                </Col>
                <Col span={8}>
                  <ResponsiveContainer height={50} width="100%">
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
                          chart.percentageChange > 0
                            ? `url(#color${GREEN_1})`
                            : `url(#color${RED_1})`
                        }
                        stroke={chart.percentageChange > 0 ? GREEN_1 : RED_1}
                        strokeWidth={2}
                        type="monotone"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

export default PlatformInsightsWidget;
