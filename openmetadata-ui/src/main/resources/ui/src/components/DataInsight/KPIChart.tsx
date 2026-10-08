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
import { Box, Grid } from '@openmetadata/ui-core-components';
import {
  chartColor,
  ChartSeries,
  LineChart,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';
import { Button, Card } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, round } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import {
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
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getDataInsightTooltip } from '../../utils/DataInsightChartUtils';
import { formatDate } from '../../utils/date-time/DateTimeUtils';
import { buildKpiChartRows, KpiChartRow } from '../../utils/KPI/KPIUtils';
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
  const palette = useChartPalette();

  const [kpiResults, setKpiResults] = useState<
    Record<string, DataInsightCustomChartResult['results']>
  >({});
  const [kpiLatestResults, setKpiLatestResults] =
    useState<Record<string, UIKpiResult>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const rows = useMemo(() => buildKpiChartRows(kpiResults), [kpiResults]);

  const series = useMemo<ChartSeries[]>(
    () =>
      kpiNames.map((key, index) => ({
        key,
        name: key,
        color: chartColor(palette, index),
        seriesOption: { connectNulls: true, emphasis: { focus: 'series' } },
      })),
    [kpiNames, palette]
  );

  const tooltip = useMemo(
    () =>
      getDataInsightTooltip<KpiChartRow>({
        timeKey: 'day',
        valueFormatter: (value, key) =>
          key && mapKPIMetricType[key] === KpiTargetType.Percentage
            ? round(Number(value), 2) + '%'
            : value + '',
      }),
    [mapKPIMetricType]
  );

  const xAxis = useMemo(
    () => ({
      formatter: (value: string | number) => formatDate(Number(value)),
    }),
    []
  );

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
        <Grid className="layout-row layout-grid" style={getLayoutGutter(32)}>
          {hasAtLeastOneData ? (
            <>
              <Grid.Item
                className="layout-column"
                span={DI_STRUCTURE.leftContainerSpan}>
                <div id="kpi-chart">
                  <LineChart<KpiChartRow>
                    ariaLabel={t('label.kpi-title')}
                    data={rows}
                    height={GRAPH_HEIGHT}
                    series={series}
                    tooltip={tooltip}
                    xAxis={xAxis}
                    xKey="day"
                  />
                </div>
              </Grid.Item>
              {!isUndefined(kpiLatestResults) && !isEmpty(kpiLatestResults) && (
                <Grid.Item
                  className="layout-column"
                  span={DI_STRUCTURE.rightContainerSpan}>
                  <KPILatestResultsV1
                    kpiLatestResultsRecord={kpiLatestResults}
                  />
                </Grid.Item>
              )}
            </>
          ) : (
            <Grid.Item className="layout-column justify-center" span={24}>
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
            </Grid.Item>
          )}
        </Grid>
      ) : (
        <Box
          inline
          align="stretch"
          className="layout-space w-full justify-center items-center"
          direction="col"
          gap={2}
          itemClassName="layout-space-item">
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
        </Box>
      )}
    </Card>
  );
};

export default KPIChart;
