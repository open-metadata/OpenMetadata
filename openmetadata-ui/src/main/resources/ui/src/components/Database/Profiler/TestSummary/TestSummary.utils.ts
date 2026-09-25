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
  tolerance?: CaptionPart;
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

// On the `*ToEqual` tests `threshold` is how far a run may drift from the
// expected value; elsewhere it is the assertion itself and never a tolerance.
const getTolerance = (testCase: TestCase): CaptionPart | undefined => {
  const { expected, threshold } = getParameterBounds(
    testCase.parameterValues ?? []
  );

  if (isUndefined(expected) || !threshold) {
    return undefined;
  }

  const isPercentage = testCase.parameterValues?.some(
    (parameter) =>
      parameter.name === 'thresholdUnit' && parameter.value === 'PERCENTAGE'
  );

  return {
    key: 'label.caption-tolerance',
    values: { value: `${format(threshold)}${isPercentage ? '%' : ''}` },
  };
};

/**
 * The line under the chart card's title that says what the chart measures and
 * what it is measured against, e.g. "Row count vs. expected 10,000 · ±5%
 * tolerance". Returned as translation keys so the caller renders it in the
 * reader's language.
 */
export const getResultHistoryCaption = (
  testCase: TestCase
): ResultHistoryCaption => {
  const metric =
    RESULT_METRIC_BY_DEFINITION[testCase.testDefinition?.name ?? ''] ??
    DEFAULT_RESULT_METRIC;
  const comparison = getComparison(testCase, metric.impliedExpected);
  const tolerance = getTolerance(testCase);

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
    ...(tolerance && { tolerance }),
  };
};
