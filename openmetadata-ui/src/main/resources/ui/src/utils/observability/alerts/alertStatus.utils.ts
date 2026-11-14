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

import { TFunction } from 'i18next';
import {
  Destination,
  EventSubscription,
  Status,
} from '../../../generated/events/eventSubscription';

export type AlertListStatus = Status.Active | Status.Disabled | Status.Failed;

export interface AlertListStatusDetails {
  status: AlertListStatus;
  // Stored configurations that do not send until they are changed.
  unusableReasons: string[];
  // Sends that failed or wait for a retry.
  failureReasons: string[];
}

/** A destination's status, as the server reports it on the alert. */
export type DestinationStatus = NonNullable<Destination['statusDetails']>;

type ReportedStatus = Pick<
  DestinationStatus,
  'status' | 'lastFailedReason' | 'configurationUnusable'
>;

/** Why a destination is not sending: a stored configuration to change, or a send that failed. */
export interface DestinationProblem {
  kind: 'unusable' | 'sendFailed';
  reason: string;
}

// The statuses of a destination that is not sending: its last send failed, or waits to be retried.
const NOT_SENDING: ReadonlySet<Status | undefined> = new Set([
  Status.Failed,
  Status.AwaitingRetry,
  Status.RetryLimitReached,
]);

// Both stop the destination, so both read as errors; the title says which to act on.
const DESTINATION_PROBLEM_TITLE_KEY: Record<
  DestinationProblem['kind'],
  string
> = {
  unusable: 'message.destination-does-not-send-until-fixed',
  sendFailed: 'label.failure-reason',
};

const isNotSending = (statusDetails?: ReportedStatus) =>
  NOT_SENDING.has(statusDetails?.status);

/**
 * Why a destination does not send until its stored configuration is changed, as the server
 * reports it; nothing for a send that failed.
 */
export const getNotSendingReason = (
  statusDetails?: ReportedStatus
): string | undefined =>
  statusDetails?.status === Status.Failed && statusDetails.configurationUnusable
    ? statusDetails.lastFailedReason
    : undefined;

/**
 * Why a destination is not sending, as its stored status says: its configuration cannot be used,
 * or its last send failed or waits for a retry. Nothing for a destination that sends or is off.
 */
export const getDestinationProblem = (
  statusDetails?: ReportedStatus
): DestinationProblem | undefined => {
  const reason = isNotSending(statusDetails)
    ? statusDetails?.lastFailedReason
    : undefined;

  return reason
    ? {
        kind: getNotSendingReason(statusDetails) ? 'unusable' : 'sendFailed',
        reason,
      }
    : undefined;
};

/** The title and tone of the alert box that shows a destination's problem next to it. */
export const getDestinationProblemAlertProps = (
  problem: DestinationProblem,
  t: TFunction
) => ({
  title: t(DESTINATION_PROBLEM_TITLE_KEY[problem.kind]),
  variant: 'error' as const,
});

// Each distinct reason of one kind once, in the order the destinations give them.
const reasonsOf = (
  problems: DestinationProblem[],
  kind: DestinationProblem['kind']
) => [
  ...new Set(
    problems
      .filter((problem) => problem.kind === kind)
      .map((problem) => problem.reason)
  ),
];

/**
 * The status an alert shows in a list: disabled while it is switched off; otherwise failed while
 * any of its enabled destinations is not sending, with the stored configurations to change apart
 * from the sends that failed, and active when none is.
 */
export const getAlertListStatus = (
  alert: EventSubscription
): AlertListStatusDetails => {
  const switchedOff = alert.enabled === false;
  const statuses = switchedOff
    ? []
    : (alert.destinations ?? [])
        .filter((destination) => destination.enabled !== false)
        .map((destination) => destination.statusDetails);
  const problems = statuses
    .map(getDestinationProblem)
    .filter((problem): problem is DestinationProblem => Boolean(problem));
  let status: AlertListStatus = Status.Active;
  if (switchedOff) {
    status = Status.Disabled;
  } else if (statuses.some(isNotSending)) {
    status = Status.Failed;
  }

  return {
    status,
    unusableReasons: reasonsOf(problems, 'unusable'),
    failureReasons: reasonsOf(problems, 'sendFailed'),
  };
};
