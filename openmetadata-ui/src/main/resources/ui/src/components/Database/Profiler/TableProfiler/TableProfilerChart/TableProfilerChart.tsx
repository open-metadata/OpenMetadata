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

import { Box, Grid, Stack } from '@mui/material';
import { AxiosError } from 'axios';
import { pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_OPERATION_METRIC_VALUE,
  INITIAL_ROW_METRIC_VALUE,
} from '../../../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { TableProfile } from '../../../../../generated/entity/data/table';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../../hooks/useFqn';
import {
  getSystemProfileList,
  getTableProfilesList,
} from '../../../../../rest/tableAPI';
import { Transi18next } from '../../../../../utils/CommonUtils';
import documentationLinksClassBase from '../../../../../utils/DocumentationLinksClassBase';
import {
  calculateCustomMetrics,
  calculateRowCountMetrics,
  calculateSystemMetrics,
} from '../../../../../utils/TableProfilerUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import SummaryCardV1 from '../../../../common/SummaryCard/SummaryCardV1';
import CustomBarChart from '../../../../Visualisations/Chart/CustomBarChart';
import { MetricChartType } from '../../ProfilerDashboard/profilerDashboard.interface';
import ProfilerDetailsCard from '../../ProfilerDetailsCard/ProfilerDetailsCard';
import ProfilerStateWrapper from '../../ProfilerStateWrapper/ProfilerStateWrapper.component';
import CustomMetricGraphs from '../CustomMetricGraphs/CustomMetricGraphs.component';
import NoProfilerBanner from '../NoProfilerBanner/NoProfilerBanner.component';
import { TableProfilerChartProps } from '../TableProfiler.interface';
import { useTableProfiler } from '../TableProfilerProvider';

const TableProfilerChart = ({
  entityFqn = '',
  showHeader = true,
  tableDetails,
}: TableProfilerChartProps) => {
  const location = useCustomLocation();
  const {
    isProfilerDataLoading: isSummaryLoading,
    permissions,
    overallSummary,
    isProfilingEnabled,
    customMetric: tableCustomMetric,
  } = useTableProfiler();

  const { fqn: datasetFQN } = useFqn();

  const dateRangeObject = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    const startTs = searchData.startTs
      ? Number(searchData.startTs)
      : DEFAULT_RANGE_DATA.startTs;
    const endTs = searchData.endTs
      ? Number(searchData.endTs)
      : DEFAULT_RANGE_DATA.endTs;

    return {
      startTs,
      endTs,
      key: searchData.key as string,
      title: searchData.title as string,
    } as DateRangeObject;
  }, [location.search]);

  const { t } = useTranslation();
  const customMetrics = useMemo(
    () => tableDetails?.customMetrics ?? tableCustomMetric?.customMetrics ?? [],
    [tableCustomMetric, tableDetails]
  );

  const [rowCountMetrics, setRowCountMetrics] = useState<MetricChartType>(
    INITIAL_ROW_METRIC_VALUE
  );
  const [operationMetrics, setOperationMetrics] = useState<MetricChartType>(
    INITIAL_OPERATION_METRIC_VALUE
  );
  const [isTableProfilerLoading, setIsTableProfilerLoading] = useState(true);
  const [isSystemProfilerLoading, setIsSystemProfilerLoading] = useState(true);
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [profileMetrics, setProfileMetrics] = useState<TableProfile[]>([]);
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;

  const noProfilerMessage = useMemo(() => {
    return isProfilingEnabled ? (
      t('message.profiler-is-enabled-but-no-data-available')
    ) : (
      <Transi18next
        i18nKey="message.no-profiler-card-message-with-link"
        renderElement={
          <a
            href={profilerDocsLink}
            rel="noreferrer"
            target="_blank"
            title="Profiler Documentation"
          />
        }
      />
    );
  }, [isProfilingEnabled]);

  const tableCustomMetricsProfiling = useMemo(
    () => calculateCustomMetrics(profileMetrics, customMetrics),
    [profileMetrics, customMetrics]
  );

  const fetchTableProfiler = useCallback(
    async (fqn: string, dateRangeObj: DateRangeObject) => {
      setIsTableProfilerLoading(true);
      try {
        const { data } = await getTableProfilesList(fqn, dateRangeObj);
        const rowMetricsData = calculateRowCountMetrics(data, rowCountMetrics);
        setRowCountMetrics(rowMetricsData);
        setProfileMetrics(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableProfilerLoading(false);
      }
    },
    [rowCountMetrics, profileMetrics]
  );
  const fetchSystemProfiler = useCallback(
    async (fqn: string, dateRangeObj: DateRangeObject) => {
      setIsSystemProfilerLoading(true);
      try {
        const { data } = await getSystemProfileList(fqn, dateRangeObj);
        if (data.length > 0) {
          setShowSystemMetrics(true);
          const metricsData = calculateSystemMetrics(data, operationMetrics);

          setOperationMetrics(metricsData);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSystemProfilerLoading(false);
      }
    },
    [operationMetrics]
  );

  const fetchProfilerData = useCallback(
    (fqn: string, dateRangeObj: DateRangeObject) => {
      const dateRange = pick(dateRangeObj, ['startTs', 'endTs']);
      fetchTableProfiler(fqn, dateRange);
      fetchSystemProfiler(fqn, dateRange);
    },
    [fetchSystemProfiler, fetchTableProfiler]
  );

  useEffect(() => {
    if (datasetFQN || entityFqn) {
      fetchProfilerData(datasetFQN || entityFqn, dateRangeObject);
    } else {
      setIsTableProfilerLoading(false);
      setIsSystemProfilerLoading(false);
    }
  }, [datasetFQN, dateRangeObject, entityFqn]);

  if (permissions && !permissions?.ViewDataProfile) {
    return (
      <ErrorPlaceHolder
        permissionValue={t('label.view-entity', {
          entity: t('label.data-observability'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Stack
      data-testid="table-profiler-chart-container"
      spacing={!isProfilingEnabled ? '30px' : 0}>
      {showHeader && (
        <>
          {!isSummaryLoading && !isProfilingEnabled && <NoProfilerBanner />}

          <Grid container spacing={5}>
            {overallSummary?.map((summary) => (
              <Grid key={summary.title} size="grow">
                <SummaryCardV1
                  extra={summary.extra}
                  icon={summary.icon}
                  isLoading={isSummaryLoading}
                  title={summary.title}
                  value={summary.value}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
      <Stack data-testid="table-profiler-chart-container" spacing="30px">
        <Box data-testid="row-metrics">
          <ProfilerDetailsCard
            chartCollection={rowCountMetrics}
            chartType="area"
            isLoading={isTableProfilerLoading}
            name="rowCount"
            noDataPlaceholderText={noProfilerMessage}
            title={t('label.data-volume')}
          />
        </Box>
        {showSystemMetrics && (
          <ProfilerStateWrapper
            dataTestId="operation-metrics"
            isLoading={isSystemProfilerLoading}
            profilerLatestValueProps={{
              information: operationMetrics.information,
            }}
            title={t('label.volume-change')}>
            <CustomBarChart
              chartCollection={operationMetrics}
              name="operationMetrics"
              noDataPlaceholderText={noProfilerMessage}
            />
          </ProfilerStateWrapper>
        )}

        <CustomMetricGraphs
          customMetrics={customMetrics}
          customMetricsGraphData={tableCustomMetricsProfiling}
          isLoading={isTableProfilerLoading || isSummaryLoading}
        />
      </Stack>
    </Stack>
  );
};

export default TableProfilerChart;
