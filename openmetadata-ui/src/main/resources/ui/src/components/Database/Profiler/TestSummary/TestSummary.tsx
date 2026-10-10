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

import {
  Box,
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  LineChartUp01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEqual, isUndefined, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import RunDetailsCard from '../../../DataQuality/IncidentManager/RunDetailsCard/RunDetailsCard';
import { getPastDaysRange } from '../../../observability/DataQuality/Dashboard/calendarDate.utils';
import DqDateRangeFilter from '../../../observability/DataQuality/Dashboard/DqDateRangeFilter';
import { TestSummaryProps } from '../ProfilerDashboard/profilerDashboard.interface';
import RunSummaryTiles from './RunSummaryTiles/RunSummaryTiles';
import './test-summary.less';
import {
  getMeasuredResult,
  getResultHistoryCaptionText,
  hasTestCaseNeverRun,
} from './TestSummary.utils';
import TestSummaryGraph from './TestSummaryGraph';
import { useSelectedRunInUrl } from './useSelectedRunInUrl';

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  const { t } = useTranslation();
  useSelectedRunInUrl();
  const { dimensionKey, version } = useRequiredParams<{
    dimensionKey?: string;
    version?: string;
  }>();
  const [results, setResults] = useState<
    TestCaseResult[] | TestCaseDimensionResult[]
  >([]);
  // Bounded at local midnight, as a range picked in the date picker is; UTC
  // bounds would show tomorrow's date as the end of the default window.
  const [dateRangeObject, setDateRangeObject] = useState<DateRangeObject>(() =>
    getPastDaysRange(PROFILER_FILTER_RANGE.last30days.days)
  );
  const [isGraphLoading, setIsGraphLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // Names the window in the chart's empty state. It opens on the default
  // preset's name and switches to the dates once the reader picks a range.
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(() =>
    translateWithNestedKeys(
      PROFILER_FILTER_RANGE.last30days.title,
      PROFILER_FILTER_RANGE.last30days.titleData
    )
  );

  const caption = useMemo(
    () => getResultHistoryCaptionText(data, t),
    [data, t]
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, pick(dateRangeObject, ['startTs', 'endTs']))) {
      setDateRangeObject(value);
      setSelectedTimeRange(
        `${formatDate(value.startTs)} – ${formatDate(value.endTs)}`
      );
    }
  };

  const testCaseFqn = data.fullyQualifiedName ?? '';
  const latestRunTimestamp = data.testCaseResult?.timestamp;

  // Until a load succeeds, a failed reload has no results to keep, quiet or
  // not: a development build runs the effect twice, so the first load is quiet.
  const hasLoaded = useRef(false);

  const fetchTestResults = useCallback(
    async (
      dateRangeObj: DateRangeObject,
      { quietly, isStale }: { quietly: boolean; isStale: () => boolean }
    ) => {
      if (!testCaseFqn) {
        return;
      }
      if (!quietly) {
        setIsGraphLoading(true);
      }
      try {
        const range = pick(dateRangeObj, ['startTs', 'endTs']);
        const { data: chartData } = await (dimensionKey
          ? getTestCaseDimensionResultsByFqn(testCaseFqn, {
              dimensionalityKey: dimensionKey,
              ...range,
            })
          : getListTestCaseResults(testCaseFqn, range));

        if (!isStale()) {
          setResults(chartData);
          setHasLoadError(false);
          hasLoaded.current = true;
        }
      } catch (error) {
        if (!isStale()) {
          showErrorToast(error as AxiosError);
          // A failed quiet reload keeps the results it would have replaced.
          if (!quietly || !hasLoaded.current) {
            setHasLoadError(true);
          }
        }
      } finally {
        // The fetch that replaced this one owns the loaders now.
        if (!isStale()) {
          setIsGraphLoading(false);
        }
      }
    },
    [testCaseFqn, dimensionKey]
  );

  // What the last fetch was for. When only the latest run changed (a run
  // finished, e.g. after Retry run), the window is reloaded without the graph
  // loader, so the chart, tiles and card update in place.
  const lastFetch = useRef<string>();

  useEffect(() => {
    const fetchKey = [
      testCaseFqn,
      dimensionKey,
      dateRangeObject.startTs,
      dateRangeObject.endTs,
      retryCount,
    ].join('|');
    const quietly = lastFetch.current === fetchKey;
    lastFetch.current = fetchKey;

    // A newer range, dimension or run replaces this fetch, and a slow response
    // must not overwrite the newer one's results when it arrives.
    let isStale = false;

    // fetchTestResults reports its own errors, so the effect need not wait on it.
    void fetchTestResults(dateRangeObject, {
      quietly,
      isStale: () => isStale,
    });

    return () => {
      isStale = true;
    };
  }, [
    fetchTestResults,
    testCaseFqn,
    dimensionKey,
    dateRangeObject,
    latestRunTimestamp,
    retryCount,
  ]);

  const measuredResults = useMemo(
    () =>
      (results as (TestCaseResult | TestCaseDimensionResult)[]).map((result) =>
        getMeasuredResult(data, result)
      ),
    [data, results]
  );

  // Below the header: the results, or why there are none to show.
  const resultsContent = useMemo(() => {
    if (isGraphLoading) {
      return <Loader />;
    }

    // An error is not an empty range: say so, and let the reader retry.
    if (hasLoadError) {
      return (
        <Box
          className="tw:relative tw:min-h-56 tw:w-full"
          data-testid="test-summary-load-error">
          <EmptyPlaceholder
            actions={[
              {
                key: 'retry',
                color: 'secondary',
                label: t('label.retry'),
                onPress: () => setRetryCount((count) => count + 1),
              },
            ]}
            icon={<AlertCircle className="tw:text-fg-error-primary" />}
            title={t('server.entity-fetch-error', {
              entity: t('label.test-case-result'),
            })}
          />
        </Box>
      );
    }

    if (hasTestCaseNeverRun(data, results, !isUndefined(version))) {
      return (
        <Box
          className="tw:relative tw:min-h-56 tw:w-full tw:rounded-xl tw:border tw:border-dashed tw:border-secondary"
          data-testid="test-summary-never-run">
          <EmptyPlaceholder
            className="tw:px-5"
            description={t('message.test-case-results-after-first-run')}
            icon={LineChartUp01}
            title={t('message.no-runs-recorded-yet')}
            width="100%"
          />
        </Box>
      );
    }

    return (
      <>
        <div data-testid="graph-container">
          <TestSummaryGraph
            selectedTimeRange={selectedTimeRange}
            testCaseFqn={testCaseFqn}
            testCaseName={data.name}
            testCaseParameterValue={data.parameterValues}
            testCaseResults={measuredResults}
            testDefinitionName={data.testDefinition.name}
          />
        </div>
        <RunSummaryTiles results={results} />
        <RunDetailsCard results={measuredResults} testCase={data} />
      </>
    );
  }, [
    isGraphLoading,
    hasLoadError,
    data,
    results,
    measuredResults,
    version,
    selectedTimeRange,
    testCaseFqn,
    t,
  ]);

  return (
    <Box data-testid="test-summary-container" direction="col" gap={4}>
      <Box align="start" gap={4} justify="between">
        <Box direction="col" gap={1}>
          {/* not-prose: Typography wraps a heading in .prose, whose h2 style
              (24px, margins) would otherwise outrank the size classes. */}
          <Typography
            as="h2"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-md"
            weight="bold">
            {t('label.result-history')}
          </Typography>
          <Typography
            className="tw:text-quaternary"
            data-testid="result-history-caption"
            size="text-sm">
            {caption}
          </Typography>
        </Box>
        <DqDateRangeFilter
          endTs={dateRangeObject.endTs}
          size="sm"
          startTs={dateRangeObject.startTs}
          onApply={handleDateRangeChange}
        />
      </Box>
      {resultsContent}
    </Box>
  );
};

export default TestSummary;
