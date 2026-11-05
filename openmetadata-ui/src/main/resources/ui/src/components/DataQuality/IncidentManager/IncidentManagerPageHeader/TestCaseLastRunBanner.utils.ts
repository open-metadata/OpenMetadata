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
import { isUndefined } from 'lodash';
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { toFiniteNumber } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityFQN } from '../../../../utils/FeedUtilsPure';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { NO_VALUE } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
import {
  formatNumber,
  getMeasuredResult,
  getResultHistoryCaptionText,
} from '../../../Database/Profiler/TestSummary/TestSummary.utils';
import {
  formatExpectation,
  getFoundValue,
  getRunExpectation,
} from '../RunDetailsCard/RunDetailsCard.utils';
import {
  INCIDENT_RUN_STATUSES,
  INCIDENT_STATUS_CONFIG,
  METRIC_RUN_STATUSES,
} from './TestCaseLastRunBanner.constants';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
import type { TaskLinkInfo } from './useTestCaseIncidentHeader';

const getExpectedText = (
  testCase: TestCase | undefined,
  testCaseResult: TestCaseResult
) => {
  const predicted = toFiniteNumber(
    testCaseResult.testResultValue?.[0]?.predictedValue
  );

  if (!isUndefined(predicted)) {
    return formatNumber(predicted);
  }

  return testCase
    ? formatExpectation(getRunExpectation(testCase, testCaseResult))
    : NO_VALUE;
};

export const getRunDescription = (
  result: string | undefined,
  testCaseStatus: TestCaseStatus,
  queuedDescription: string
) =>
  result ||
  (testCaseStatus === TestCaseStatus.Queued ? queuedDescription : undefined);

export const getIncidentLink = (
  taskLinkInfo: TaskLinkInfo | null,
  testCaseStatus: TestCaseStatus
) => (INCIDENT_RUN_STATUSES.has(testCaseStatus) ? taskLinkInfo : null);

/**
 * The latest run's RESULT / EXPECTED pair, read through the run details card's
 * helpers so the two cannot disagree. A result is rarely named like its
 * parameter (`rowCount` against `value`), so there is no name lookup.
 */
export const getMetricSummary = (
  testCase: TestCase | undefined,
  testCaseResult: TestCaseResult,
  testCaseStatus: TestCaseStatus
) => {
  const found = getFoundValue(
    testCase ? getMeasuredResult(testCase, testCaseResult) : testCaseResult
  );
  const expectedValue = getExpectedText(testCase, testCaseResult);

  return {
    expectedValue,
    resultValue: isUndefined(found) ? undefined : formatNumber(found),
    show:
      METRIC_RUN_STATUSES.has(testCaseStatus) &&
      !isUndefined(found) &&
      expectedValue !== NO_VALUE,
  };
};

export const getIncidentMetadata = (
  incidentTitle: string | undefined,
  testCaseStatusData: TestCaseLastRunBannerProps['testCaseStatusData'],
  incidentLink: TaskLinkInfo | null
) => {
  const incidentStatus = testCaseStatusData?.testCaseResolutionStatusType;

  return {
    // Never the run's result: the banner shows it already, as the reason.
    description: incidentTitle ?? testCaseStatusData?.failureSummary,
    id: incidentLink
      ? `INC-${incidentLink.label.replace(/^#/, '')}`
      : undefined,
    statusConfig: incidentStatus
      ? INCIDENT_STATUS_CONFIG[incidentStatus]
      : undefined,
  };
};

/**
 * The incident in a line, as the mock heads it ("Row count dropped 99% on
 * customers"): what the test checks, and on which table. The task's own name,
 * "Request TestCase Failure Resolution for …", said neither.
 */
export const getIncidentTitle = (
  testCase: TestCase | undefined,
  t: TFunction
) =>
  testCase
    ? t('message.check-on-table', {
        check: getResultHistoryCaptionText(testCase, t),
        table: getNameFromFQN(getEntityFQN(testCase.entityLink)),
      })
    : undefined;

/**
 * The not-run banner's line. It asks for a pipeline only when the test is
 * known to have no scheduled run; while the schedule is unknown it says no
 * more than that the test has not run.
 *
 * Like getNextRunLabel, it compares the clock at render with a next run that
 * is fetched once: a page left open past that run reads it as unscheduled on
 * its next render, until the page is loaded again.
 */
export const getNotRunMessageKey = (
  nextRunTimestamp: number | null | undefined,
  now = Date.now()
) => {
  if (isUndefined(nextRunTimestamp)) {
    return 'message.test-case-has-not-run';
  }

  return nextRunTimestamp && nextRunTimestamp > now
    ? 'message.test-case-first-run-scheduled'
    : 'message.test-case-not-run-yet';
};

export const getNextRunLabel = (
  nextRunTimestamp: number | null | undefined,
  inLabel: string,
  notScheduledLabel: string
) => {
  // Unknown while the schedule loads or after it failed to, which is not the
  // same as unscheduled.
  if (isUndefined(nextRunTimestamp)) {
    return NO_VALUE;
  }
  if (!nextRunTimestamp) {
    return notScheduledLabel;
  }

  const millisecondsUntilNextRun =
    Math.ceil((nextRunTimestamp - Date.now()) / 60_000) * 60_000;

  if (millisecondsUntilNextRun <= 0) {
    return notScheduledLabel;
  }

  return `${inLabel} ${convertMillisecondsToHumanReadableFormat(
    millisecondsUntilNextRun,
    2
  )}`;
};
