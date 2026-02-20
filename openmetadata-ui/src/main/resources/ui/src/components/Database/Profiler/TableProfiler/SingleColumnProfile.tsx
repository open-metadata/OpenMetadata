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
  Box,
  Card,
  Divider,
  Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { AxiosError } from 'axios';
import { find, first, isString, last, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import {
  GREEN_3,
  GREY_200,
  RED_3,
  YELLOW_2,
} from '../../../../constants/Color.constants';
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
import {
  formatNumberWithComma,
  Transi18next,
} from '../../../../utils/CommonUtils';
import documentationLinksClassBase from '../../../../utils/DocumentationLinksClassBase';
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
import './single-column-profiler.less';
import { useTableProfiler } from './TableProfilerProvider';

interface SingleColumnProfileProps {
  activeColumnFqn: string;
  tableDetails?: Table;
}

const SingleColumnProfile: FC<SingleColumnProfileProps> = ({
  activeColumnFqn,
  tableDetails,
}) => {
  const location = useCustomLocation();
  const {
    isProfilerDataLoading,
    customMetric: tableCustomMetric,
    isProfilingEnabled,
    testCaseSummary,
  } = useTableProfiler();
  const theme = useTheme();
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

  const { columnTestData, activeColumnTests } = useMemo(() => {
    const activeColumnTests =
      testCaseSummary?.[activeColumnFqn?.toLocaleLowerCase()];

    return {
      columnTestData: [
        {
          name: 'Success',
          value: activeColumnTests?.success ?? 0,
          color: GREEN_3,
        },
        { name: 'Failed', value: activeColumnTests?.failed ?? 0, color: RED_3 },
        {
          name: 'Aborted',
          value: activeColumnTests?.aborted ?? 0,
          color: YELLOW_2,
        },
      ],
      activeColumnTests,
    };
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
    <Stack
      className="m-b-lg"
      data-testid="profiler-tab-container"
      spacing="30px">
      {selectedColumn && (
        <Grid container spacing={5}>
          <Grid size={7.2}>
            <ColumnSummary column={selectedColumn} />
          </Grid>
          <Grid size="grow">
            <Card
              sx={{
                borderRadius: '10px',
                border: `1px solid ${theme.palette.grey[200]}`,
                boxShadow: 'none',
                height: '100%',
              }}>
              <Box p={4}>
                <Typography
                  sx={{
                    fontSize: theme.typography.pxToRem(16),
                    fontWeight: theme.typography.fontWeightMedium,
                    color: theme.palette.grey[900],
                  }}>
                  {t('label.data-quality-test-plural')}
                </Typography>
              </Box>
              <Divider />
              <Grid container spacing={3} sx={{ p: 4 }}>
                <Grid size={5}>
                  <PieChart
                    className="dq-pie-chart-container"
                    height={160}
                    width={160}>
                    <Pie
                      cx="50%"
                      cy="50%"
                      // to show the empty pie chart when there is no data
                      data={[{ value: 1 }]}
                      dataKey="value"
                      endAngle={-270}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={0}
                      // to hide tooltip when there is no data
                      pointerEvents="none"
                      startAngle={90}>
                      <Cell fill={GREY_200} />
                    </Pie>
                    <Pie
                      cx="50%"
                      cy="50%"
                      // to show the empty pie chart when there is no data
                      data={[{ value: 1 }]}
                      dataKey="value"
                      endAngle={-270}
                      innerRadius={75}
                      outerRadius={80}
                      paddingAngle={0}
                      // to hide tooltip when there is no data
                      pointerEvents="none"
                      startAngle={90}>
                      <Cell fill={GREY_200} />
                    </Pie>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={columnTestData}
                      dataKey="value"
                      endAngle={-270}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={0}
                      startAngle={90}>
                      {columnTestData.map((entry, index) => (
                        <Cell fill={entry.color} key={`cell-${index}`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <text
                      className="chart-center-text-header"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x="50%"
                      y="42%">
                      {activeColumnTests?.total ?? 0}
                    </text>
                    <text
                      className="chart-center-text-sub-header"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x="50%"
                      y="55%">
                      {t('label.total-test-plural')}
                    </text>
                  </PieChart>
                </Grid>

                <Grid size="grow">
                  <Box
                    sx={{
                      p: 4,
                      borderRadius: '6px',
                      bgcolor: theme.palette.grey[50],
                      width: '100%',
                    }}>
                    {columnTestData.map((item) => (
                      <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="space-between"
                        key={item.name}
                        sx={{ mb: 1 }}>
                        <Typography
                          sx={{
                            color: theme.palette.grey[700],
                            fontSize: theme.typography.pxToRem(13),
                            borderLeft: `4px solid ${item.color}`,
                            pl: 2,
                            lineHeight: '10px',
                          }}>
                          {item.name}
                        </Typography>
                        <Typography
                          sx={{
                            color: theme.palette.grey[900],
                            fontWeight: theme.typography.fontWeightMedium,
                            fontSize: theme.typography.pxToRem(13),
                          }}>
                          {formatNumberWithComma(item.value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Card>
          </Grid>
        </Grid>
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
    </Stack>
  );
};

export default SingleColumnProfile;
