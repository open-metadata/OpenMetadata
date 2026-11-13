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
} from '../../../../generated/events/eventSubscription';
import AlertStatusBadge from './AlertStatusBadge';

const REASON = "The value at '/authType/secretKey' must be entered again";

const alertWith = (status: Status, enabled = true): EventSubscription => ({
  alertType: AlertType.Observability,
  enabled,
  id: 'alert-id',
  name: 'alert',
  destinations: [
    {
      category: SubscriptionCategory.External,
      type: SubscriptionType.Webhook,
      statusDetails: {
        status,
        lastFailedReason: status === Status.Failed ? REASON : undefined,
        configurationUnusable: status === Status.Failed ? true : undefined,
      },
    },
  ],
});

describe('AlertStatusBadge', () => {
  it('shows an alert whose destination does not send as failed, with the reason', () => {
    render(<AlertStatusBadge alert={alertWith(Status.Failed)} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.failed'
    );
    expect(screen.getByTestId('alert-status-reason')).toHaveAccessibleName(
      `label.failed. message.destination-does-not-send-until-fixed: ${REASON}`
    );
  });

  it('shows an alert that sends as active, with no reason to read', () => {
    render(<AlertStatusBadge alert={alertWith(Status.Active)} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.active'
    );
    expect(screen.queryByTestId('alert-status-reason')).not.toBeInTheDocument();
  });

  it('shows a switched-off alert as disabled', () => {
    render(<AlertStatusBadge alert={alertWith(Status.Disabled, false)} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.disabled'
    );
  });

  it('names a failed send by its reason, not as a configuration to change', () => {
    const alert = alertWith(Status.Failed);
    alert.destinations[0].statusDetails = {
      status: Status.Failed,
      lastFailedReason: 'Webhook failed with status: 503',
    };
    render(<AlertStatusBadge alert={alert} />);

    expect(screen.getByTestId('alert-status')).toHaveTextContent(
      'label.failed'
    );
    expect(screen.getByTestId('alert-status-reason')).toHaveAccessibleName(
      'label.failed. label.failure-reason: Webhook failed with status: 503'
    );
  });
});
