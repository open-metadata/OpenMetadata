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
import { first, isString, last, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_COLUMN_METRICS_VALUE,
} from '../../../../constants/profiler.constant';
import { ColumnProfile } from '../../../../generated/entity/data/container';
import { Table } from '../../../../generated/entity/data/table';
import { getColumnProfilerList } from '../../../../rest/tableAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import documentationLinksClassBase from '../../../../utils/DocumentationLinksClassBase';
import {
  calculateColumnProfilerMetrics,
  calculateCustomMetrics,
  getColumnCustomMetric,
} from '../../../../utils/TableProfilerUtils';
import { ColumnMetricsInterface } from '../../../../utils/TableProfilerUtils.interface';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DataDistributionHistogram from '../../../Visualisations/Chart/DataDistributionHistogram.component';
import ProfilerDetailsCard from '../ProfilerDetailsCard/ProfilerDetailsCard';
import CustomMetricGraphs from './CustomMetricGraphs/CustomMetricGraphs.component';
import { useTableProfiler } from './TableProfilerProvider';

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
  const {
    isProfilerDataLoading,
    customMetric: tableCustomMetric,
    isProfilingEnabled,
  } = useTableProfiler();
  const { t } = useTranslation();
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;
  const [isLoading, setIsLoading] = useState(true);
  const [columnProfilerData, setColumnProfilerData] = useState<ColumnProfile[]>(
    []
  );

  const customMetrics = useMemo(
    () =>
      getColumnCustomMetric(
        tableDetails?.customMetrics ? tableDetails : tableCustomMetric,
        activeColumnFqn
      ) ?? [],
    [tableCustomMetric, activeColumnFqn, tableDetails]
  );
  const [columnMetric, setColumnMetric] = useState<ColumnMetricsInterface>(
    INITIAL_COLUMN_METRICS_VALUE
  );
  const [isMinMaxStringData, setIsMinMaxStringData] = useState(false);

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
  const columnCustomMetrics = useMemo(
    () => calculateCustomMetrics(columnProfilerData, customMetrics),
    [columnProfilerData, customMetrics]
  );

  const fetchColumnProfilerData = async (
    fqn: string,
    dateRangeObject?: DateRangeObject
  ) => {
    const dateRange = dateRangeObject
      ? pick(dateRangeObject, ['startTs', 'endTs'])
      : DEFAULT_RANGE_DATA;
    try {
      setIsLoading(true);
      const { data } = await getColumnProfilerList(fqn, dateRange);
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
    const profileMetric = calculateColumnProfilerMetrics({
      columnProfilerData,
      ...columnMetric,
    });

    setColumnMetric(profileMetric);

    // only min/max category can be string
    const isMinMaxString =
      isString(columnProfilerData[0]?.min) ||
      isString(columnProfilerData[0]?.max);
    setIsMinMaxStringData(isMinMaxString);
  };

  useEffect(() => {
    createMetricsChartData();
  }, [columnProfilerData]);

  useEffect(() => {
    if (activeColumnFqn) {
      fetchColumnProfilerData(activeColumnFqn, dateRangeObject);
    } else {
      setIsLoading(false);
    }
  }, [activeColumnFqn, dateRangeObject]);

  return (
    <Row
      className="m-b-lg"
      data-testid="profiler-tab-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={columnMetric.countMetrics}
          isLoading={isLoading}
          name="count"
          noDataPlaceholderText={noProfilerMessage}
          title={t('label.data-count-plural')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={columnMetric.proportionMetrics}
          isLoading={isLoading}
          name="proportion"
          noDataPlaceholderText={noProfilerMessage}
          tickFormatter="%"
          title={t('label.data-proportion-plural')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={columnMetric.mathMetrics}
          isLoading={isLoading}
          name="math"
          noDataPlaceholderText={noProfilerMessage}
          showYAxisCategory={isMinMaxStringData}
          // only min/max category can be string
          title={t('label.data-range')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={columnMetric.sumMetrics}
          isLoading={isLoading}
          name="sum"
          noDataPlaceholderText={noProfilerMessage}
          title={t('label.data-aggregate')}
        />
      </Col>
      <Col span={24}>
        <ProfilerDetailsCard
          chartCollection={columnMetric.quartileMetrics}
          isLoading={isLoading}
          name="quartile"
          noDataPlaceholderText={noProfilerMessage}
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
                noDataPlaceholderText={noProfilerMessage}
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
