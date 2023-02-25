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

import { Card, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSystemProfileList, getTableProfilesList } from 'rest/tableAPI';
import {
  INITIAL_OPERATION_METRIC_VALUE,
  INITIAL_ROW_METRIC_VALUE,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
import {
  calculateRowCountMetrics,
  calculateSystemMetrics,
} from '../../../utils/TableProfilerUtils';
import {
  getCurrentDateTimeMillis,
  getCurrentDateTimeStamp,
  getPastDatesTimeStampFromCurrentDate,
  getPastDaysDateTimeMillis,
} from '../../../utils/TimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CustomBarChart from '../../Chart/CustomBarChart';
import OperationDateBarChart from '../../Chart/OperationDateBarChart';
import Loader from '../../Loader/Loader';
import ProfilerDetailsCard from '../../ProfilerDashboard/component/ProfilerDetailsCard';
import ProfilerLatestValue from '../../ProfilerDashboard/component/ProfilerLatestValue';
import { MetricChartType } from '../../ProfilerDashboard/profilerDashboard.interface';
import { TableProfilerChartProps } from '../TableProfiler.interface';

const TableProfilerChart = ({ selectedTimeRange }: TableProfilerChartProps) => {
  const { datasetFQN } = useParams<{ datasetFQN: string }>();

  const [rowCountMetrics, setRowCountMetrics] = useState<MetricChartType>(
    INITIAL_ROW_METRIC_VALUE
  );
  const [operationMetrics, setOperationMetrics] = useState<MetricChartType>(
    INITIAL_OPERATION_METRIC_VALUE
  );
  const [operationDateMetrics, setOperationDateMetrics] =
    useState<MetricChartType>(INITIAL_OPERATION_METRIC_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTableProfiler = async (fqn: string, days = 3) => {
    try {
      const startTs = getPastDatesTimeStampFromCurrentDate(days);
      const endTs = getCurrentDateTimeStamp();
      const { data } = await getTableProfilesList(fqn, {
        startTs,
        endTs,
      });
      const rowMetricsData = calculateRowCountMetrics(data, rowCountMetrics);
      setRowCountMetrics(rowMetricsData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchSystemProfiler = async (fqn: string, days = 3) => {
    try {
      const startTs = getPastDaysDateTimeMillis(days);
      const endTs = getCurrentDateTimeMillis();
      const { data } = await getSystemProfileList(fqn, {
        startTs,
        endTs,
      });
      const { operationMetrics: metricsData, operationDateMetrics } =
        calculateSystemMetrics(data, operationMetrics);

      setOperationDateMetrics(operationDateMetrics);
      setOperationMetrics(metricsData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchProfilerData = async (fqn: string, days = 3) => {
    setIsLoading(true);
    await fetchTableProfiler(fqn, days);
    await fetchSystemProfiler(fqn, days);
    setIsLoading(false);
  };

  useEffect(() => {
    if (datasetFQN) {
      fetchProfilerData(
        datasetFQN,
        PROFILER_FILTER_RANGE[selectedTimeRange].days
      );
    } else {
      setIsLoading(false);
    }
  }, [datasetFQN, selectedTimeRange]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row data-testid="table-profiler-chart-container" gutter={[16, 16]}>
      <Col data-testid="row-metrics" span={24}>
        <ProfilerDetailsCard
          chartCollection={rowCountMetrics}
          curveType="stepAfter"
          name="rowCount"
        />
      </Col>
      <Col span={24}>
        <Card
          className="rounded-6 border-1"
          data-testid="operation-date-metrics">
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <ProfilerLatestValue
                stringValue
                information={operationDateMetrics.information}
              />
            </Col>
            <Col span={20}>
              <OperationDateBarChart
                chartCollection={operationDateMetrics}
                name="operationDateMetrics"
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <Card className="rounded-6 border-1" data-testid="operation-metrics">
          <Row gutter={[16, 16]}>
            <Col span={4}>
              <ProfilerLatestValue information={operationMetrics.information} />
            </Col>
            <Col span={20}>
              <CustomBarChart
                chartCollection={operationMetrics}
                name="operationMetrics"
              />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};

export default TableProfilerChart;
