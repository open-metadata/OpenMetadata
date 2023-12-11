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
import { Card, Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { first, isString, last, sortBy } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DataDistributionHistogram from '../../../components/Chart/DataDistributionHistogram.component';
import ProfilerDetailsCard from '../../../components/ProfilerDashboard/component/ProfilerDetailsCard';
import { DateRangeObject } from '../../../components/ProfilerDashboard/component/TestSummary';
import { MetricChartType } from '../../../components/ProfilerDashboard/profilerDashboard.interface';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_COUNT_METRIC_VALUE,
  INITIAL_MATH_METRIC_VALUE,
  INITIAL_PROPORTION_METRIC_VALUE,
  INITIAL_QUARTILE_METRIC_VALUE,
  INITIAL_SUM_METRIC_VALUE,
} from '../../../constants/profiler.constant';
import { ColumnProfile } from '../../../generated/entity/data/container';
import { Table } from '../../../generated/entity/data/table';
import { getColumnProfilerList } from '../../../rest/tableAPI';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import {
  calculateCustomMetrics,
  getColumnCustomMetric,
} from '../../../utils/TableProfilerUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
import CustomMetricGraphs from '../CustomMetricGraphs/CustomMetricGraphs.component';
import { useTableProfiler } from '../TableProfilerProvider';

interface SingleColumnProfileProps {
  activeColumnFqn: string;
  dateRangeObject: DateRangeObject;
  tableDetails?: Table;
}

const SingleColumnProfile: FC<SingleColumnProfileProps> = ({
  activeColumnFqn,
  dateRangeObject,
  tableDetails,
}) => {
  const { isProfilerDataLoading, customMetric: tableCustomMetric } =
    useTableProfiler();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [columnProfilerData, setColumnProfilerData] = useState<ColumnProfile[]>(
    []
  );

  const customMetrics = useMemo(
    () =>
      getColumnCustomMetric(
        tableDetails ?? tableCustomMetric,
        activeColumnFqn
      ) ?? [],
    [tableCustomMetric, activeColumnFqn, tableDetails]
  );
  const [countMetrics, setCountMetrics] = useState<MetricChartType>(
    INITIAL_COUNT_METRIC_VALUE
  );
  const [proportionMetrics, setProportionMetrics] = useState<MetricChartType>(
    INITIAL_PROPORTION_METRIC_VALUE
  );
  const [mathMetrics, setMathMetrics] = useState<MetricChartType>(
    INITIAL_MATH_METRIC_VALUE
  );
  const [sumMetrics, setSumMetrics] = useState<MetricChartType>(
    INITIAL_SUM_METRIC_VALUE
  );
  const [isMinMaxStringData, setIsMinMaxStringData] = useState(false);
  const [quartileMetrics, setQuartileMetrics] = useState<MetricChartType>(
    INITIAL_QUARTILE_METRIC_VALUE
  );

  const columnCustomMetrics = useMemo(
    () => calculateCustomMetrics(columnProfilerData, customMetrics),
    [columnProfilerData, customMetrics]
  );

  const fetchColumnProfilerData = async (
    fqn: string,
    dateRangeObject?: DateRangeObject
  ) => {
    try {
      setIsLoading(true);
      const { data } = await getColumnProfilerList(
        getEncodedFqn(fqn),
        dateRangeObject ?? DEFAULT_RANGE_DATA
      );
      setColumnProfilerData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const { firstDay, currentDay } = useMemo(() => {
    return {
      firstDay: last(columnProfilerData),
      currentDay: first(columnProfilerData),
    };
  }, [columnProfilerData]);

  const createMetricsChartData = () => {
    const updateProfilerData = sortBy(columnProfilerData, 'timestamp');
    const countMetricData: MetricChartType['data'] = [];
    const proportionMetricData: MetricChartType['data'] = [];
    const mathMetricData: MetricChartType['data'] = [];
    const sumMetricData: MetricChartType['data'] = [];
    const quartileMetricData: MetricChartType['data'] = [];
    updateProfilerData.forEach((col) => {
      const timestamp = customFormatDateTime(col.timestamp, 'MMM dd, hh:mm');

      countMetricData.push({
        name: timestamp,
        timestamp: col.timestamp,
        distinctCount: col.distinctCount || 0,
        nullCount: col.nullCount || 0,
        uniqueCount: col.uniqueCount || 0,
        valuesCount: col.valuesCount || 0,
      });

      sumMetricData.push({
        name: timestamp,
        timestamp: col.timestamp || 0,
        sum: col.sum || 0,
      });

      mathMetricData.push({
        name: timestamp,
        timestamp: col.timestamp || 0,
        max: col.max || 0,
        min: col.min || 0,
        mean: col.mean || 0,
      });

      proportionMetricData.push({
        name: timestamp,
        timestamp: col.timestamp || 0,
        distinctProportion: Math.round((col.distinctProportion || 0) * 100),
        nullProportion: Math.round((col.nullProportion || 0) * 100),
        uniqueProportion: Math.round((col.uniqueProportion || 0) * 100),
      });

      quartileMetricData.push({
        name: timestamp,
        timestamp: col.timestamp || 0,
        firstQuartile: col.firstQuartile || 0,
        thirdQuartile: col.thirdQuartile || 0,
        interQuartileRange: col.interQuartileRange || 0,
        median: col.median || 0,
      });
    });

    const countMetricInfo = countMetrics.information.map((item) => ({
      ...item,
      latestValue:
        countMetricData[countMetricData.length - 1]?.[item.dataKey] || 0,
    }));
    const proportionMetricInfo = proportionMetrics.information.map((item) => ({
      ...item,
      latestValue: parseFloat(
        `${
          proportionMetricData[proportionMetricData.length - 1]?.[
            item.dataKey
          ] || 0
        }`
      ).toFixed(2),
    }));
    const mathMetricInfo = mathMetrics.information.map((item) => ({
      ...item,
      latestValue:
        mathMetricData[mathMetricData.length - 1]?.[item.dataKey] || 0,
    }));
    const sumMetricInfo = sumMetrics.information.map((item) => ({
      ...item,
      latestValue: sumMetricData[sumMetricData.length - 1]?.[item.dataKey] || 0,
    }));
    const quartileMetricInfo = quartileMetrics.information.map((item) => ({
      ...item,
      latestValue:
        quartileMetricData[quartileMetricData.length - 1]?.[item.dataKey] || 0,
    }));

    setCountMetrics((pre) => ({
      ...pre,
      information: countMetricInfo,
      data: countMetricData,
    }));
    setProportionMetrics((pre) => ({
      ...pre,
      information: proportionMetricInfo,
      data: proportionMetricData,
    }));
    setMathMetrics((pre) => ({
      ...pre,
      information: mathMetricInfo,
      data: mathMetricData,
    }));
    setSumMetrics((pre) => ({
      ...pre,
      information: sumMetricInfo,
      data: sumMetricData,
    }));
    setQuartileMetrics((pre) => ({
      ...pre,
      information: quartileMetricInfo,
      data: quartileMetricData,
    }));

    // only min/max category can be string
    const isMinMaxString =
      isString(updateProfilerData[0]?.min) ||
      isString(updateProfilerData[0]?.max);
    setIsMinMaxStringData(isMinMaxString);
  };

  useEffect(() => {
    createMetricsChartData();
  }, [columnProfilerData]);

  useEffect(() => {
    fetchColumnProfilerData(activeColumnFqn, dateRangeObject);
  }, [activeColumnFqn, dateRangeObject]);

  return (
    <Row
      className="m-b-lg"
      data-testid="profiler-tab-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={countMetrics}
          isLoading={isLoading}
          name="count"
          title={t('label.data-count-plural')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={proportionMetrics}
          isLoading={isLoading}
          name="proportion"
          tickFormatter="%"
          title={t('label.data-proportion-plural')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={mathMetrics}
          isLoading={isLoading}
          name="math"
          showYAxisCategory={isMinMaxStringData}
          // only min/max category can be string
          title={t('label.data-range')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={sumMetrics}
          isLoading={isLoading}
          name="sum"
          title={t('label.data-aggregate')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={quartileMetrics}
          isLoading={isLoading}
          name="quartile"
          title={t('label.data-quartile-plural')}
        />
      </Col>
      <Col span={24}>
        <Card
          className="shadow-none global-border-radius"
          data-testid="histogram-metrics"
          loading={isLoading}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title data-testid="data-distribution-title" level={5}>
                {t('label.data-distribution')}
              </Typography.Title>
            </Col>
            <Col span={24}>
              <DataDistributionHistogram
                data={{ firstDayData: firstDay, currentDayData: currentDay }}
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col span={24}>
        <CustomMetricGraphs
          customMetrics={customMetrics}
          customMetricsGraphData={columnCustomMetrics}
          isLoading={isLoading || isProfilerDataLoading}
        />
      </Col>
    </Row>
  );
};

export default SingleColumnProfile;
