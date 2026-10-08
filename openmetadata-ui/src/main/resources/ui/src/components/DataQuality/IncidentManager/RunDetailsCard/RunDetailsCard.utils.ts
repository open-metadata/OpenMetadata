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
import { toFiniteNumber } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { NO_VALUE } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
import {
  formatNumber,
  resolveParameterExpectation,
} from '../../../Database/Profiler/TestSummary/TestSummary.utils';

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

// A timeout as a message words it, the words standing alone: "runtime out of
// memory" is not one, nor is PostgreSQL's "time out of range".
const TIMEOUT_MESSAGE =
  /(?<![a-z])(?:timed[\s_-]?out|time[_-]?out|time\s+out(?!\s+of\b))/i;

/**
 * errorType is the driver's exception when a query failed (ingestion follows
 * SQLAlchemy's wrapper down to it), and a statement timeout surfaces there
 * under a name that does not say "timeout".
 */
const TIMEOUT_ERROR_TYPES = new Set(['QueryCanceled']);

// Zero is signed too, "+0 (+0.0%)", as the mock shows a run on target.
const withSign = (value: string, number: number) =>
  number >= 0 ? `+${value}` : value;

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

  const { expected, min, max } = resolveParameterExpectation(testCase);

  return isUndefined(expected) ? { min, max } : { expected };
};

export const formatExpectation = ({ expected, min, max }: RunExpectation) => {
  if (!isUndefined(expected)) {
    return formatNumber(expected);
  }
  if (!isUndefined(min) && !isUndefined(max)) {
    return `${formatNumber(min)} – ${formatNumber(max)}`;
  }
  if (!isUndefined(max)) {
    return `≤ ${formatNumber(max)}`;
  }

  return isUndefined(min) ? NO_VALUE : `≥ ${formatNumber(min)}`;
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
    return formatNumber(Number(values[0].value));
  }

  return values
    .map(({ name, value }) => `${name} ${formatNumber(Number(value))}`)
    .join(', ');
};

/** Signed absolute and percent difference, e.g. "-9,890 (-98.9%)". */
export const formatDifference = (found: number, expected: number) => {
  const difference = found - expected;
  const absolute = withSign(formatNumber(difference), difference);

  // A percentage of zero is undefined, so the absolute difference stands alone.
  if (expected === 0) {
    return absolute;
  }

  // Against the expected value's size, so the percent takes the difference's sign.
  const percent = (difference / Math.abs(expected)) * 100;

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
  // Only clock skew between the runner and the server makes a negative duration.
  if (milliseconds < 0) {
    return NO_VALUE;
  }
  if (milliseconds < 1) {
    return '<1ms';
  }
  // Fast queries finish in a few milliseconds, which one decimal of a second would show as 0.0s.
  if (Math.round(milliseconds) < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }

  // Rounded before the unit is chosen, so 59,950 ms reads as a minute rather than "60.0s".
  const seconds = Math.round(milliseconds / 100) / 10;

  return seconds < 60
    ? `${seconds.toFixed(1)}s`
    : convertMillisecondsToHumanReadableFormat(
        Math.round(milliseconds / 1000) * 1000
      );
};

/**
 * A driver can raise a timeout under a type that does not name it (SQLAlchemy's
 * `OperationalError`, or Snowflake's `ProgrammingError` for a statement
 * timeout), so the message counts too.
 */
export const isTimeoutError = (errorType?: string, message?: string) =>
  TIMEOUT_ERROR_TYPES.has(errorType ?? '') ||
  TIMEOUT_ERROR.test(errorType ?? '') ||
  TIMEOUT_MESSAGE.test(message ?? '');
