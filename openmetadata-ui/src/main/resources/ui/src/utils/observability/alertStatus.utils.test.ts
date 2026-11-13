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

import {
  AlertType,
  EventSubscription,
  Status,
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { getAlertListStatus, getNotSendingReason } from './alertStatus.utils';

const REASON =
  "its stored configuration is not usable: The value at '/authType/secretKey' must be entered again";

const alertWith = (statuses: Status[], enabled = true): EventSubscription => ({
  alertType: AlertType.Notification,
  enabled,
  id: 'alert-id',
  name: 'alert',
  destinations: statuses.map((status) => ({
    category: SubscriptionCategory.External,
    type: SubscriptionType.Webhook,
    statusDetails: {
      status,
      lastFailedReason: status === Status.Failed ? REASON : undefined,
      configurationUnusable: status === Status.Failed ? true : undefined,
    },
  })),
});

describe('alertStatus.utils', () => {
  it('reads the reason only from a failed status', () => {
    expect(
      getNotSendingReason({
        status: Status.Failed,
        lastFailedReason: REASON,
        configurationUnusable: true,
      })
    ).toBe(REASON);
    expect(
      getNotSendingReason({ status: Status.Failed, lastFailedReason: REASON })
    ).toBeUndefined();
    expect(
      getNotSendingReason({
        status: Status.AwaitingRetry,
        lastFailedReason: REASON,
      })
    ).toBeUndefined();
    expect(getNotSendingReason(undefined)).toBeUndefined();
  });

  it('shows an alert with a failed destination as failed, with its reasons', () => {
    expect(
      getAlertListStatus(alertWith([Status.Active, Status.Failed]))
    ).toEqual({
      status: Status.Failed,
      reasons: [REASON],
      isConfigurationUnusable: true,
    });
  });

  it('shows an alert whose destinations send as active or disabled', () => {
    expect(getAlertListStatus(alertWith([Status.Active]))).toEqual({
      status: Status.Active,
      reasons: [],
      isConfigurationUnusable: false,
    });
    expect(getAlertListStatus(alertWith([Status.Disabled], false))).toEqual({
      status: Status.Disabled,
      reasons: [],
      isConfigurationUnusable: false,
    });
  });

  it('shows a failed send as failed, but not as a configuration to change', () => {
    const alert = alertWith([Status.Failed]);
    alert.destinations[0].statusDetails = {
      status: Status.Failed,
      lastFailedReason: 'Webhook failed with status: 503',
    };

    expect(getAlertListStatus(alert)).toEqual({
      status: Status.Failed,
      reasons: ['Webhook failed with status: 503'],
      isConfigurationUnusable: false,
    });
  });
});
