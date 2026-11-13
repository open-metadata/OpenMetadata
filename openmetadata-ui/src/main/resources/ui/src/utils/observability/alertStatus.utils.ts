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

// Each distinct reason once, in the order the destinations give them.
const reasonsOf = (statuses: ReportedStatus[]) => [
  ...new Set(
    statuses
      .map((statusDetails) => statusDetails.lastFailedReason)
      .filter((reason): reason is string => Boolean(reason))
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
  const notSending = (alert.destinations ?? [])
    .map((destination) => destination.statusDetails ?? {})
    .filter((statusDetails) => NOT_SENDING.has(statusDetails.status ?? ''));
  const unusable = notSending.filter((it) => getNotSendingReason(it));
  const failed = notSending.filter((it) => !getNotSendingReason(it));
  let status: AlertListStatus = Status.Active;
  if (notSending.length > 0) {
    status = Status.Failed;
  } else if (alert.enabled === false) {
    status = Status.Disabled;
  }

  return {
    status,
    unusableReasons: reasonsOf(unusable),
    failureReasons: reasonsOf(failed),
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
