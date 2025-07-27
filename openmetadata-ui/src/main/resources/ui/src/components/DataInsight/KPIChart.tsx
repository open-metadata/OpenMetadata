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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, round } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  LegendProps,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  HOVER_CHART_OPACITY,
  ROUTES,
} from '../../constants/constants';
import {
  BAR_CHART_MARGIN,
  DATA_INSIGHT_GRAPH_COLORS,
  DI_STRUCTURE,
  GRAPH_HEIGHT,
} from '../../constants/DataInsight.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import {
  Kpi,
  KpiResult,
  KpiTargetType,
} from '../../generated/dataInsight/kpi/kpi';
import {
  ChartFilter,
  UIKpiResult,
} from '../../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../../rest/DataInsightAPI';
import { getLatestKpiResult, getListKpiResult } from '../../rest/KpiAPI';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import { CustomTooltip, renderLegend } from '../../utils/DataInsightUtils';
import { formatDate } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import PageHeader from '../PageHeader/PageHeader.component';
import './data-insight-detail.less';
import { EmptyGraphPlaceholder } from './EmptyGraphPlaceholder';
import KPILatestResultsV1 from './KPILatestResultsV1';

interface Props {
  chartFilter: ChartFilter;
  kpiList: Array<Kpi>;
  isKpiLoading: boolean;
  viewKPIPermission: boolean;
  createKPIPermission: boolean;
}

const KPIChart: FC<Props> = ({
  chartFilter,
  kpiList,
  viewKPIPermission,
  createKPIPermission,
  isKpiLoading,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [kpiResults, setKpiResults] = useState<
    Record<string, DataInsightCustomChartResult['results']>
  >({});
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

  const handleAddKpi = () => navigate(ROUTES.ADD_KPI);

  const getKPIResult = async (kpi: Kpi) => {
    const response = await getListKpiResult(kpi.fullyQualifiedName ?? '', {
      startTs: chartFilter.startTs,
      endTs: chartFilter.endTs,
    });

    return { name: kpi.name, data: response.results };
  };

  const fetchKpiResults = async () => {
    setIsLoading(true);
    try {
      const promises = kpiList.map(getKPIResult);
      const responses = await Promise.allSettled(promises);
      const kpiResultsList: Record<
        string,
        DataInsightCustomChartResult['results']
      > = {};

      responses.forEach((response) => {
        if (response.status === 'fulfilled') {
          kpiResultsList[response.value.name] = response.value.data;
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
          const kpiTarget = kpi?.targetValue;

          if (!isUndefined(kpi) && !isUndefined(kpiTarget)) {
            return {
              ...previous,
              [kpiName]: {
                ...resultValue,
                target: kpiTarget,
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

  const handleLegendClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.value, prevActiveKeys)
    );
  };
  const handleLegendMouseEnter: LegendProps['onMouseEnter'] = (event) => {
    setActiveMouseHoverKey(event.value);
  };
  const handleLegendMouseLeave: LegendProps['onMouseLeave'] = () => {
    setActiveMouseHoverKey('');
  };

  const mapKPIMetricType = useMemo(() => {
    return kpiList.reduce(
      (acc, kpi) => {
        acc[kpi.fullyQualifiedName ?? ''] = kpi.metricType;

        return acc;
      },

      {} as Record<string, KpiTargetType>
    );
  }, [kpiList]);

  const kpiNames = useMemo(() => Object.keys(kpiResults), [kpiResults]);

  const kpiTooltipValueFormatter = (
    value: string | number,
    key?: string
  ): string => {
    const isPercentage = key
      ? mapKPIMetricType[key] === KpiTargetType.Percentage
      : KpiTargetType.Number;

    return isPercentage ? round(Number(value), 2) + '%' : value + '';
  };

  useEffect(() => {
    setKpiResults({});
    setKpiLatestResults(undefined);
  }, [chartFilter]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults();
      fetchKpiLatestResults();
    }
  }, [kpiList, chartFilter]);

  const hasAtLeastOneData = useMemo(() => {
    return kpiNames.some(
      (key) => kpiResults[key] && kpiResults[key].length > 0
    );
  }, [kpiNames, kpiResults]);

  return (
    <Card
      className="data-insight-card data-insight-card-chart"
      data-testid="kpi-card"
      id="kpi-charts"
      loading={isLoading || isKpiLoading}
      title={
        <PageHeader
          data={{
            header: t('label.kpi-title'),
            subHeader: t('message.kpi-subtitle'),
          }}
        />
      }>
      {kpiList.length ? (
        <Row gutter={DI_STRUCTURE.rowContainerGutter}>
          {hasAtLeastOneData ? (
            <>
              <Col span={DI_STRUCTURE.leftContainerSpan}>
                <ResponsiveContainer
                  debounce={1}
                  height={GRAPH_HEIGHT}
                  id="kpi-chart">
                  <LineChart margin={BAR_CHART_MARGIN}>
                    <CartesianGrid
                      stroke={GRAPH_BACKGROUND_COLOR}
                      vertical={false}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          timeStampKey="day"
                          valueFormatter={kpiTooltipValueFormatter}
                        />
                      }
                    />
                    <XAxis
                      allowDuplicatedCategory={false}
                      dataKey="day"
                      tickFormatter={(value) => formatDate(value)}
                      type="category"
                    />
                    <YAxis dataKey="count" />
                    <Legend
                      align="left"
                      content={(props) =>
                        renderLegend(props as LegendProps, activeKeys)
                      }
                      key="name"
                      layout="horizontal"
                      verticalAlign="top"
                      wrapperStyle={{ left: '0px', top: '0px' }}
                      onClick={handleLegendClick}
                      onMouseEnter={handleLegendMouseEnter}
                      onMouseLeave={handleLegendMouseLeave}
                    />

                    {kpiNames.map((key, i) => (
                      <Line
                        data={kpiResults[key]}
                        dataKey="count"
                        hide={
                          activeKeys.length && key !== activeMouseHoverKey
                            ? !activeKeys.includes(key)
                            : false
                        }
                        key={key}
                        name={key}
                        stroke={DATA_INSIGHT_GRAPH_COLORS[i]}
                        strokeOpacity={
                          isEmpty(activeMouseHoverKey) ||
                          key === activeMouseHoverKey
                            ? DEFAULT_CHART_OPACITY
                            : HOVER_CHART_OPACITY
                        }
                        type="monotone"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Col>
              {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
                <Col span={DI_STRUCTURE.rightContainerSpan}>
                  <KPILatestResultsV1
                    kpiLatestResultsRecord={kpiLatestResults}
                  />
                </Col>
              )}
            </>
          ) : (
            <Col className="justify-center" span={24}>
              {viewKPIPermission ? (
                <EmptyGraphPlaceholder />
              ) : (
                <ErrorPlaceHolder
                  className="border-none"
                  permissionValue={t('label.view-entity', {
                    entity: t('label.kpi-uppercase'),
                  })}
                  type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
                />
              )}
            </Col>
          )}
        </Row>
      ) : (
        <Space
          className="w-full justify-center items-center"
          direction="vertical">
          <ErrorPlaceHolder
            button={
              <Button
                ghost
                icon={<PlusOutlined />}
                type="primary"
                onClick={handleAddKpi}>
                {t('label.add-entity', {
                  entity: t('label.kpi-uppercase'),
                })}
              </Button>
            }
            className="m-0 border-none"
            permission={createKPIPermission}
            permissionValue={t('label.create-entity', {
              entity: t('label.kpi-uppercase'),
            })}
            size={SIZE.MEDIUM}
            type={
              createKPIPermission
                ? ERROR_PLACEHOLDER_TYPE.ASSIGN
                : ERROR_PLACEHOLDER_TYPE.NO_DATA
            }>
            {createKPIPermission && t('message.no-kpi-available-add-new-one')}
          </ErrorPlaceHolder>
        </Space>
      )}
    </Card>
  );
};

export default KPIChart;
