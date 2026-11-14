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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AlertType,
  EventSubscription,
  Status,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import { DestinationStatus } from '../../../../utils/observability/alerts/alertStatus.utils';
import AlertStatusBadge from './AlertStatusBadge';

const UNUSABLE = "The value at '/authType/secretKey' must be entered again";
const REFUSED = 'Webhook failed with status: 503';
const UNUSABLE_STATUS: DestinationStatus = {
  status: Status.Failed,
  lastFailedReason: UNUSABLE,
  configurationUnusable: true,
};

const alertWith = (
  statuses: DestinationStatus[],
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

// A keyboard reaches the badge, and focus shows its reasons.
const reasonsOnFocus = async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.tab();
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });

  return screen.getByRole('tooltip');
};

describe('AlertStatusBadge', () => {
  it('shows an alert whose configuration cannot send as failed, with the value to change', async () => {
    render(<AlertStatusBadge alert={alertWith([UNUSABLE_STATUS])} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.failed'
    );

    const tooltip = await reasonsOnFocus();

    expect(tooltip).toHaveTextContent(
      'message.destination-does-not-send-until-fixed'
    );
    expect(tooltip).toHaveTextContent(UNUSABLE);
    expect(screen.getByRole('button')).toHaveAccessibleDescription(
      expect.stringContaining(UNUSABLE)
    );
  });

  it.each([Status.Failed, Status.AwaitingRetry, Status.RetryLimitReached])(
    'names a %s send by its failure reason',
    async (status) => {
      render(
        <AlertStatusBadge
          alert={alertWith([{ status, lastFailedReason: REFUSED }])}
        />
      );

      expect(screen.getByTestId('alert-status')).toHaveTextContent(
        'label.failed'
      );

      const tooltip = await reasonsOnFocus();

      expect(tooltip).toHaveTextContent('label.failure-reason');
      expect(tooltip).toHaveTextContent(REFUSED);
    }
  );

  it('keeps the value to change apart from a failed send', async () => {
    render(
      <AlertStatusBadge
        alert={alertWith([
          UNUSABLE_STATUS,
          { status: Status.AwaitingRetry, lastFailedReason: REFUSED },
        ])}
      />
    );

    const tooltip = await reasonsOnFocus();

    expect(tooltip).toHaveTextContent(
      `message.destination-does-not-send-until-fixed${UNUSABLE}label.failure-reason${REFUSED}`
    );
  });

  it('shows an alert that sends as active, with no reason to read', () => {
    render(<AlertStatusBadge alert={alertWith([{ status: Status.Active }])} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.active'
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a switched-off alert as disabled, even with a failure left from before', () => {
    render(
      <AlertStatusBadge
        alert={alertWith([UNUSABLE_STATUS, { status: Status.Disabled }], false)}
      />
    );

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.disabled'
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
