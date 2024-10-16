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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataQualityReport } from '../../../../generated/tests/dataQualityReport';
import { fetchCountOfNewIncidentsByDays } from '../../../../rest/dataQualityDashboardAPI';
import CustomAreaChart from '../../../Visualisations/Chart/CustomAreaChart.component';

const OpenIncidentAreaChartWidget = () => {
  const { t } = useTranslation();

  const [isChartLoading, setIsChartLoading] = useState(true);
  const [chartData, setChartData] = useState<DataQualityReport['data']>([]);

  const totalValue = useMemo(
    () =>
      chartData.reduce((acc, curr) => {
        return acc + +curr.stateId;
      }, 0),
    [chartData]
  );

  const getCountOfNewIncidents = async () => {
    setIsChartLoading(true);
    try {
      const { data } = await fetchCountOfNewIncidentsByDays();

      setChartData(data);
    } catch (error) {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  useEffect(() => {
    getCountOfNewIncidents();
  }, []);

  return (
    <Card loading={isChartLoading}>
      <Typography.Paragraph className="text-xs text-grey-muted">
        {t('label.open-incident-plural')}
      </Typography.Paragraph>
      <Typography.Paragraph className="font-medium text-xl m-b-0">
        {totalValue}
      </Typography.Paragraph>

      <CustomAreaChart
        data={chartData}
        dataKey="stateId"
        height={150}
        name="open-incident"
      />
    </Card>
  );
};

export default OpenIncidentAreaChartWidget;
