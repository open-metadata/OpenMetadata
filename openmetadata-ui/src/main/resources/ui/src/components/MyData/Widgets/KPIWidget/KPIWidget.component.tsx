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
import { isEmpty, isUndefined, round } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as KPIIcon } from '../../../../assets/svg/ic-kpi-widget.svg';
import { ReactComponent as KPINoDataPlaceholder } from '../../../../assets/svg/no-search-placeholder.svg';
import {
  CHART_WIDGET_DAYS_DURATION,
  ROUTES,
} from '../../../../constants/constants';
import { KPI_WIDGET_GRAPH_COLORS } from '../../../../constants/Widgets.constant';
import { SIZE } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import {
  Kpi,
  KpiResult,
  KpiTargetType,
} from '../../../../generated/dataInsight/kpi/kpi';
import { useDashboardWidgetData } from '../../../../hooks/useDashboardWidgetData';
import { UIKpiResult } from '../../../../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../../../../rest/DataInsightAPI';
import {
  getLatestKpiResult,
  getListKpiResult,
  getListKPIs,
} from '../../../../rest/KpiAPI';
import { CustomTooltip } from '../../../../utils/DataInsightChartUtils';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { getYAxisTicks } from '../../../../utils/KPI/KPIUtils';
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
  const navigate = useNavigate();

  const widgetData = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const isFullSizeWidget = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey)?.w === 2;
  }, [currentLayout, widgetKey]);

  const customTooltipStyles = useMemo(
    () => ({
      cardStyles: {
        maxWidth: '300px',
        maxHeight: '350px',
        overflow: 'auto',
      },
      labelStyles: {
        maxWidth: '160px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
      },
      listContainerStyles: {
        padding: '4px 12px',
      },
    }),
    []
  );

  const handleTitleClick = () => {
    navigate(ROUTES.KPI_LIST);
  };

  const fetchKpiList = useCallback(async () => {
    try {
      const response = await getListKPIs({
        fields: TabSpecificField.DATA_INSIGHT_CHART,
      });

      return response.data;
    } catch (_err) {
      showErrorToast(_err as AxiosError);

      throw _err;
    }
  }, []);

  const { data: kpiList, isLoading: isKPIListLoading } = useDashboardWidgetData<
    Array<Kpi>
  >({
    cacheKey: 'my-data:kpi-list',
    fetcher: fetchKpiList,
    initialData: [],
  });

  const kpiCacheKey = useMemo(
    () =>
      kpiList
        .map((kpi) => kpi.fullyQualifiedName ?? kpi.name)
        .sort()
        .join(','),
    [kpiList]
  );

  const fetchKpiResults = useCallback(async () => {
    try {
      const promises = kpiList.map(async (kpi) => {
        const response = await getListKpiResult(kpi.fullyQualifiedName ?? '', {
          startTs: getEpochMillisForPastDays(selectedDays),
          endTs: getCurrentMillis(),
        });

        return { name: kpi.name, data: response.results };
      });
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

      return kpiResultsList;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  }, [kpiList, selectedDays]);

  const fetchKpiLatestResults = useCallback(async () => {
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

      return latestResults;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  }, [kpiList]);

  const { data: kpiResults, isLoading: isKPIResultsLoading } =
    useDashboardWidgetData<
      Record<string, DataInsightCustomChartResult['results']>
    >({
      cacheKey: `my-data:kpi-results:${selectedDays}:${kpiCacheKey}`,
      enabled: kpiList.length > 0,
      fetcher: fetchKpiResults,
      initialData: {},
    });

  const { data: kpiLatestResults, isLoading: isKpiLatestResultsLoading } =
    useDashboardWidgetData<Record<string, UIKpiResult>>({
      cacheKey: `my-data:kpi-latest-results:${kpiCacheKey}`,
      enabled: kpiList.length > 0,
      fetcher: fetchKpiLatestResults,
      initialData: {},
    });

  const { domain, ticks } = useMemo(() => {
    if (kpiResults) {
      return getYAxisTicks(kpiResults, 10);
    }

    return { domain: [0, 60], ticks: [0, 15, 30, 45, 60] };
  }, [kpiResults]);

  const kpiNames = useMemo(() => Object.keys(kpiResults), [kpiResults]);

  const mapKPIMetricType = useMemo(() => {
    return kpiList.reduce(
      (acc, kpi) => {
        acc[kpi.fullyQualifiedName ?? ''] = kpi.metricType;

        return acc;
      },

      {} as Record<string, KpiTargetType>
    );
  }, [kpiList]);

  const kpiTooltipValueFormatter = (
    value: string | number,
    key?: string
  ): string => {
    const isPercentage = key
      ? mapKPIMetricType[key] === KpiTargetType.Percentage
      : false;

    return isPercentage ? round(Number(value), 2) + '%' : value + '';
  };

  const emptyState = useMemo(
    () => (
      <WidgetEmptyState
        actionButtonLink={ROUTES.KPI_LIST}
        actionButtonText={t('label.set-up-kpi')}
        description={t('message.no-kpi')}
        icon={<KPINoDataPlaceholder height={SIZE.MEDIUM} width={SIZE.MEDIUM} />}
        title={t('label.no-kpis-yet')}
      />
    ),
    [t]
  );

  // Consolidate data for proper tooltip display
  const consolidatedChartData = useMemo(() => {
    if (!kpiResults || isEmpty(kpiResults)) {
      return [];
    }

    const allDays = new Set<number>();
    Object.values(kpiResults).forEach((data) => {
      data.forEach((point) => allDays.add(point.day));
    });

    return Array.from(allDays)
      .sort()
      .map((day) => {
        const dataPoint: Record<string, number> = { day };

        kpiNames.forEach((kpiName) => {
          const kpiData = kpiResults[kpiName];
          const dayData = kpiData?.find((d) => d.day === day);

          dataPoint[kpiName] = dayData?.count || 0;
        });

        return dataPoint;
      });
  }, [kpiResults, kpiNames]);

  const kpiChartData = useMemo(() => {
    return (
      <Row className="p-t-sm p-x-md" gutter={[16, 16]}>
        <Col span={isFullSizeWidget ? 16 : 24}>
          <ResponsiveContainer debounce={1} height={350} width="100%">
            <AreaChart
              data={consolidatedChartData}
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

              <Tooltip
                content={
                  <CustomTooltip
                    {...customTooltipStyles}
                    timeStampKey="day"
                    valueFormatter={kpiTooltipValueFormatter}
                  />
                }
              />

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
                  customFormatDateTime(value, 'd MMM, yy')
                }
                tickLine={false}
                tickMargin={10}
                type="category"
              />

              <YAxis
                axisLine={{
                  stroke: '#E4E6EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                domain={domain}
                padding={{ top: 0, bottom: 0 }}
                tick={{ fill: '#888', fontSize: 12 }}
                tickLine={{
                  stroke: '#E4E6EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                ticks={ticks}
              />

              {kpiNames.map((key, i) => (
                <Area
                  activeDot={{
                    r: 5,
                    fill: KPI_WIDGET_GRAPH_COLORS[i],
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                  dataKey={key}
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

        {!isUndefined(kpiLatestResults) &&
          !isEmpty(kpiLatestResults) &&
          isFullSizeWidget && (
            <Col className="h-full" span={8}>
              <KPILegend isFullSize kpiLatestResultsRecord={kpiLatestResults} />
            </Col>
          )}
      </Row>
    );
  }, [
    consolidatedChartData,
    kpiNames,
    isFullSizeWidget,
    domain,
    ticks,
    kpiLatestResults,
    kpiTooltipValueFormatter,
  ]);

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        className="items-center"
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<KPIIcon className="kpi-widget-icon" height={22} width={22} />}
        isEditView={isEditView}
        title={widgetData?.w === 2 ? t('label.kpi-title') : t('label.kpi')}
        widgetKey={widgetKey}
        onTitleClick={handleTitleClick}
      />
    ),
    [
      currentLayout,
      handleLayoutUpdate,
      handleRemoveWidget,
      isEditView,
      t,
      widgetKey,
      widgetData?.w,
      handleTitleClick,
    ]
  );

  return (
    <WidgetWrapper
      dataLength={kpiList.length > 0 ? kpiList.length : 10}
      dataTestId="KnowledgePanel.KPI"
      header={widgetHeader}
      loading={
        isKPIListLoading || isKPIResultsLoading || isKpiLatestResultsLoading
      }>
      <div className="kpi-widget-container" data-testid="kpi-widget">
        <div className="widget-content flex-1 h-full">
          {isEmpty(kpiList) || isEmpty(kpiResults) ? emptyState : kpiChartData}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default KPIWidget;
