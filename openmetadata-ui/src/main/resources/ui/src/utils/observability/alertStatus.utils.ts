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

import { SUBSCRIPTION_WEBHOOK } from '../../constants/Teams.constants';
import { MessagingProviderStatus } from '../../generated/entity/teams/team';
import {
  EventSubscription,
  Status,
} from '../../generated/events/eventSubscription';

export type AlertListStatus = Status.Active | Status.Disabled | Status.Failed;

export interface AlertListStatusDetails {
  status: AlertListStatus;
  // Stored configurations that do not send until they are changed.
  unusableReasons: string[];
  // Sends that failed or wait for a retry.
  failureReasons: string[];
}

// A destination's and a profile webhook's status share this shape, typed per generated file.
interface ReportedStatus {
  status?: string;
  lastFailedReason?: string;
  configurationUnusable?: boolean;
}

// The statuses of a destination that is not sending: its last send failed, or waits to be retried.
const NOT_SENDING: ReadonlySet<string> = new Set([
  Status.Failed,
  Status.AwaitingRetry,
  Status.RetryLimitReached,
]);

/**
 * Why a destination or profile webhook does not send until its stored configuration is changed,
 * as the server reports it; nothing for a send that failed.
 */
export const getNotSendingReason = (
  statusDetails?: ReportedStatus
): string | undefined =>
  statusDetails?.status === Status.Failed && statusDetails.configurationUnusable
    ? statusDetails.lastFailedReason
    : undefined;

/** Why a destination is not sending: a stored configuration to change, or a send that failed. */
export interface DestinationProblem {
  kind: 'unusable' | 'sendFailed';
  reason: string;
}

const isNotSending = (statusDetails?: ReportedStatus) =>
  NOT_SENDING.has(statusDetails?.status ?? '');

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
 * The status an alert shows in a list: failed while any of its destinations is not sending, with
 * the stored configurations to change apart from the sends that failed; otherwise disabled or
 * active, as the alert is switched.
 */
export const getAlertListStatus = (
  alert: EventSubscription
): AlertListStatusDetails => {
  const statuses = (alert.destinations ?? []).map(
    (destination) => destination.statusDetails
  );
  const problems = statuses
    .map(getDestinationProblem)
    .filter((problem): problem is DestinationProblem => Boolean(problem));
  let status: AlertListStatus = Status.Active;
  if (statuses.some(isNotSending)) {
    status = Status.Failed;
  } else if (alert.enabled === false) {
    status = Status.Disabled;
  }

  return {
    status,
    unusableReasons: reasonsOf(problems, 'unusable'),
    failureReasons: reasonsOf(problems, 'sendFailed'),
  };
};

/** Why the team's profile webhook in `slot` does not send, as the server reports it. */
export const getWebhookNotSendingReason = (
  statuses: MessagingProviderStatus | undefined,
  slot: string | undefined
): string | undefined => {
  const webhook = Object.values(SUBSCRIPTION_WEBHOOK).find(
    (known) => known === slot
  );

  return webhook ? getNotSendingReason(statuses?.[webhook]) : undefined;
};
