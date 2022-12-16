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

import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Tooltip as AntdTooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getLatestKpiResult, getListKpiResult } from '../../axiosAPIs/KpiAPI';
import { GRAPH_BACKGROUND_COLOR, ROUTES } from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DATA_INSIGHT_GRAPH_COLORS,
} from '../../constants/DataInsight.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import {
  Kpi,
  KpiResult,
  KpiTargetType,
} from '../../generated/dataInsight/kpi/kpi';
import { useAuth } from '../../hooks/authHooks';
import {
  ChartFilter,
  UIKpiResult,
} from '../../interface/data-insight.interface';
import { CustomTooltip, getKpiGraphData } from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import KPILatestResults from './KPILatestResults';

interface Props {
  chartFilter: ChartFilter;
  kpiList: Array<Kpi>;
}

const KPIChart: FC<Props> = ({ chartFilter, kpiList }) => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const history = useHistory();

  const [kpiResults, setKpiResults] = useState<KpiResult[]>([]);
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAddKpi = () => history.push(ROUTES.ADD_KPI);

  const fetchKpiResults = async () => {
    setIsLoading(true);
    try {
      const promises = kpiList.map((kpi) =>
        getListKpiResult(kpi.fullyQualifiedName ?? '', {
          startTs: chartFilter.startTs,
          endTs: chartFilter.endTs,
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
  };

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
                metricType: kpi?.metricType as KpiTargetType,
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

  const { kpis, graphData, kpiTooltipRecord } = useMemo(() => {
    const kpiTooltipRecord = kpiList.reduce((previous, curr) => {
      return { ...previous, [curr.name]: curr.metricType };
    }, {});

    return { ...getKpiGraphData(kpiResults, kpiList), kpiTooltipRecord };
  }, [kpiResults, kpiList]);

  useEffect(() => {
    setKpiResults([]);
    setKpiLatestResults(undefined);
  }, [chartFilter]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults();
      fetchKpiLatestResults();
    }
  }, [kpiList, chartFilter]);

  return (
    <Card
      className="data-insight-card"
      data-testid="kpi-card"
      id="kpi-charts"
      loading={isLoading}
      title={
        <Space className="w-full justify-between">
          <div>
            <Typography.Title level={5}>
              {t('label.kpi-title')}
            </Typography.Title>
            <Typography.Text className="data-insight-label-text">
              {t('label.kpi-subtitle')}
            </Typography.Text>
          </div>
        </Space>
      }>
      {kpiList.length ? (
        <Row>
          {graphData.length ? (
            <>
              {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
                <Col span={5}>
                  <KPILatestResults kpiLatestResultsRecord={kpiLatestResults} />
                </Col>
              )}

              <Col span={19}>
                <ResponsiveContainer debounce={1} minHeight={400}>
                  <LineChart data={graphData} margin={BAR_CHART_MARGIN}>
                    <CartesianGrid
                      stroke={GRAPH_BACKGROUND_COLOR}
                      vertical={false}
                    />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip
                      content={
                        <CustomTooltip kpiTooltipRecord={kpiTooltipRecord} />
                      }
                    />
                    {kpis.map((kpi, i) => (
                      <Line
                        dataKey={kpi}
                        key={i}
                        stroke={DATA_INSIGHT_GRAPH_COLORS[i]}
                        type="monotone"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Col>
            </>
          ) : (
            <EmptyGraphPlaceholder />
          )}
        </Row>
      ) : (
        <Space
          className="w-full justify-center items-center"
          direction="vertical">
          <Typography.Text>
            {t('message.no-kpi-available-add-new-one')}
          </Typography.Text>
          <AntdTooltip
            title={isAdminUser ? t('label.add-kpi') : NO_PERMISSION_FOR_ACTION}>
            <Button
              className="tw-border-primary tw-text-primary"
              disabled={!isAdminUser}
              type="default"
              onClick={handleAddKpi}>
              {t('label.add-kpi')}
            </Button>
          </AntdTooltip>
        </Space>
      )}
    </Card>
  );
};

export default KPIChart;
