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

import { render, screen } from '@testing-library/react';
import {
  AlertType,
  EventSubscription,
  Status,
  SubscriptionCategory,
  SubscriptionType,
  TionStatus,
} from '../../../../generated/events/eventSubscription';
import AlertStatusBadge from './AlertStatusBadge';

const UNUSABLE = "The value at '/authType/secretKey' must be entered again";
const REFUSED = 'Webhook failed with status: 503';
const UNUSABLE_STATUS: TionStatus = {
  status: Status.Failed,
  lastFailedReason: UNUSABLE,
  configurationUnusable: true,
};

const alertWith = (
  statuses: TionStatus[],
  enabled = true
): EventSubscription => ({
  alertType: AlertType.Observability,
  enabled,
  id: 'alert-id',
  name: 'alert',
  destinations: statuses.map((statusDetails) => ({
    category: SubscriptionCategory.External,
    type: SubscriptionType.Webhook,
    statusDetails,
  })),
});

describe('AlertStatusBadge', () => {
  it('shows an alert whose configuration cannot send as failed, with the value to change', () => {
    render(<AlertStatusBadge alert={alertWith([UNUSABLE_STATUS])} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.failed'
    );
    expect(screen.getByTestId('alert-status-reason')).toHaveAccessibleName(
      `label.failed. message.destination-does-not-send-until-fixed: ${UNUSABLE}`
    );
  });

  it.each([Status.Failed, Status.AwaitingRetry, Status.RetryLimitReached])(
    'names a %s send by its failure reason',
    (status) => {
      render(
        <AlertStatusBadge
          alert={alertWith([{ status, lastFailedReason: REFUSED }])}
        />
      );

      expect(screen.getByTestId('alert-status')).toHaveTextContent(
        'label.failed'
      );
      expect(screen.getByTestId('alert-status-reason')).toHaveAccessibleName(
        `label.failed. label.failure-reason: ${REFUSED}`
      );
    }
  );

  it('keeps the value to change apart from a failed send', () => {
    render(
      <AlertStatusBadge
        alert={alertWith([
          UNUSABLE_STATUS,
          { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
        ])}
      />
    );

    expect(screen.getByTestId('alert-status-reason')).toHaveAccessibleName(
      `label.failed. message.destination-does-not-send-until-fixed: ${UNUSABLE}. label.failure-reason: ${REFUSED}`
    );
  });

  it('shows an alert that sends as active, with no reason to read', () => {
    render(<AlertStatusBadge alert={alertWith([{ status: Status.Active }])} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.active'
    );
    expect(screen.queryByTestId('alert-status-reason')).not.toBeInTheDocument();
  });

  it('shows a switched-off alert as disabled', () => {
    render(
      <AlertStatusBadge
        alert={alertWith([{ status: Status.Disabled }], false)}
      />
    );

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.disabled'
    );
  });
});
