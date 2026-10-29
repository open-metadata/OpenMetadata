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

import { Box } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import { ObservabilityAlertActionsProps } from '../ObservabilityAlertsPage.interface';
import ObservabilityAlertActions from './ObservabilityAlertActions';

const alert: EventSubscription = {
  id: 'alert-id',
  name: 'classic-alert',
  fullyQualifiedName: 'classic-alert',
  alertType: AlertType.Observability,
  destinations: [],
  provider: ProviderType.User,
};

const renderActions = (props: Partial<ObservabilityAlertActionsProps> = {}) => {
  const onSelectAlert = jest.fn();
  render(
    <ObservabilityAlertActions
      alertPermission={{ id: alert.id, edit: true, delete: true }}
      loading={false}
      record={alert}
      onSelectAlert={onSelectAlert}
      {...props}
    />,
    { wrapper: MemoryRouter }
  );

  return { onSelectAlert };
};

describe('ObservabilityAlertActions', () => {
  it('links to the Classic edit page when no modal handler is supplied', () => {
    renderActions();

    expect(screen.getByRole('link', { name: 'label.edit' })).toHaveAttribute(
      'href',
      '/observability/alerts/edit/classic-alert'
    );
  });

  it('opens the AI edit handler with keyboard activation without bubbling to the row', async () => {
    const onEditAlert = jest.fn();
    const onRowClick = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <Box onClick={onRowClick}>
        <ObservabilityAlertActions
          alertPermission={{ id: alert.id, edit: true, delete: false }}
          loading={false}
          record={alert}
          onEditAlert={onEditAlert}
          onSelectAlert={jest.fn()}
        />
      </Box>
    );
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onEditAlert).toHaveBeenCalledWith(alert);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('selects the alert for deletion when permitted', () => {
    const { onSelectAlert } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'label.delete' }));

    expect(onSelectAlert).toHaveBeenCalledWith(alert);
  });

  it('prevents deleting a system alert', () => {
    const { onSelectAlert } = renderActions({
      record: { ...alert, provider: ProviderType.System },
    });
    const deleteButton = screen.getByRole('button', { name: 'label.delete' });

    expect(deleteButton).toBeDisabled();

    fireEvent.click(deleteButton);

    expect(onSelectAlert).not.toHaveBeenCalled();
  });

  it('hides edit and delete controls when permission is absent', () => {
    renderActions({ alertPermission: undefined });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
