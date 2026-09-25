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
import { NotificationView } from './Notification.types';
import NotificationPanel from './NotificationPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}` : key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Button: jest.fn().mockImplementation(({ children, onPress, ...props }) => (
    <button {...props} onClick={onPress}>
      {children}
    </button>
  )),
}));

jest.mock('@untitledui/icons', () => ({
  Bell01: jest.fn(() => <span data-testid="bell-icon" />),
}));

let mockSubPath = '';
const mockSetHash = jest.fn((_tab: string, subPath?: string) => {
  mockSubPath = subPath ?? '';
});

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'notification', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
    clearHash: jest.fn(),
    updateParams: jest.fn(),
  }),
}));

const mockCheckPermission = jest.fn().mockReturnValue(true);

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      permissions: {
        eventSubscription: { Create: true },
      },
    }),
  })
);

let capturedLandingProps: { onNavigate: (v: NotificationView) => void };

jest.mock('./NotificationLanding', () =>
  jest.fn((props) => {
    capturedLandingProps = props;

    return <div data-testid="notification-landing" />;
  })
);

jest.mock('./NotificationAlertsPanel', () =>
  jest.fn(() => <div data-testid="notification-alerts-panel" />)
);

jest.mock('./NotificationAlertForm', () =>
  jest.fn(() => <div data-testid="notification-alert-form" />)
);

jest.mock('./NotificationAlertDetail', () =>
  jest.fn(() => <div data-testid="notification-alert-detail" />)
);

describe('NotificationPanel', () => {
  const mockOnHeaderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubPath = '';
  });

  it('should render NotificationLanding by default', () => {
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-landing')).toBeInTheDocument();
  });

  it('should render NotificationAlertsPanel when navigated to list view', () => {
    mockSubPath = 'alerts';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alerts-panel')).toBeInTheDocument();
  });

  it('should call onHeaderChange with breadcrumbs and title on mount', () => {
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(mockOnHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        breadcrumbs: expect.any(Array),
        description: expect.any(String),
      })
    );
  });

  it('should render NotificationAlertForm when navigated to add view', () => {
    mockSubPath = 'alerts/add';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alert-form')).toBeInTheDocument();
  });

  it('should render NotificationAlertDetail when navigated to detail view', () => {
    mockSubPath = 'alerts/test-fqn';
    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('notification-alert-detail')).toBeInTheDocument();
  });

  it('should not show add-alert action when permission is denied', () => {
    mockCheckPermission.mockReturnValue(false);

    render(<NotificationPanel onHeaderChange={mockOnHeaderChange} />);

    act(() => {
      capturedLandingProps.onNavigate({ type: 'list' });
    });

    const lastCall =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];

    expect(lastCall.actions).toBeUndefined();
  });
});
