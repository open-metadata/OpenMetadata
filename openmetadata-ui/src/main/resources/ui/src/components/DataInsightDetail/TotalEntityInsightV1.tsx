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
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  getCurrentDateTimeMillis,
  getPastDaysDateTimeMillis,
} from 'utils/TimeUtils';
import { TOTAL_ENTITY_CHART_COLOR } from '../../constants/DataInsight.constants';
import { DataReportIndex } from '../../generated/dataInsight/dataInsightChart';
import {
  DataInsightChartResult,
  DataInsightChartType,
} from '../../generated/dataInsight/dataInsightChartResult';
import { axisTickFormatter } from '../../utils/ChartUtils';
import { getGraphDataByEntityType } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';

interface Props {
  selectedDays: number;
}

const TotalEntityInsightV1: FC<Props> = ({ selectedDays }) => {
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

  const fetchTotalEntitiesByType = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        startTs: getPastDaysDateTimeMillis(selectedDays),
        endTs: getCurrentDateTimeMillis(),
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
  }, [selectedDays]);

  useEffect(() => {
    fetchTotalEntitiesByType().catch(() => {
      // error handled in parent
    });
  }, [selectedDays]);

  const pluralize = (entity: string) => {
    return entity + 's';
  };

  return (
    <Card
      className="total-data-insight-card"
      data-testid="entity-summary-card"
      id={DataInsightChartType.TotalEntitiesByType}
      loading={isLoading}>
      {data.length ? (
        <Row>
          <Col span={14}>
            <Typography.Text className="font-medium">
              {t('label.data-insight-total-entity-summary')}
            </Typography.Text>
            <div className="p-t-lg">
              <ResponsiveContainer height={250} width="100%">
                <AreaChart
                  data={data}
                  margin={{
                    top: 10,
                    right: 50,
                    left: -20,
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
                      fill={TOTAL_ENTITY_CHART_COLOR[entity]}
                      key={entity}
                      stroke={TOTAL_ENTITY_CHART_COLOR[entity]}
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
                    <Typography.Text className="font-medium">
                      {t('label.total-entity', {
                        entity: t('label.asset-plural'),
                      })}
                    </Typography.Text>
                    <Typography.Text className="font-bold text-2xl">
                      {total}
                    </Typography.Text>
                  </div>
                  <div className="d-flex flex-col justify-end text-right">
                    {Boolean(relativePercentage) && !isNil(relativePercentage) && (
                      <Typography.Paragraph className="m-b-0">
                        <Typography.Text
                          className="d-block"
                          type={relativePercentage >= 0 ? 'success' : 'danger'}>
                          {`${
                            relativePercentage >= 0 ? '+' : ''
                          }${relativePercentage.toFixed(2)}%`}
                        </Typography.Text>
                        <Typography.Text className="d-block">
                          {Boolean(selectedDays) &&
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
                    <Row className="m-b-xs">
                      <Col
                        className="d-flex justify-between items-center text-xs"
                        md={12}
                        sm={24}>
                        <Typography.Paragraph className="m-b-0">
                          {pluralize(entity)}
                        </Typography.Paragraph>

                        <Typography.Paragraph className="m-b-0">
                          {latestData[entity]}
                        </Typography.Paragraph>
                      </Col>
                      <Col md={12} sm={24}>
                        <Progress
                          className="p-l-xss"
                          percent={progress}
                          showInfo={false}
                          size="small"
                          strokeColor={TOTAL_ENTITY_CHART_COLOR[entity]}
                        />
                      </Col>
                    </Row>
                  </Col>
                );
              })}
            </Row>
          </Col>
        </Row>
      ) : (
        <Row>
          <Col span={14}>
            <Typography.Text className="font-medium">
              {t('label.data-insight-total-entity-summary')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <EmptyGraphPlaceholder />
          </Col>
        </Row>
      )}
    </Card>
  );
};

export default TotalEntityInsightV1;
