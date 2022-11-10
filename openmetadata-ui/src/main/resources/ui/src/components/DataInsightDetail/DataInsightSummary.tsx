/*
 *  Copyright 2021 Collate
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
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAggregateChartData } from '../../axiosAPIs/DataInsightAPI';
import { ENTITIES_CHARTS_NAMES } from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getEntitiesChartSummary } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';

interface Props {
  chartFilter: ChartFilter;
  onScrollToChart: (chartType: DataInsightChartType) => void;
}

const DataInsightSummary: FC<Props> = ({ chartFilter, onScrollToChart }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [entitiesCharts, setEntitiesChart] = useState<
    (DataInsightChartResult | undefined)[]
  >([]);

  const entitiesSummaryList = useMemo(
    () => getEntitiesChartSummary(entitiesCharts),
    [entitiesCharts]
  );

  const { t } = useTranslation();

  const fetchTotalEntitiesByType = async () => {
    setIsLoading(true);
    try {
      const promises = ENTITIES_CHARTS_NAMES.map((chartName) => {
        const params = {
          ...chartFilter,
          dataInsightChartName: chartName,
          dataReportIndex: DataReportIndex.EntityReportDataIndex,
        };

        return getAggregateChartData(params);
      });

      const responses = await Promise.allSettled(promises);

      const chartDataList = responses.map((response) => {
        if (response.status === 'fulfilled') {
          return response.value;
        }

        return;
      });

      setEntitiesChart(chartDataList);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTotalEntitiesByType();
  }, [chartFilter]);

  return (
    <Card
      className="data-insight-card"
      data-testid="summary-card"
      loading={isLoading}
      title={
        <Typography.Title level={5}>
          {t('label.data-insight-summary')}
        </Typography.Title>
      }>
      <Row data-testid="summary-card-content" gutter={[16, 16]}>
        {entitiesSummaryList.map((summary) => (
          <Col
            className="summary-card-item"
            data-testid={`summary-item-${summary.id}`}
            key={summary.id}
            span={6}
            onClick={() => onScrollToChart(summary.id)}>
            <Typography.Text className="data-insight-label-text">
              {summary.label}
            </Typography.Text>
            <Typography className="font-semibold text-2xl m--ml-0.5">
              {summary.latest}
              {summary.id.startsWith('Percentage') ? '%' : ''}
            </Typography>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default DataInsightSummary;
