/*
 *  Copyright 2023 Collate.
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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as KPIIcon } from '../../../../assets/svg/ic-kpi-widget.svg';
import { ReactComponent as KPINoDataPlaceholder } from '../../../../assets/svg/no-search-placeholder.svg';
import { CHART_WIDGET_DAYS_DURATION } from '../../../../constants/constants';
import { DATA_INSIGHT_GRAPH_COLORS } from '../../../../constants/DataInsight.constants';
import { SIZE } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Kpi, KpiResult } from '../../../../generated/dataInsight/kpi/kpi';
import { UIKpiResult } from '../../../../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../../../../rest/DataInsightAPI';
import {
  getLatestKpiResult,
  getListKpiResult,
  getListKPIs,
} from '../../../../rest/KpiAPI';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import KPILatestResultsV1 from '../../../DataInsight/KPILatestResultsV1';
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './kpi-widget.less';
import {
  KPI_SORT_BY_KEYS,
  KPI_SORT_BY_OPTIONS,
  KPI_WIDGET_Y_AXIS_TICKS,
} from './KPIWidget.constants';
import { KPIWidgetProps } from './KPIWidget.interface';

const KPIWidget = ({
  isEditView = false,
  selectedDays = CHART_WIDGET_DAYS_DURATION,
  handleRemoveWidget,
  widgetKey,
  currentLayout,
  handleLayoutUpdate,
}: KPIWidgetProps) => {
  const { t } = useTranslation();
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isKPIListLoading, setIsKPIListLoading] = useState<boolean>(false);
  const [kpiResults, setKpiResults] = useState<
    Record<string, DataInsightCustomChartResult['results']>
  >({});
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedSortBy, setSelectedSortBy] = useState<string>(
    KPI_SORT_BY_KEYS.MONTHLY
  );

  const getKPIResult = async (kpi: Kpi) => {
    const response = await getListKpiResult(kpi.fullyQualifiedName ?? '', {
      startTs: getEpochMillisForPastDays(selectedDays),
      endTs: getCurrentMillis(),
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

  const fetchKpiList = async () => {
    try {
      setIsKPIListLoading(true);
      const response = await getListKPIs({
        fields: TabSpecificField.DATA_INSIGHT_CHART,
      });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
      showErrorToast(_err as AxiosError);
    } finally {
      setIsKPIListLoading(false);
    }
  };

  const kpiNames = useMemo(() => Object.keys(kpiResults), [kpiResults]);

  const handleSortByClick = useCallback((key: string) => {
    setSelectedSortBy(key);
  }, []);

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink="/data-insights/kpi"
        actionButtonText="Explore KPI"
        description={t('message.no-kpi')}
        icon={<KPINoDataPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />}
        title={t('label.no-kpis-yet')}
      />
    ),
    [t]
  );

  const kpiChartData = useMemo(() => {
    return (
      <Row className="p-t-md p-x-md">
        <Col className="kpi-chart-legend m-b-sm" span={24}>
          <div className="d-flex gap-4 flex-wrap justify-center">
            {kpiNames.map((key, i) => (
              <div className="d-flex items-center gap-1 " key={key}>
                <span
                  className="h-2 w-2 d-inline-block"
                  style={{
                    borderRadius: '50%',
                    backgroundColor: DATA_INSIGHT_GRAPH_COLORS[i],
                  }}
                />
                <span className="font-regular text-xs">{key}</span>
              </div>
            ))}
          </div>
        </Col>

        <Col span={24}>
          <ResponsiveContainer debounce={1} height={300} width="100%">
            <AreaChart
              margin={{
                top: 10,
                right: 30,
                left: -30,
                bottom: 0,
              }}>
              <defs>
                {kpiNames.map((key, i) => (
                  <linearGradient
                    id={`gradient-${key}`}
                    key={key}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1">
                    <stop
                      offset="0%"
                      stopColor={DATA_INSIGHT_GRAPH_COLORS[i]}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={DATA_INSIGHT_GRAPH_COLORS[i]}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                stroke="#E4E6EB"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                allowDuplicatedCategory={false}
                axisLine={false}
                dataKey="day"
                interval="preserveStartEnd"
                tick={{ fill: '#888', fontSize: 12 }}
                tickFormatter={(value: number) =>
                  customFormatDateTime(value, 'dMMM, yy')
                }
                tickLine={false}
                type="category"
              />

              <YAxis
                axisLine={{
                  stroke: '#E4E6EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                dataKey="count"
                domain={[0, 36]}
                padding={{ top: 0, bottom: 0 }}
                tick={{ fill: '#888', fontSize: 12 }}
                tickLine={{
                  stroke: '#E4E6EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                ticks={KPI_WIDGET_Y_AXIS_TICKS}
              />

              {kpiNames.map((key, i) => (
                <Area
                  activeDot={{
                    r: 5,
                    fill: DATA_INSIGHT_GRAPH_COLORS[i],
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  data={kpiResults[key]}
                  dataKey="count"
                  dot={{
                    stroke: DATA_INSIGHT_GRAPH_COLORS[i],
                    strokeWidth: 2,
                    fill: DATA_INSIGHT_GRAPH_COLORS[i],
                    r: 4,
                  }}
                  fill={`url(#gradient-${key})`}
                  key={key}
                  stroke={DATA_INSIGHT_GRAPH_COLORS[i]}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Col>
        {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
          <Col span={24}>
            <KPILatestResultsV1 kpiLatestResultsRecord={kpiLatestResults} />
          </Col>
        )}
      </Row>
    );
  }, [kpiResults, kpiLatestResults, kpiNames]);

  useEffect(() => {
    fetchKpiList().catch(() => {
      // catch handled in parent function
    });
  }, []);

  useEffect(() => {
    setKpiResults({});
    setKpiLatestResults(undefined);
  }, [selectedDays]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults();
      fetchKpiLatestResults();
    }
  }, [kpiList, selectedDays]);

  return (
    <WidgetWrapper
      dataLength={kpiList.length}
      loading={isKPIListLoading || isLoading}>
      <div className="kpi-widget-container">
        <WidgetHeader
          className="items-center"
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<KPIIcon className="kpi-widget-icon" />}
          isEditView={isEditView}
          selectedSortBy={selectedSortBy}
          sortOptions={KPI_SORT_BY_OPTIONS}
          title={t('label.kpi-title')}
          widgetKey={widgetKey}
          widgetWidth={2}
          onSortChange={handleSortByClick}
        />
        <div className="widget-content flex-1">
          {isEmpty(kpiList) || isEmpty(kpiResults) ? emptyState : kpiChartData}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default KPIWidget;
