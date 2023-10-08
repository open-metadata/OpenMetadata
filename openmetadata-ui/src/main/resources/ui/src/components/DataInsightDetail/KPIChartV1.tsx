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

import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as KPIIcon } from '../../assets/svg/ic-kpi.svg';
import { GRAPH_BACKGROUND_COLOR } from '../../constants/constants';
import { KPI_WIDGET_GRAPH_COLORS } from '../../constants/DataInsight.constants';
import { DATA_INSIGHT_DOCS } from '../../constants/docs.constants';
import { Kpi, KpiResult } from '../../generated/dataInsight/kpi/kpi';
import { UIKpiResult } from '../../interface/data-insight.interface';
import { getLatestKpiResult, getListKpiResult } from '../../rest/KpiAPI';
import { Transi18next } from '../../utils/CommonUtils';
import { getKpiGraphData } from '../../utils/DataInsightUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import KPILatestResultsV1 from './KPILatestResultsV1';

interface Props {
  kpiList: Array<Kpi>;
  selectedDays: number;
  isKPIListLoading: boolean;
}

const EmptyPlaceholder = () => {
  const { t } = useTranslation();

  return (
    <div className="d-flex items-center flex-col p-t-sm">
      <KPIIcon width={80} />
      <div className="m-t-xs text-center">
        <Typography.Paragraph style={{ marginBottom: '0' }}>
          {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
            entity: t('label.data-insight'),
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Transi18next
            i18nKey="message.refer-to-our-doc"
            renderElement={
              <a
                href={DATA_INSIGHT_DOCS}
                rel="noreferrer"
                style={{ color: '#1890ff' }}
                target="_blank"
              />
            }
            values={{
              doc: t('label.doc-plural-lowercase'),
            }}
          />
        </Typography.Paragraph>
      </div>
    </div>
  );
};

const KPIChartV1: FC<Props> = ({ isKPIListLoading, kpiList, selectedDays }) => {
  const { t } = useTranslation();

  const [kpiResults, setKpiResults] = useState<KpiResult[]>([]);
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchKpiResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const promises = kpiList.map((kpi) =>
        getListKpiResult(kpi.fullyQualifiedName ?? '', {
          startTs: getEpochMillisForPastDays(selectedDays),
          endTs: getCurrentMillis(),
        })
      );
      const responses = await Promise.allSettled(promises);
      const kpiResultsList: KpiResult[] = [];

      responses.forEach((response) => {
        if (response.status === 'fulfilled') {
          kpiResultsList.push(...response.value.data);
        }
      });
      setKpiResults(kpiResultsList);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [kpiList, selectedDays]);

  const fetchKpiLatestResults = async () => {
    setIsLoading(true);
    try {
      const promises = kpiList.map((kpi) =>
        getLatestKpiResult(kpi.fullyQualifiedName ?? '')
      );
      const responses = await Promise.allSettled(promises);

      const latestResults = responses.reduce((previous, curr) => {
        if (curr.status === 'fulfilled') {
          const resultValue: KpiResult = curr.value;
          const kpiName = resultValue.kpiFqn ?? '';

          // get the current kpi
          const kpi = kpiList.find((k) => k.fullyQualifiedName === kpiName);

          // get the kpiTarget
          const kpiTarget = kpi?.targetDefinition?.[0];

          if (!isUndefined(kpi) && !isUndefined(kpiTarget)) {
            return {
              ...previous,
              [kpiName]: {
                ...resultValue,
                target: kpiTarget?.value,
                metricType: kpi?.metricType,
                startDate: kpi?.startDate,
                endDate: kpi?.endDate,
                displayName: kpi.displayName ?? kpiName,
              },
            };
          }
        }

        return previous;
      }, {} as Record<string, UIKpiResult>);
      setKpiLatestResults(latestResults);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const { kpis, graphData } = useMemo(() => {
    return { ...getKpiGraphData(kpiResults, kpiList) };
  }, [kpiResults, kpiList]);

  useEffect(() => {
    setKpiResults([]);
    setKpiLatestResults(undefined);
  }, [selectedDays]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults().catch(() => {
        // Error handled in parent block
      });
      fetchKpiLatestResults().catch(() => {
        // Error handled in parent block
      });
    }
  }, [kpiList, selectedDays]);

  return (
    <Card
      className="kpi-widget-card h-full"
      data-testid="kpi-card"
      id="kpi-charts"
      loading={isKPIListLoading || isLoading}>
      <Row>
        <Col span={24}>
          <Typography.Text className="font-medium">
            {t('label.kpi-title')}
          </Typography.Text>
        </Col>
      </Row>
      {kpiList.length > 0 ? (
        <Row>
          {graphData.length ? (
            <>
              <Col span={14}>
                <ResponsiveContainer debounce={1} height={250} width="100%">
                  <LineChart
                    data={graphData}
                    margin={{
                      top: 10,
                      right: 50,
                      left: -20,
                      bottom: 0,
                    }}>
                    <CartesianGrid
                      stroke={GRAPH_BACKGROUND_COLOR}
                      vertical={false}
                    />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    {kpis.map((kpi, i) => (
                      <Line
                        dataKey={kpi}
                        key={kpi}
                        stroke={KPI_WIDGET_GRAPH_COLORS[i]}
                        type="monotone"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Col>
              {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
                <Col span={10}>
                  <KPILatestResultsV1
                    kpiLatestResultsRecord={kpiLatestResults}
                  />
                </Col>
              )}
            </>
          ) : (
            <Col className="justify-center" span={24}>
              <EmptyPlaceholder />
            </Col>
          )}
        </Row>
      ) : (
        <EmptyPlaceholder />
      )}
    </Card>
  );
};

export default KPIChartV1;
