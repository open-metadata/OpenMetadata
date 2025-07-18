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
import { useEffect, useMemo, useState } from 'react';
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
import { KPI_WIDGET_GRAPH_COLORS } from '../../../../constants/Widgets.constant';
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
import WidgetEmptyState from '../Common/WidgetEmptyState/WidgetEmptyState';
import WidgetHeader from '../Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from '../Common/WidgetWrapper/WidgetWrapper';
import './kpi-widget.less';
import KPILegend from './KPILegend/KPILegend';
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
  const [isKPIListLoading, setIsKPIListLoading] = useState<boolean>(true);
  const [kpiResults, setKpiResults] = useState<
    Record<string, DataInsightCustomChartResult['results']>
  >({});
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const widgetData = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const isFullSizeWidget = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey)?.w === 2;
  }, [currentLayout, widgetKey]);

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

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink="/data-insights/kpi"
        actionButtonText={t('label.explore-metric-plural')}
        description={t('message.no-kpi')}
        icon={<KPINoDataPlaceholder height={SIZE.LARGE} width={SIZE.LARGE} />}
        title={t('label.no-kpis-yet')}
      />
    ),
    [t]
  );

  const kpiChartData = useMemo(() => {
    return (
      <Row className="p-t-sm p-x-md">
        {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
          <Col className="m-b-sm" span={24}>
            <KPILegend
              isFullSize={isFullSizeWidget}
              kpiLatestResultsRecord={kpiLatestResults}
            />
          </Col>
        )}

        <Col span={24}>
          <ResponsiveContainer debounce={1} height={280} width="100%">
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
                      stopColor={KPI_WIDGET_GRAPH_COLORS[i]}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={KPI_WIDGET_GRAPH_COLORS[i]}
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
                domain={[0, 60]}
                padding={{ top: 0, bottom: 0 }}
                tick={{ fill: '#888', fontSize: 12 }}
                tickLine={{
                  stroke: '#E4E6EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                ticks={[0, 15, 30, 45, 60]}
              />

              {kpiNames.map((key, i) => (
                <Area
                  activeDot={{
                    r: 5,
                    fill: KPI_WIDGET_GRAPH_COLORS[i],
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  data={kpiResults[key]}
                  dataKey="count"
                  dot={{
                    stroke: KPI_WIDGET_GRAPH_COLORS[i],
                    strokeWidth: 2,
                    fill: KPI_WIDGET_GRAPH_COLORS[i],
                    r: 4,
                  }}
                  fill={`url(#gradient-${key})`}
                  key={key}
                  stroke={KPI_WIDGET_GRAPH_COLORS[i]}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Col>
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
      dataLength={kpiList.length > 0 ? kpiList.length : 10}
      loading={isKPIListLoading || isLoading}>
      <div className="kpi-widget-container">
        <WidgetHeader
          className="items-center"
          currentLayout={currentLayout}
          handleLayoutUpdate={handleLayoutUpdate}
          handleRemoveWidget={handleRemoveWidget}
          icon={<KPIIcon className="kpi-widget-icon" height={24} width={24} />}
          isEditView={isEditView}
          title={t('label.kpi-title')}
          widgetKey={widgetKey}
          widgetWidth={widgetData?.w}
        />
        <div className="widget-content flex-1 h-full">
          {isEmpty(kpiList) || isEmpty(kpiResults) ? emptyState : kpiChartData}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default KPIWidget;
