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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, isEqual, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import {
  TestCaseDimensionResult,
  TestCaseResult,
} from '../../../../generated/tests/testCase';
import {
  getListTestCaseResults,
  getTestCaseDimensionResultsByFqn,
} from '../../../../rest/testAPI';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import Loader from '../../../common/Loader/Loader';
import { getPastDaysRange } from '../../../observability/DataQuality/Dashboard/calendarDate.utils';
import DqDateRangeFilter from '../../../observability/DataQuality/Dashboard/DqDateRangeFilter';
import { TestSummaryProps } from '../ProfilerDashboard/profilerDashboard.interface';
import RunSummaryTiles from './RunSummaryTiles/RunSummaryTiles';
import './test-summary.less';
import { getResultHistoryCaption } from './TestSummary.utils';
import TestSummaryGraph from './TestSummaryGraph';

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  const { t } = useTranslation();
  const { dimensionKey } = useRequiredParams<{ dimensionKey?: string }>();
  const [results, setResults] = useState<
    TestCaseResult[] | TestCaseDimensionResult[]
  >([]);
  // Bounded at local midnight, as a range picked in the date picker is; UTC
  // bounds would show tomorrow's date as the end of the default window.
  const [dateRangeObject, setDateRangeObject] = useState<DateRangeObject>(() =>
    getPastDaysRange(PROFILER_FILTER_RANGE.last30days.days)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGraphLoading, setIsGraphLoading] = useState(true);
  // Names the window in the chart's empty state. It opens on the default
  // preset's name and switches to the dates once the reader picks a range.
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(() =>
    translateWithNestedKeys(
      PROFILER_FILTER_RANGE.last30days.title,
      PROFILER_FILTER_RANGE.last30days.titleData
    )
  );

  const caption = useMemo(() => {
    const { metric, comparison, tolerance } = getResultHistoryCaption(data);
    const metricText = t(metric.key, metric.values);
    const measured = comparison
      ? t('message.metric-vs-comparison', {
          metric: metricText,
          comparison: t(comparison.key, comparison.values),
        })
      : metricText;

    return tolerance
      ? `${measured} · ${t(tolerance.key, tolerance.values)}`
      : measured;
  }, [data, t]);

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, pick(dateRangeObject, ['startTs', 'endTs']))) {
      setDateRangeObject(value);
      setSelectedTimeRange(
        `${formatDate(value.startTs)} – ${formatDate(value.endTs)}`
      );
    }
  };

  const fetchTestResults = async (dateRangeObj: DateRangeObject) => {
    if (isEmpty(data)) {
      return;
    }
    setIsGraphLoading(true);
    try {
      const resultsApi = dimensionKey
        ? getTestCaseDimensionResultsByFqn(data.fullyQualifiedName ?? '', {
            dimensionalityKey: dimensionKey,
            ...pick(dateRangeObj, ['startTs', 'endTs']),
          })
        : getListTestCaseResults(
            data.fullyQualifiedName ?? '',
            pick(dateRangeObj, ['startTs', 'endTs'])
          );
      const { data: chartData } = await resultsApi;

      setResults(chartData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsGraphLoading(false);
    }
  };

  useEffect(() => {
    if (dateRangeObject) {
      fetchTestResults(dateRangeObject);
    }
  }, [dateRangeObject, dimensionKey]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Box data-testid="test-summary-container" direction="col" gap={4}>
      <Box align="start" gap={4} justify="between">
        <Box direction="col" gap={1}>
          {/* The global h2 style otherwise wins over the size class and renders
              the title at 24px. */}
          <Typography
            as="h2"
            className="tw:m-0 tw:text-lg! tw:leading-7!"
            size="text-lg"
            weight="semibold">
            {t('label.result-history')}
          </Typography>
          <Typography
            className="tw:text-tertiary"
            data-testid="result-history-caption"
            size="text-sm">
            {caption}
          </Typography>
        </Box>
        <DqDateRangeFilter
          endTs={dateRangeObject.endTs}
          startTs={dateRangeObject.startTs}
          onApply={handleDateRangeChange}
        />
      </Box>
      <div data-testid="graph-container">
        {isGraphLoading ? (
          <Loader />
        ) : (
          <TestSummaryGraph
            selectedTimeRange={selectedTimeRange}
            testCaseFqn={data.fullyQualifiedName ?? ''}
            testCaseName={data.name}
            testCaseParameterValue={data.parameterValues}
            testCaseResults={results}
            testDefinitionName={data.testDefinition.name}
          />
        )}
      </div>
      {!isGraphLoading && <RunSummaryTiles results={results} />}
    </Box>
  );
};

export default TestSummary;
