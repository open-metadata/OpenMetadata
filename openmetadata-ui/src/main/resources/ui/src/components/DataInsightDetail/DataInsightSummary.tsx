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
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getGraphDataByEntityType } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';

interface Props {
  chartFilter: ChartFilter;
}

const DataInsightSummary: FC<Props> = ({ chartFilter }) => {
  const [totalEntitiesByType, setTotalEntitiesByType] =
    useState<DataInsightChartResult>();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { total, latestData = {} } = useMemo(() => {
    return getGraphDataByEntityType(
      totalEntitiesByType?.data ?? [],
      DataInsightChartType.TotalEntitiesByType
    );
  }, [totalEntitiesByType]);

  const { t } = useTranslation();

  const fetchTotalEntitiesByType = async () => {
    setIsLoading(true);
    try {
      const params = {
        ...chartFilter,
        dataInsightChartName: DataInsightChartType.TotalEntitiesByType,
        dataReportIndex: DataReportIndex.EntityReportDataIndex,
      };
      const response = await getAggregateChartData(params);

      setTotalEntitiesByType(response);
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
        <Col data-testid="summary-item-latest" span={4}>
          <Typography.Text className="data-insight-label-text">
            Latest
          </Typography.Text>
          <Typography className="font-semibold text-2xl">{total}</Typography>
        </Col>
        {Object.entries(latestData).map((summary) => {
          const label = summary[0];
          const value = summary[1] as number;

          return label !== 'timestamp' ? (
            <Col data-testid={`summary-item-${label}`} key={label} span={4}>
              <Typography.Text className="data-insight-label-text">
                {label}
              </Typography.Text>
              <Typography className="font-semibold text-2xl">
                {value}
              </Typography>
            </Col>
          ) : null;
        })}
      </Row>
    </Card>
  );
};

export default DataInsightSummary;
