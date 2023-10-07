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
import { isEmpty, isUndefined } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
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
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageHeader from '../../components/header/PageHeader.component';
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
import { getLatestKpiResult, getListKpiResult } from '../../rest/KpiAPI';
import { updateActiveChartFilter } from '../../utils/ChartUtils';
import {
  CustomTooltip,
  getKpiGraphData,
  renderLegend,
} from '../../utils/DataInsightUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './DataInsightDetail.less';
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
  const history = useHistory();

  const [kpiResults, setKpiResults] = useState<KpiResult[]>([]);
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

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

  const handleLegendClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };
  const handleLegendMouseEnter: LegendProps['onMouseEnter'] = (event) => {
    setActiveMouseHoverKey(event.dataKey);
  };
  const handleLegendMouseLeave: LegendProps['onMouseLeave'] = () => {
    setActiveMouseHoverKey('');
  };

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
          {graphData.length ? (
            <>
              <Col span={DI_STRUCTURE.leftContainerSpan}>
                <ResponsiveContainer
                  debounce={1}
                  id="kpi-chart"
                  minHeight={400}>
                  <LineChart data={graphData} margin={BAR_CHART_MARGIN}>
                    <CartesianGrid
                      stroke={GRAPH_BACKGROUND_COLOR}
                      vertical={false}
                    />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Legend
                      align="left"
                      content={(props) =>
                        renderLegend(props as LegendProps, activeKeys)
                      }
                      layout="horizontal"
                      verticalAlign="top"
                      wrapperStyle={{ left: '0px', top: '0px' }}
                      onClick={handleLegendClick}
                      onMouseEnter={handleLegendMouseEnter}
                      onMouseLeave={handleLegendMouseLeave}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip kpiTooltipRecord={kpiTooltipRecord} />
                      }
                    />
                    {kpis.map((kpi, i) => (
                      <Line
                        dataKey={kpi}
                        hide={
                          activeKeys.length && kpi !== activeMouseHoverKey
                            ? !activeKeys.includes(kpi)
                            : false
                        }
                        key={i}
                        stroke={DATA_INSIGHT_GRAPH_COLORS[i]}
                        strokeOpacity={
                          isEmpty(activeMouseHoverKey) ||
                          kpi === activeMouseHoverKey
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
                <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
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
            className="m-0"
            permission={createKPIPermission}
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
