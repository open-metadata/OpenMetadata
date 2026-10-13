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
import { Tooltip, Typography } from '@openmetadata/ui-core-components';
import {
  chartColor,
  PieChart,
  useChartPalette,
  type PieDatum,
} from '@openmetadata/ui-core-components/charts';
import { AxiosError } from 'axios';
import { find, first, isString, last, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_RANGE_DATA,
  INITIAL_COLUMN_METRICS_VALUE,
} from '../../../../constants/profiler.constant';
import {
  Column,
  ColumnProfile,
} from '../../../../generated/entity/data/container';
import { Table } from '../../../../generated/entity/data/table';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { getColumnProfilerList } from '../../../../rest/tableAPI';
import documentationLinksClassBase from '../../../../utils/DocumentationLinksClassBase';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { formatNumberWithComma } from '../../../../utils/NumberUtils';
import {
  calculateColumnProfilerMetrics,
  calculateCustomMetrics,
  getColumnCustomMetric,
} from '../../../../utils/TableProfilerUtils';
import { ColumnMetricsInterface } from '../../../../utils/TableProfilerUtils.interface';
import { showErrorToast } from '../../../../utils/ToastUtils';
import CardinalityDistributionChart from '../../../Visualisations/Chart/CardinalityDistributionChart.component';
import DataDistributionHistogram from '../../../Visualisations/Chart/DataDistributionHistogram.component';
import ProfilerDetailsCard from '../ProfilerDetailsCard/ProfilerDetailsCard';
import ProfilerStateWrapper from '../ProfilerStateWrapper/ProfilerStateWrapper.component';
import ColumnSummary from './ColumnSummary';
import CustomMetricGraphs from './CustomMetricGraphs/CustomMetricGraphs.component';
import { useTableProfiler } from './TableProfilerProvider';

const PIE_SIZE = 160;
const LEGEND_HIDDEN = { show: false };

interface SingleColumnProfileProps {
  activeColumnFqn: string;
  tableDetails?: Table;
}

const SingleColumnProfile: FC<SingleColumnProfileProps> = ({
  activeColumnFqn,
  tableDetails,
}) => {
  const palette = useChartPalette();
  const location = useCustomLocation();
  const {
    isProfilerDataLoading,
    customMetric: tableCustomMetric,
    isProfilingEnabled,
    testCaseSummary,
  } = useTableProfiler();
  const { t } = useTranslation();

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
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;
  const [isLoading, setIsLoading] = useState(true);
  const [columnProfilerData, setColumnProfilerData] = useState<ColumnProfile[]>(
    []
  );

  const selectedColumn = useMemo(() => {
    return find(
      tableDetails?.columns ?? [],
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [tableDetails, activeColumnFqn]);

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
      <Tooltip title={t('label.documentation')}>
        <span>
          <Transi18next
            i18nKey="message.no-profiler-card-message-with-link"
            renderElement={
              <a
                aria-label={t('label.documentation')}
                href={profilerDocsLink}
                rel="noreferrer"
                target="_blank"
              />
            }
          />
        </span>
      </Tooltip>
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

  const { columnTestData, activeColumnTests } = useMemo(() => {
    const activeColumnTests =
      testCaseSummary?.[activeColumnFqn?.toLocaleLowerCase()];
    const columnTestData: PieDatum[] = [
      {
        name: 'Success',
        value: activeColumnTests?.success ?? 0,
        status: 'success',
      },
      {
        name: 'Failed',
        value: activeColumnTests?.failed ?? 0,
        status: 'failed',
      },
      {
        name: 'Aborted',
        value: activeColumnTests?.aborted ?? 0,
        status: 'warning',
      },
    ];

    return { columnTestData, activeColumnTests };
  }, [testCaseSummary, activeColumnFqn]);

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
    <div
      className="tw:mb-lg tw:flex tw:flex-col tw:gap-8"
      data-testid="profiler-tab-container">
      {selectedColumn && (
        <div className="tw:grid tw:grid-cols-24 tw:gap-5">
          <div className="tw:col-span-14">
            <ColumnSummary column={selectedColumn} />
          </div>
          <div className="tw:col-span-10">
            <div className="tw:h-full tw:rounded-[10px] tw:border tw:border-border-secondary tw:shadow-none">
              <div className="tw:p-4">
                <p className="tw:m-0 tw:text-md tw:font-medium tw:text-primary">
                  {t('label.data-quality-test-plural')}
                </p>
              </div>
              <hr className="tw:my-0 tw:h-px tw:border-0 tw:bg-border-secondary" />
              <div className="tw:grid tw:grid-cols-12 tw:gap-3 tw:p-4">
                <div className="tw:col-span-5">
                  <div style={{ width: PIE_SIZE }}>
                    <PieChart
                      track
                      ariaLabel={t('label.data-quality-test-plural')}
                      centerLabel={
                        <div className="tw:flex tw:flex-col tw:items-center">
                          <Typography
                            className="tw:text-primary"
                            data-testid="column-test-total"
                            size="text-sm"
                            weight="semibold">
                            {activeColumnTests?.total ?? 0}
                          </Typography>
                          <Typography
                            color="secondary"
                            size="text-xs"
                            weight="medium">
                            {t('label.total-test-plural')}
                          </Typography>
                        </div>
                      }
                      data={columnTestData}
                      height={PIE_SIZE}
                      innerRadius="62%"
                      legend={LEGEND_HIDDEN}
                      outerRadius="88%"
                    />
                  </div>
                </div>

                <div className="tw:col-span-7">
                  <div className="tw:w-full tw:rounded-md tw:bg-secondary tw:p-4">
                    {columnTestData.map((item, index) => (
                      <div
                        className="tw:mb-1 tw:flex tw:items-center tw:justify-between"
                        key={item.name}>
                        <span
                          className="tw:text-sm tw:text-secondary"
                          style={{
                            borderLeft: `4px solid ${chartColor(
                              palette,
                              index,
                              item.status
                            )}`,
                            paddingLeft: '8px',
                            lineHeight: '10px',
                          }}>
                          {item.name}
                        </span>
                        <span className="tw:text-sm tw:font-medium tw:text-primary">
                          {formatNumberWithComma(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProfilerDetailsCard
        chartCollection={columnMetric.countMetrics}
        isLoading={isLoading}
        name="count"
        noDataPlaceholderText={noProfilerMessage}
        title={t('label.data-count-plural')}
      />
      <ProfilerDetailsCard
        chartCollection={columnMetric.proportionMetrics}
        isLoading={isLoading}
        name="proportion"
        noDataPlaceholderText={noProfilerMessage}
        tickFormatter="%"
        title={t('label.data-proportion-plural')}
      />
      <ProfilerDetailsCard
        chartCollection={columnMetric.mathMetrics}
        isLoading={isLoading}
        name="math"
        noDataPlaceholderText={noProfilerMessage}
        showYAxisCategory={isMinMaxStringData}
        // only min/max category can be string
        title={t('label.data-range')}
      />
      <ProfilerDetailsCard
        chartCollection={columnMetric.sumMetrics}
        chartType="area"
        isLoading={isLoading}
        name="sum"
        noDataPlaceholderText={noProfilerMessage}
        title={t('label.data-aggregate')}
      />
      <ProfilerDetailsCard
        chartCollection={columnMetric.quartileMetrics}
        isLoading={isLoading}
        name="quartile"
        noDataPlaceholderText={noProfilerMessage}
        title={t('label.data-quartile-plural')}
      />
      {firstDay?.histogram || currentDay?.histogram ? (
        <ProfilerStateWrapper
          dataTestId="histogram-metrics"
          isLoading={isLoading}
          title={t('label.data-distribution')}>
          <DataDistributionHistogram
            data={{
              firstDayData: firstDay,
              currentDayData: currentDay,
            }}
            noDataPlaceholderText={noProfilerMessage}
          />
        </ProfilerStateWrapper>
      ) : null}
      {firstDay?.cardinalityDistribution ||
      currentDay?.cardinalityDistribution ? (
        <ProfilerStateWrapper
          dataTestId="cardinality-distribution-metrics"
          isLoading={isLoading}
          title={t('label.cardinality')}>
          <CardinalityDistributionChart
            data={{
              firstDayData: firstDay,
              currentDayData: currentDay,
            }}
            noDataPlaceholderText={noProfilerMessage}
          />
        </ProfilerStateWrapper>
      ) : null}
      <CustomMetricGraphs
        customMetrics={customMetrics}
        customMetricsGraphData={columnCustomMetrics}
        isLoading={isLoading || isProfilerDataLoading}
      />
    </div>
  );
};

export default SingleColumnProfile;
