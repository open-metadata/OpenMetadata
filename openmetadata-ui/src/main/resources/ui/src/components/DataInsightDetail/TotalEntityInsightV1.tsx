/*
 *  Copyright 2022 Collate.
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

import { Card, Col, Progress, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isNil, uniqueId } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAggregateChartData } from 'rest/DataInsightAPI';
import { ENTITIES_BAR_COLO_MAP } from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { ChartFilter } from '../../interface/data-insight.interface';
import { axisTickFormatter } from '../../utils/ChartUtils';
import { getGraphDataByEntityType } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';

interface Props {
  chartFilter: ChartFilter;
  selectedDays: number;
}

const TotalEntityInsightV1: FC<Props> = ({ chartFilter, selectedDays }) => {
  const [totalEntitiesByType, setTotalEntitiesByType] =
    useState<DataInsightChartResult>();

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { data, entities, total, relativePercentage, latestData } =
    useMemo(() => {
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
      data-testid="entity-summary-card"
      id={DataInsightChartType.TotalEntitiesByType}
      loading={isLoading}>
      {data.length ? (
        <Row>
          <Col span={14}>
            <Typography.Title level={5}>
              {t('label.data-insight-total-entity-summary')}
            </Typography.Title>
            <div className="p-t-lg">
              <ResponsiveContainer height={250} width="100%">
                <AreaChart
                  data={data}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                  syncId="anyId">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis tickFormatter={(value) => axisTickFormatter(value)} />
                  <Tooltip />
                  {entities.map((entity) => (
                    <Area
                      dataKey={entity}
                      key={entity}
                      stroke={ENTITIES_BAR_COLO_MAP[entity]}
                      type="monotone"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Col>
          <Col span={10}>
            <Row>
              <Col className="p-b-sm" span={24}>
                <div className="d-flex justify-between">
                  <div className="d-flex flex-col">
                    <Typography.Text>
                      {t('label.total-entity', {
                        entity: t('label.asset-plural'),
                      })}
                    </Typography.Text>
                    <Typography.Text className="font-bold text-2xl">
                      {total}
                    </Typography.Text>
                  </div>
                  <div className="d-flex flex-col justify-end text-right">
                    {relativePercentage && !isNil(relativePercentage) && (
                      <Typography.Paragraph className="m-b-0">
                        <Typography.Text
                          className="d-block"
                          type={relativePercentage >= 0 ? 'success' : 'danger'}>
                          {`${
                            relativePercentage >= 0 ? '+' : ''
                          }${relativePercentage.toFixed(2)}%`}
                        </Typography.Text>
                        <Typography.Text className="d-block">
                          {selectedDays &&
                            t('label.days-change-lowercase', {
                              days: selectedDays,
                            })}
                        </Typography.Text>
                      </Typography.Paragraph>
                    )}
                  </div>
                </div>
              </Col>
              {entities.map((entity) => {
                const progress = (latestData[entity] / Number(total)) * 100;

                return (
                  <Col key={uniqueId()} span={24}>
                    <div className="d-flex">
                      <div className="d-flex justify-between entity-data text-xs">
                        <Typography.Paragraph className="">
                          {entity}
                        </Typography.Paragraph>

                        <Typography.Paragraph className="">
                          {latestData[entity]}
                        </Typography.Paragraph>
                      </div>
                      <Progress
                        className="p-l-xss data-insight-progress-bar"
                        percent={progress}
                        showInfo={false}
                        strokeColor="#B3D4F4"
                      />
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Col>
        </Row>
      ) : (
        <EmptyGraphPlaceholder />
      )}
    </Card>
  );
};

export default TotalEntityInsightV1;
