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
import { isUndefined, maxBy } from 'lodash';
import {
  TestCase,
  TestCaseDimensionResult,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import {
  getParameterBounds,
  toFiniteNumber,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { RESULT_METRIC_BY_DEFINITION } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
import { NO_VALUE } from './RunDetailsCard.constants';

export type RunResult = TestCaseResult | TestCaseDimensionResult;

export interface RunExpectation {
  expected?: number;
  min?: number;
  max?: number;
}

const COMPLETED_STATUSES = new Set<TestCaseStatus | undefined>([
  TestCaseStatus.Failed,
  TestCaseStatus.Success,
]);

const TIMEOUT_ERROR = /time(d)?[\s_-]?out/i;

const format = (value: number) => value.toLocaleString();

const withSign = (value: string, number: number) =>
  number > 0 ? `+${value}` : value;

/** The run the chart has selected, or the newest one when it has none. */
export const getSelectedRun = (
  results: RunResult[],
  selectedTimestamp?: number
) =>
  results.find(({ timestamp }) => timestamp === selectedTimestamp) ??
  maxBy(results, 'timestamp');

/**
 * What the run was measured against. A dynamic assertion learns its range per
 * run, so it comes from the result; everything else comes from the parameters
 * or, for tests like not-null, from what the definition implies.
 */
export const getRunExpectation = (
  testCase: TestCase,
  result: RunResult
): RunExpectation => {
  if (testCase.useDynamicAssertion) {
    return 'minBound' in result
      ? { min: result.minBound, max: result.maxBound }
      : {};
  }

  const { expected, min, max } = getParameterBounds(
    testCase.parameterValues ?? []
  );
  const expectedValue =
    expected ??
    RESULT_METRIC_BY_DEFINITION[testCase.testDefinition?.name ?? '']
      ?.impliedExpected;

  return isUndefined(expectedValue)
    ? { min, max }
    : { expected: expectedValue };
};

export const formatExpectation = ({ expected, min, max }: RunExpectation) => {
  if (!isUndefined(expected)) {
    return format(expected);
  }
  if (!isUndefined(min) && !isUndefined(max)) {
    return `${format(min)} – ${format(max)}`;
  }
  if (!isUndefined(max)) {
    return `≤ ${format(max)}`;
  }

  return isUndefined(min) ? NO_VALUE : `≥ ${format(min)}`;
};

/** The observed number, only when the run measured exactly one thing. */
export const getFoundValue = (result: RunResult) => {
  const values = result.testResultValue ?? [];

  return values.length === 1 ? toFiniteNumber(values[0].value) : undefined;
};

export const formatFound = (result: RunResult) => {
  const values = (result.testResultValue ?? []).filter(
    ({ value }) => !isUndefined(toFiniteNumber(value))
  );

  if (values.length === 0) {
    return NO_VALUE;
  }
  if (values.length === 1) {
    return format(Number(values[0].value));
  }

  return values
    .map(({ name, value }) => `${name} ${format(Number(value))}`)
    .join(', ');
};

/** Signed absolute and percent difference, e.g. "-9,890 (-98.9%)". */
export const formatDifference = (found: number, expected: number) => {
  const difference = found - expected;
  const absolute = withSign(format(difference), difference);

  // A percentage of zero is undefined, so the absolute difference stands alone.
  if (expected === 0) {
    return absolute;
  }

  const percent = (difference / expected) * 100;

  return `${absolute} (${withSign(percent.toFixed(1), percent)}%)`;
};

export interface ComparisonBar {
  kind: 'found' | 'expected';
  value: number;
  /** Share of the longer bar, in percent. */
  width: number;
}

/**
 * Found and Expected drawn to one scale, or no bars when they would mislead:
 * a negative value has no length, and two zeros have no scale.
 */
export const getComparisonBars = (
  found: number,
  expected: number
): ComparisonBar[] => {
  const scale = Math.max(found, expected);

  if (found < 0 || expected < 0 || scale === 0) {
    return [];
  }

  return [
    { kind: 'found', value: found, width: (found * 100) / scale },
    {
      kind: 'expected',
      value: expected,
      width: (expected * 100) / scale,
    },
  ];
};

/**
 * The card's text values and bars for one run. Only a completed run has a
 * found value to show or compare; a queued or aborted one shows dashes.
 */
export const getRunDetails = (testCase: TestCase, result: RunResult) => {
  const expectation = getRunExpectation(testCase, result);
  const details = {
    expectedText: formatExpectation(expectation),
    foundText: NO_VALUE,
    differenceText: NO_VALUE,
    bars: [] as ComparisonBar[],
  };

  if (!COMPLETED_STATUSES.has(result.testCaseStatus)) {
    return details;
  }

  details.foundText = formatFound(result);
  const found = getFoundValue(result);
  const { expected } = expectation;

  if (isUndefined(found) || isUndefined(expected)) {
    return details;
  }

  return {
    ...details,
    differenceText: formatDifference(found, expected),
    bars: getComparisonBars(found, expected),
  };
};

export const formatRunDuration = (milliseconds: number) => {
  // Fast queries finish in a few milliseconds, which one decimal of a second would show as 0.0s.
  if (Math.round(milliseconds) < 1000) {
    return `${Math.max(1, Math.round(milliseconds))}ms`;
  }

  return milliseconds < 60_000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : convertMillisecondsToHumanReadableFormat(milliseconds);
};

export const isTimeoutError = (errorType?: string) =>
  TIMEOUT_ERROR.test(errorType ?? '');
