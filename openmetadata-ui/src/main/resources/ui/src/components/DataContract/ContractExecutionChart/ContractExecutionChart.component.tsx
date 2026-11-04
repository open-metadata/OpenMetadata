/*
 *  Copyright 2025 Collate.
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
  BarChart,
  chartColor,
  ChartSeries,
  ChartStatus,
  ChartTooltipRenderProps,
  ChartXAxisProps,
  ChartYAxisProps,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';
import { AxiosError } from 'axios';
import { isEqual, pick, sortBy } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ES_MAX_PAGE_SIZE } from '../../../constants/constants';
import {
  CONTRACT_EXECUTION_CHART_HEIGHT,
  CONTRACT_EXECUTION_CHART_STATUS,
  CONTRACT_EXECUTION_VISIBLE_RUNS,
  DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS,
} from '../../../constants/DataContract.constants';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { getAllContractResults } from '../../../rest/contractAPI';
import {
  formatContractExecutionDayTick,
  formatContractExecutionTick,
  generateMonthTickPositions,
  processContractExecutionData,
} from '../../../utils/DataContract/DataContractUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../utils/date-time/DateTimeUtils';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import './contract-execution-chart.less';
import { DataContractProcessedResultCharts } from './ContractExecutionChart.interface';
import ContractExecutionChartTooltip from './ContractExecutionChartTooltip.component';

// Every bar has value 1: height carries no information, so the axis has no labels.
const Y_AXIS: ChartYAxisProps = { max: 1, axisLabel: { show: false } };

// A status the chart does not know yet still draws, distinct from Running.
const UNKNOWN_RUN_STATUS: ChartStatus = 'muted';

const runStatus = (row: DataContractProcessedResultCharts) =>
  CONTRACT_EXECUTION_CHART_STATUS[row.status]?.status ?? UNKNOWN_RUN_STATUS;

const ContractExecutionChart = ({ contract }: { contract: DataContract }) => {
  const { t } = useTranslation();
  const palette = useChartPalette();
  const defaultRange = useMemo(
    () => ({
      initialRange: {
        startTs: getEpochMillisForPastDays(
          PROFILER_FILTER_RANGE.last30days.days
        ),
        endTs: getCurrentMillis(),
      },
      key: 'last30days',
      title: translateWithNestedKeys(
        PROFILER_FILTER_RANGE.last30days.title,
        PROFILER_FILTER_RANGE.last30days.titleData
      ),
    }),
    []
  );

  const [contractExecutionResultList, setContractExecutionResultList] =
    useState<DataContractResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRangeObject, setDateRangeObject] = useState<DateRangeObject>(
    defaultRange.initialRange
  );

  const fetchAllContractResults = async (dateRangeObj: DateRangeObject) => {
    try {
      setIsLoading(true);
      const results = await getAllContractResults(contract.id, {
        ...pick(dateRangeObj, ['startTs', 'endTs']),
        limit: ES_MAX_PAGE_SIZE,
      });
      setContractExecutionResultList(sortBy(results.data, 'timestamp'));
    } catch (err) {
      setContractExecutionResultList([]);
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const { processedChartData, monthStarts } = useMemo(() => {
    const processed = processContractExecutionData(contractExecutionResultList);

    return {
      processedChartData: processed,
      monthStarts: new Set(generateMonthTickPositions(processed)),
    };
  }, [contractExecutionResultList]);

  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'value',
        name: t('label.contract-execution-status'),
        seriesOption: {
          barMaxWidth: DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS.barMaxWidth,
        },
      },
    ],
    [t]
  );

  // Up to a zoom window of runs, a label at the first run of each month only.
  // Past that a zoomed window may hold no month start, so label runs by day.
  const isZoomed = processedChartData.length > CONTRACT_EXECUTION_VISIBLE_RUNS;
  const xAxis = useMemo<ChartXAxisProps>(
    () =>
      isZoomed
        ? {
            axisLabel: { interval: 'auto' },
            formatter: (value) => formatContractExecutionDayTick(String(value)),
          }
        : {
            axisLabel: {
              interval: (_index: number, value: string) =>
                monthStarts.has(value),
            },
            formatter: (value) => formatContractExecutionTick(String(value)),
          },
    [isZoomed, monthStarts]
  );

  const tooltip = useMemo<
    ChartTooltipRenderProps<DataContractProcessedResultCharts>
  >(
    () => ({
      render: (_items, row) => {
        if (!row) {
          return null;
        }
        const entry = CONTRACT_EXECUTION_CHART_STATUS[row.status];

        return (
          <ContractExecutionChartTooltip
            color={chartColor(palette, 0, runStatus(row))}
            datum={row}
            label={t('label.contract-execution-status')}
            statusLabel={entry ? t(entry.label) : row.status}
          />
        );
      },
    }),
    [palette, t]
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  useEffect(() => {
    fetchAllContractResults(dateRangeObject);
  }, [dateRangeObject]);

  return (
    <div className="contract-execution-chart-container">
      <div className="contract-execution-data-picker">
        <DatePickerMenu
          showSelectedCustomRange
          defaultDateRange={pick(defaultRange, ['key', 'title'])}
          handleDateRangeChange={handleDateRangeChange}
        />
      </div>
      <BarChart
        ariaLabel={t('label.execution-history')}
        data={processedChartData}
        data-testid="contract-execution-chart"
        getBarStatus={runStatus}
        height={CONTRACT_EXECUTION_CHART_HEIGHT}
        loading={isLoading}
        radius={DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS.radius}
        series={series}
        tooltip={tooltip}
        xAxis={xAxis}
        xKey="name"
        yAxis={Y_AXIS}
        zoom="auto"
        zoomVisiblePoints={CONTRACT_EXECUTION_VISIBLE_RUNS}
      />
    </div>
  );
};

export default ContractExecutionChart;
