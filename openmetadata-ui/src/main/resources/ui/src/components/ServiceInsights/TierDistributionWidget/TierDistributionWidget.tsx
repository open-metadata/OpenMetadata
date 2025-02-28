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
import { Card, Skeleton, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { GRAY_1, LIGHT_GRAY } from '../../../constants/Color.constants';
import { useFqn } from '../../../hooks/useFqn';
import {
  DataInsightCustomChartResult,
  getMultiChartsPreviewByName,
  SystemChartType,
} from '../../../rest/DataInsightAPI';
import Fqn from '../../../utils/Fqn';
import {
  getTierDistributionData,
  RoundedCornerBar,
} from '../../../utils/TierDistributionWidgetUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

function TierDistributionWidget() {
  const { t } = useTranslation();
  const { fqn: serviceName } = useFqn();
  const [isLoading, setIsLoading] = useState(false);
  const [chartsData, setChartsData] = useState<
    DataInsightCustomChartResult['results']
  >([]);

  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const fetchChartsData = async () => {
    try {
      setIsLoading(true);
      const currentTimestampInMs = Date.now();
      const sevenDaysAgoTimestampInMs =
        currentTimestampInMs - 7 * 24 * 60 * 60 * 1000;

      const chartsData = await getMultiChartsPreviewByName(
        [SystemChartType.TotalDataAssetsByTier],
        {
          start: sevenDaysAgoTimestampInMs,
          end: currentTimestampInMs,
          filter: `{"query":{"bool":{"must":[{"term":{"service.name.keyword":"${nameWithoutQuotes}"}}]}}}`,
        }
      );

      const results = getTierDistributionData(
        chartsData[SystemChartType.TotalDataAssetsByTier]
      );

      setChartsData(results);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartsData();
  }, []);

  return (
    <div className="service-insights-widget widget-flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Typography.Text className="font-medium text-lg">
          {t('label.entity-distribution', { entity: t('label.tier') })}
        </Typography.Text>
        <Typography.Text className="text-grey-muted">
          {t('message.tier-distribution-description')}
        </Typography.Text>
      </div>
      <Card className="widget-info-card bg-white">
        <Skeleton active loading={isLoading} paragraph={{ rows: 10 }}>
          <ResponsiveContainer height={300} width="100%">
            <BarChart
              data={chartsData}
              margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid stroke={LIGHT_GRAY} vertical={false} />
              <XAxis
                axisLine={{
                  stroke: LIGHT_GRAY,
                }}
                dataKey="group"
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                stroke={GRAY_1}
                tickLine={{
                  stroke: LIGHT_GRAY,
                }}
              />
              <Bar
                activeBar={<RoundedCornerBar />}
                background={{ fill: LIGHT_GRAY }}
                barSize={20}
                dataKey="count"
                fill="#3538CD"
                shape={<RoundedCornerBar />}
              />
            </BarChart>
          </ResponsiveContainer>
        </Skeleton>
      </Card>
    </div>
  );
}

export default TierDistributionWidget;
