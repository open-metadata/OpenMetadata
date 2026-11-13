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
  reasons: string[];
  // A stored configuration does not send until it is changed, unlike a failed send.
  isConfigurationUnusable: boolean;
}

// A destination's and a profile webhook's status share this shape, typed per generated file.
interface ReportedStatus {
  status?: string;
  lastFailedReason?: string;
  configurationUnusable?: boolean;
}

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

/**
 * The status an alert shows in a list: failed while any of its destinations reads failed, with
 * their reasons; otherwise disabled or active, as the alert is switched.
 */
export const getAlertListStatus = (
  alert: EventSubscription
): AlertListStatusDetails => {
  const failed = (alert.destinations ?? [])
    .map((destination) => destination.statusDetails)
    .filter((statusDetails) => statusDetails?.status === Status.Failed);

  if (failed.length > 0) {
    return {
      status: Status.Failed,
      reasons: failed
        .map((statusDetails) => statusDetails?.lastFailedReason)
        .filter((reason): reason is string => Boolean(reason)),
      isConfigurationUnusable: failed.some(
        (statusDetails) => statusDetails?.configurationUnusable
      ),
    };
  }

  return {
    status: alert.enabled === false ? Status.Disabled : Status.Active,
    reasons: [],
    isConfigurationUnusable: false,
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
