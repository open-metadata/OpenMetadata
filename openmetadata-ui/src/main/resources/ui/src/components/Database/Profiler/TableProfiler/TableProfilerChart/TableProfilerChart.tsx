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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_OPERATION_METRIC_VALUE,
  INITIAL_ROW_METRIC_VALUE,
} from '../../../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import { TableProfile } from '../../../../../generated/entity/data/table';
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
import { SummaryCard } from '../../../../common/SummaryCard/SummaryCard.component';
import CustomBarChart from '../../../../Visualisations/Chart/CustomBarChart';
import OperationDateBarChart from '../../../../Visualisations/Chart/OperationDateBarChart';
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
  const {
    isProfilerDataLoading: isSummaryLoading,
    permissions,
    overallSummary,
    isProfilingEnabled,
    customMetric: tableCustomMetric,
    dateRangeObject = DEFAULT_RANGE_DATA,
  } = useTableProfiler();

  const { fqn: datasetFQN } = useFqn();

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
  const [operationDateMetrics, setOperationDateMetrics] =
    useState<MetricChartType>(INITIAL_OPERATION_METRIC_VALUE);
  const [isTableProfilerLoading, setIsTableProfilerLoading] = useState(true);
  const [isSystemProfilerLoading, setIsSystemProfilerLoading] = useState(true);
  const [showSystemMetrics, setshowSystemMetrics] = useState(false);
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
          setshowSystemMetrics(true);
          const { operationMetrics: metricsData, operationDateMetrics } =
            calculateSystemMetrics(data, operationMetrics);

          setOperationDateMetrics(operationDateMetrics);
          setOperationMetrics(metricsData);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSystemProfilerLoading(false);
      }
    },
    [operationMetrics, operationDateMetrics]
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

  const operationDateMetricsCard = useMemo(() => {
    return (
      <ProfilerStateWrapper
        dataTestId="operation-date-metrics"
        isLoading={isSystemProfilerLoading}
        profilerLatestValueProps={{
          information: operationDateMetrics.information,
          stringValue: true,
        }}
        title={t('label.table-update-plural')}>
        <OperationDateBarChart
          chartCollection={operationDateMetrics}
          name="operationDateMetrics"
          noDataPlaceholderText={noProfilerMessage}
        />
      </ProfilerStateWrapper>
    );
  }, [isSystemProfilerLoading, operationDateMetrics, noProfilerMessage]);

  const operationMetricsCard = useMemo(() => {
    return (
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
    );
  }, [isSystemProfilerLoading, operationMetrics, noProfilerMessage]);

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
    <Row data-testid="table-profiler-chart-container" gutter={[16, 16]}>
      {showHeader && (
        <>
          {!isSummaryLoading && !isProfilingEnabled && (
            <Col span={24}>
              <NoProfilerBanner />
            </Col>
          )}
          <Col span={24}>
            <NoProfilerBanner />
          </Col>
          <Col span={24}>
            <Row wrap className="justify-between" gutter={[16, 16]}>
              {overallSummary?.map((summary) => (
                <Col key={summary.title}>
                  <SummaryCard
                    className={classNames(summary.className, 'h-full')}
                    isLoading={isSummaryLoading}
                    showProgressBar={false}
                    title={summary.title}
                    total={0}
                    value={summary.value}
                  />
                </Col>
              ))}
            </Row>
          </Col>
        </>
      )}
      <Col data-testid="row-metrics" span={24}>
        <ProfilerDetailsCard
          chartCollection={rowCountMetrics}
          curveType="stepAfter"
          isLoading={isTableProfilerLoading}
          name="rowCount"
          noDataPlaceholderText={noProfilerMessage}
          title={t('label.data-volume')}
        />
      </Col>
      {showSystemMetrics && (
        <>
          <Col span={24}>{operationDateMetricsCard}</Col>
          <Col span={24}>{operationMetricsCard}</Col>
        </>
      )}
      <Col span={24}>
        <CustomMetricGraphs
          customMetrics={customMetrics}
          customMetricsGraphData={tableCustomMetricsProfiling}
          isLoading={isTableProfilerLoading || isSummaryLoading}
        />
      </Col>
    </Row>
  );
};

export default TableProfilerChart;
