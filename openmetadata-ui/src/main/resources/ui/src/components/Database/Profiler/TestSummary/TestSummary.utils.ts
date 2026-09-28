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
import { isUndefined } from 'lodash';
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

const format = (value: number) => value.toLocaleString();

const getComparison = (
  testCase: TestCase,
  impliedExpected?: number
): CaptionPart | undefined => {
  if (testCase.useDynamicAssertion) {
    return { key: 'label.caption-learned-range' };
  }

  const { expected, min, max, threshold } = getParameterBounds(
    testCase.parameterValues ?? []
  );
  const expectedValue = expected ?? impliedExpected;

  if (!isUndefined(expectedValue)) {
    return {
      key: 'label.caption-expected-value',
      values: { value: format(expectedValue) },
    };
  }

  if (!isUndefined(min) && !isUndefined(max)) {
    return {
      key: 'label.caption-allowed-range',
      values: { min: format(min), max: format(max) },
    };
  }

  if (!isUndefined(max)) {
    return { key: 'label.caption-allowed-max', values: { value: format(max) } };
  }

  if (!isUndefined(min)) {
    return { key: 'label.caption-allowed-min', values: { value: format(min) } };
  }

  return isUndefined(threshold)
    ? undefined
    : { key: 'label.caption-threshold', values: { value: format(threshold) } };
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
  const comparison = getComparison(testCase, metric.impliedExpected);

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
