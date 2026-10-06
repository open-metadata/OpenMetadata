/*
 *  Copyright 2026 Collate.
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
import type { TFunction } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import { TestCase } from '../../../../generated/tests/testCase';
import { getParameterBounds } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import {
  DEFAULT_RESULT_METRIC,
  RESULT_METRIC_BY_DEFINITION,
} from './TestSummary.constants';

export interface CaptionPart {
  key: string;
  values?: Record<string, string>;
}

export interface ResultHistoryCaption {
  metric: CaptionPart;
  comparison?: CaptionPart;
}

export const formatNumber = (value: number) => value.toLocaleString();

export interface ParameterExpectation {
  expected?: number;
  min?: number;
  max?: number;
  threshold?: number;
}

/**
 * What a test case's parameters say a run is measured against: one expected
 * value when there is one (stated, or implied by the definition, as for
 * not-null), otherwise a range or one side of it. Shared by the result history
 * caption and the run details card so the two cannot disagree.
 */
export const resolveParameterExpectation = (
  testCase: TestCase
): ParameterExpectation => {
  const { expected, min, max, threshold } = getParameterBounds(
    testCase.parameterValues ?? []
  );
  const expectedValue =
    expected ??
    RESULT_METRIC_BY_DEFINITION[testCase.testDefinition?.name ?? '']
      ?.impliedExpected;

  return isUndefined(expectedValue)
    ? { min, max, threshold }
    : { expected: expectedValue, threshold };
};

const getComparison = (testCase: TestCase): CaptionPart | undefined => {
  if (testCase.useDynamicAssertion) {
    return { key: 'label.caption-learned-range' };
  }

  const {
    expected: expectedValue,
    min,
    max,
    threshold,
  } = resolveParameterExpectation(testCase);

  if (!isUndefined(expectedValue)) {
    return {
      key: 'label.caption-expected-value',
      values: { value: formatNumber(expectedValue) },
    };
  }

  if (!isUndefined(min) && !isUndefined(max)) {
    return {
      key: 'label.caption-allowed-range',
      values: { min: formatNumber(min), max: formatNumber(max) },
    };
  }

  if (!isUndefined(max)) {
    return {
      key: 'label.caption-allowed-max',
      values: { value: formatNumber(max) },
    };
  }

  if (!isUndefined(min)) {
    return {
      key: 'label.caption-allowed-min',
      values: { value: formatNumber(min) },
    };
  }

  return isUndefined(threshold)
    ? undefined
    : {
        key: 'label.caption-threshold',
        values: { value: formatNumber(threshold) },
      };
};

/**
 * The line under the chart card's title that says what the chart measures and
 * what it is measured against, e.g. "Row count vs. expected 10,000".
 * Returned as translation keys so the caller renders it in the reader's
 * language. The failure threshold is left out: what it means differs by test
 * type (a drift around the value, a widening of the range, or a count of
 * tolerated failing rows), and the API does not say which applies.
 */
export const getResultHistoryCaption = (
  testCase: TestCase
): ResultHistoryCaption => {
  const metric =
    RESULT_METRIC_BY_DEFINITION[testCase.testDefinition?.name ?? ''] ??
    DEFAULT_RESULT_METRIC;
  const comparison = getComparison(testCase);

  return {
    metric: {
      key: metric.labelKey,
      ...(metric.namesColumn && {
        values: {
          column: getColumnNameFromEntityLink(testCase.entityLink) ?? '',
        },
      }),
    },
    ...(comparison && { comparison }),
  };
};

/** The caption as text, "Row count vs. expected 10,000". */
export const getResultHistoryCaptionText = (
  testCase: TestCase,
  t: TFunction
) => {
  const { metric, comparison } = getResultHistoryCaption(testCase);
  const metricText = t(metric.key, metric.values);

  return comparison
    ? t('message.metric-vs-comparison', {
        metric: metricText,
        comparison: t(comparison.key, comparison.values),
      })
    : metricText;
};

/**
 * Whether the test has never run: nothing in the range and no latest result.
 * A version's snapshot carries no latest result, so on the version page a
 * test whose runs are all outside the range would read as never run; that
 * page keeps the range's own empty state.
 */
export const hasTestCaseNeverRun = (
  testCase: Pick<TestCase, 'testCaseResult'>,
  results: unknown[],
  isVersionPage: boolean
) => !isVersionPage && isEmpty(results) && isUndefined(testCase.testCaseResult);
