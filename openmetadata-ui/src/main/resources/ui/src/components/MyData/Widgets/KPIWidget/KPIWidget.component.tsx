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

import {
  AreaChart,
  chartColor,
  ChartSeries,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, round } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as KPIIcon } from '../../../../assets/svg/entity/kpi.svg';
import { ReactComponent as KPINoDataPlaceholder } from '../../../../assets/svg/no-search-placeholder.svg';
import {
  CHART_WIDGET_DAYS_DURATION,
  ROUTES,
} from '../../../../constants/constants';
import { SIZE } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Kpi, KpiTargetType } from '../../../../generated/dataInsight/kpi/kpi';
import { DataInsightCustomChartResult } from '../../../../rest/DataInsightAPI';
import { getListKpiResult, getListKPIs } from '../../../../rest/KpiAPI';
import {
  getDataInsightTooltip,
  HIDDEN_CHART_LEGEND,
} from '../../../../utils/DataInsightChartUtils';
import {
  customFormatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import {
  buildKpiChartRows,
  getKpiLatestResults,
  getYAxisTicks,
  KpiChartRow,
} from '../../../../utils/KPI/KPIUtils';
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
  const palette = useChartPalette();
  const navigate = useNavigate();
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isKPIListLoading, setIsKPIListLoading] = useState<boolean>(true);
  const [kpiResults, setKpiResults] = useState<
    Record<string, DataInsightCustomChartResult['results']>
  >({});
  // The list is fetched with its latest results (the `kpiResult` field), so no per-KPI request.
  const kpiLatestResults = useMemo(
    () => getKpiLatestResults(kpiList),
    [kpiList]
  );
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

  const handleTitleClick = () => {
    navigate(ROUTES.KPI_LIST);
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

  const fetchKpiList = async () => {
    try {
      setIsKPIListLoading(true);
      const response = await getListKPIs({
        fields: `${TabSpecificField.DATA_INSIGHT_CHART},${TabSpecificField.KPI_RESULT}`,
      });
      setKpiList(response.data);
      if (response?.data?.length) {
        setIsLoading(true);
      }
    } catch (_err) {
      setKpiList([]);
      showErrorToast(_err as AxiosError);
    } finally {
      setIsKPIListLoading(false);
    }
  };

  // Only the upper bound is ours; ECharts picks the step so a large count does
  // not produce one label per 10.
  const domain = useMemo(
    () => (kpiResults ? getYAxisTicks(kpiResults, 10).domain : [0, 60]),
    [kpiResults]
  );

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

  const kpiTooltipValueFormatter = useCallback(
    (value: string | number, key?: string): string => {
      const isPercentage = key
        ? mapKPIMetricType[key] === KpiTargetType.Percentage
        : false;

      return isPercentage ? round(Number(value), 2) + '%' : value + '';
    },
    [mapKPIMetricType]
  );

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

  const rows = useMemo(() => buildKpiChartRows(kpiResults), [kpiResults]);

  const series = useMemo<ChartSeries[]>(
    () =>
      kpiNames.map((key, index) => ({
        key,
        name: key,
        color: chartColor(palette, index),
        showDots: true,
        seriesOption: { connectNulls: true },
      })),
    [kpiNames, palette]
  );

  const yAxis = useMemo(() => ({ min: domain[0], max: domain[1] }), [domain]);

  const xAxis = useMemo(
    () => ({
      formatter: (value: string | number) =>
        customFormatDateTime(Number(value), 'd MMM, yy'),
    }),
    []
  );

  const tooltip = useMemo(
    () =>
      getDataInsightTooltip<KpiChartRow>({
        timeKey: 'day',
        valueFormatter: kpiTooltipValueFormatter,
        className: 'tw:max-h-[350px] tw:max-w-[300px] tw:overflow-auto',
      }),
    [kpiTooltipValueFormatter]
  );

  const kpiChartData = useMemo(() => {
    return (
      <Row className="p-t-sm p-x-md" gutter={[16, 16]}>
        <Col span={isFullSizeWidget ? 16 : 24}>
          <AreaChart<KpiChartRow>
            ariaLabel={t('label.kpi-title')}
            data={rows}
            data-testid="kpi-widget-chart"
            height={350}
            legend={HIDDEN_CHART_LEGEND}
            series={series}
            tooltip={tooltip}
            xAxis={xAxis}
            xKey="day"
            yAxis={yAxis}
          />
        </Col>

        {!isEmpty(kpiLatestResults) && isFullSizeWidget && (
          <Col className="h-full" span={8}>
            <KPILegend isFullSize kpiLatestResultsRecord={kpiLatestResults} />
          </Col>
        )}
      </Row>
    );
  }, [
    isFullSizeWidget,
    kpiLatestResults,
    rows,
    series,
    t,
    tooltip,
    xAxis,
    yAxis,
  ]);

  useEffect(() => {
    fetchKpiList().catch(() => {
      // catch handled in parent function
    });
  }, []);

  useEffect(() => {
    setKpiResults({});
  }, [selectedDays]);

  useEffect(() => {
    if (kpiList.length) {
      fetchKpiResults();
    }
  }, [kpiList, selectedDays]);

  const widgetHeader = useMemo(
    () => (
      <WidgetHeader
        className="items-center"
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<KPIIcon className="kpi-widget-icon" height={24} width={24} />}
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
      loading={isKPIListLoading || isLoading}>
      <div className="kpi-widget-container" data-testid="kpi-widget">
        <div className="widget-content flex-1 h-full">
          {isEmpty(kpiList) || isEmpty(kpiResults) ? emptyState : kpiChartData}
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default KPIWidget;
