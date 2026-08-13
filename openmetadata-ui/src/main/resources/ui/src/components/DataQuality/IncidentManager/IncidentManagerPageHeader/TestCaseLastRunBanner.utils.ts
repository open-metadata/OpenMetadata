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

import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import {
  INCIDENT_RUN_STATUSES,
  INCIDENT_STATUS_CONFIG,
  METRIC_RUN_STATUSES,
} from './TestCaseLastRunBanner.constants';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
import type { TaskLinkInfo } from './useTestCaseIncidentHeader';

type TestResultValues = NonNullable<
  TestCaseLastRunBannerProps['testCaseResult']
>['testResultValue'];

const formatMetricValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : value;
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

export const getMetricSummary = (
  parameterValues: TestCaseLastRunBannerProps['parameterValues'],
  testResultValue: TestResultValues,
  testCaseStatus: TestCaseStatus
) => {
  const metric = testResultValue?.[0];
  const resultValue = formatMetricValue(metric?.value);
  const matchingParameter = parameterValues?.find(
    ({ name }) => name === metric?.name
  );
  const expectedValue = formatMetricValue(
    metric?.predictedValue ?? matchingParameter?.value
  );

  return {
    expectedValue,
    resultValue,
    show:
      METRIC_RUN_STATUSES.has(testCaseStatus) &&
      resultValue !== undefined &&
      expectedValue !== undefined,
  };
};

export const getIncidentMetadata = (
  incidentTitle: string | undefined,
  testCaseStatusData: TestCaseLastRunBannerProps['testCaseStatusData'],
  result: string | undefined,
  incidentLink: TaskLinkInfo | null
) => {
  const incidentStatus = testCaseStatusData?.testCaseResolutionStatusType;

  return {
    description: incidentTitle ?? testCaseStatusData?.failureSummary ?? result,
    id: incidentLink
      ? `INC–${incidentLink.label.replace(/^#/, '')}`
      : undefined,
    statusConfig: incidentStatus
      ? INCIDENT_STATUS_CONFIG[incidentStatus]
      : undefined,
  };
};

export const getIncidentTitle = (
  incidentTask: NonNullable<TestCaseLastRunBannerProps['incidentTask']>,
  taskTypeLabel: string
) => {
  const entityFQN = incidentTask.about?.fullyQualifiedName;
  const entityName = entityFQN
    ? getNameFromFQN(entityFQN)
    : incidentTask.about?.name;
  const entityType = incidentTask.about?.type;

  return [taskTypeLabel, entityName, entityType ? `(${entityType})` : undefined]
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const getNextRunLabel = (
  nextRunTimestamp: number | undefined,
  inLabel: string,
  notScheduledLabel: string
) => {
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
