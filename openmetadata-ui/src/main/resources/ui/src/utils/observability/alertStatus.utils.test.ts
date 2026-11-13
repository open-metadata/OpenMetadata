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
  TionStatus,
} from '../../generated/events/eventSubscription';
import {
  getAlertListStatus,
  getDestinationProblem,
  getNotSendingReason,
} from './alertStatus.utils';

const UNUSABLE = "The value at '/authType/secretKey' must be entered again";
const REFUSED = 'Webhook failed with status: 503';

const alertWith = (
  statuses: TionStatus[],
  enabled = true
): EventSubscription => ({
  alertType: AlertType.Notification,
  enabled,
  id: 'alert-id',
  name: 'alert',
  destinations: statuses.map((statusDetails) => ({
    category: SubscriptionCategory.External,
    type: SubscriptionType.Webhook,
    statusDetails,
  })),
});

describe('alertStatus.utils', () => {
  it('reads a reason to change the settings only from an unusable configuration', () => {
    expect(
      getNotSendingReason({
        status: Status.Failed,
        lastFailedReason: UNUSABLE,
        configurationUnusable: true,
      })
    ).toBe(UNUSABLE);
    expect(
      getNotSendingReason({ status: Status.Failed, lastFailedReason: REFUSED })
    ).toBeUndefined();
    expect(getNotSendingReason(undefined)).toBeUndefined();
  });

  it.each([
    [
      'active',
      { status: Status.Active },
      { status: Status.Active, unusableReasons: [], failureReasons: [] },
    ],
    [
      'failed, configuration unusable',
      {
        status: Status.Failed,
        lastFailedReason: UNUSABLE,
        configurationUnusable: true,
      },
      {
        status: Status.Failed,
        unusableReasons: [UNUSABLE],
        failureReasons: [],
      },
    ],
    [
      'failed send',
      { status: Status.Failed, lastFailedReason: 'Connection refused' },
      {
        status: Status.Failed,
        unusableReasons: [],
        failureReasons: ['Connection refused'],
      },
    ],
    [
      'awaiting retry',
      { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
      { status: Status.Failed, unusableReasons: [], failureReasons: [REFUSED] },
    ],
    [
      'retry limit reached',
      { status: Status.RetryLimitReached, lastFailedReason: REFUSED },
      { status: Status.Failed, unusableReasons: [], failureReasons: [REFUSED] },
    ],
    [
      'disabled destination',
      { status: Status.Disabled },
      { status: Status.Active, unusableReasons: [], failureReasons: [] },
    ],
  ])('lists a destination that is %s', (_, statusDetails, expected) => {
    expect(getAlertListStatus(alertWith([statusDetails]))).toEqual(expected);
  });

  it('lists a switched-off alert as disabled', () => {
    expect(
      getAlertListStatus(alertWith([{ status: Status.Disabled }], false))
    ).toEqual({
      status: Status.Disabled,
      unusableReasons: [],
      failureReasons: [],
    });
  });

  it('keeps an unusable configuration apart from a failed send', () => {
    expect(
      getAlertListStatus(
        alertWith([
          {
            status: Status.Failed,
            lastFailedReason: UNUSABLE,
            configurationUnusable: true,
          },
          { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
        ])
      )
    ).toEqual({
      status: Status.Failed,
      unusableReasons: [UNUSABLE],
      failureReasons: [REFUSED],
    });
  });

  it('lists a reason that several destinations share once, in their order', () => {
    expect(
      getAlertListStatus(
        alertWith([
          { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
          { status: Status.Failed, lastFailedReason: 'Connection refused' },
          { status: Status.RetryLimitReached, lastFailedReason: REFUSED },
        ])
      ).failureReasons
    ).toEqual([REFUSED, 'Connection refused']);
  });

  it.each([
    [
      'failed, configuration unusable',
      {
        status: Status.Failed,
        lastFailedReason: UNUSABLE,
        configurationUnusable: true,
      },
      { kind: 'unusable', reason: UNUSABLE },
    ],
    [
      'failed send',
      { status: Status.Failed, lastFailedReason: 'Connection refused' },
      { kind: 'sendFailed', reason: 'Connection refused' },
    ],
    [
      'awaiting retry',
      { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
      { kind: 'sendFailed', reason: REFUSED },
    ],
    [
      'retry limit reached',
      { status: Status.RetryLimitReached, lastFailedReason: REFUSED },
      { kind: 'sendFailed', reason: REFUSED },
    ],
    ['active', { status: Status.Active }, undefined],
    [
      'disabled',
      { status: Status.Disabled, lastFailedReason: REFUSED },
      undefined,
    ],
    ['failed without a reason', { status: Status.Failed }, undefined],
    ['without a status', undefined, undefined],
  ])(
    'names the problem of a destination that is %s',
    (_, statusDetails, expected) => {
      expect(getDestinationProblem(statusDetails)).toEqual(expected);
    }
  );
});
