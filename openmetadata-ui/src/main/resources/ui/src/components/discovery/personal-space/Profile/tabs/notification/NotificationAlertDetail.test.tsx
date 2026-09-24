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

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import NotificationAlertDetail from './NotificationAlertDetail';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
  ButtonUtility: jest.fn().mockImplementation(({ onPress, ...props }) => (
    <button {...props} onClick={onPress}>
      {props['data-testid']}
    </button>
  )),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Owner: jest.fn().mockImplementation(() => <div data-testid="owner-component" />),
  Tabs: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    {
      List: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
      Item: jest
        .fn()
        .mockImplementation(({ children, id }) => (
          <div data-testid={`tab-${id}`}>{children}</div>
        )),
    }
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Delete: jest.fn(() => <span>delete-icon</span>),
  Edit: jest.fn(() => <span>edit-icon</span>),
}));

jest.mock('@untitledui/icons', () => ({
  RefreshCw01: jest.fn(() => <span>refresh-icon</span>),
}));

jest.mock('../../../../../../rest/alertsAPI', () => ({
  getAlertsFromName: jest.fn().mockResolvedValue({
    id: 'alert-1',
    name: 'test-alert',
    fullyQualifiedName: 'test-alert',
    provider: 'user',
    description: 'Test description',
    owners: [],
    destinations: [
      {
        timeout: 10,
        readTimeout: 30,
        type: 'email',
        category: 'External',
        config: {},
      },
    ],
  }),
  updateNotificationAlert: jest.fn().mockResolvedValue({
    id: 'alert-1',
    name: 'test-alert',
    fullyQualifiedName: 'test-alert',
    provider: 'user',
    description: 'Test description',
    owners: [],
    destinations: [
      {
        timeout: 10,
        readTimeout: 30,
        type: 'email',
        category: 'External',
        config: {},
      },
    ],
  }),
}));

jest.mock('../../../../../../rest/observabilityAPI', () => ({
  getDiagnosticInfo: jest.fn().mockResolvedValue({
    successfulEventsCount: 10,
    failedEventsCount: 2,
    latestOffset: 100,
    currentOffset: 95,
  }),
  syncOffset: jest.fn().mockResolvedValue(undefined),
}));

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: jest.fn().mockReturnValue({
      hasViewAccess: true,
      canEditAll: true,
      canEditDescription: true,
      canDelete: true,
      isLoading: false,
    }),
  })
);

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: jest.fn().mockReturnValue({
    state: { params: {} },
    updateParams: jest.fn(),
  }),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../../../constants/HelperTextUtil', () => ({
  NO_PERMISSION_FOR_ACTION: 'no-permission',
}));

jest.mock('../../../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('../../../../../common/DeleteModal/DeleteModal', () =>
  jest.fn(({ open, onDelete }) =>
    open ? (
      <div data-testid="delete-modal">
        <button data-testid="confirm-delete" onClick={onDelete}>
          confirm
        </button>
      </div>
    ) : null
  )
);

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(() => <div data-testid="rich-text-editor" />)
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditor.interface',
  () => ({})
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn(({ markdown }) => <span>{markdown}</span>)
);

jest.mock(
  '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest.fn(() => (
      <div data-testid="user-team-selectable-list" />
    )),
  })
);

jest.mock('./NotificationAlertConfigView', () =>
  jest.fn(() => <div data-testid="alert-config-view" />)
);

jest.mock('./NotificationDiagnosticInfo', () =>
  jest.fn(() => <div data-testid="diagnostic-info" />)
);

jest.mock('./NotificationRecentEvents', () =>
  jest.fn(() => <div data-testid="recent-events" />)
);

jest.mock('fast-json-patch', () => ({
  compare: jest.fn().mockReturnValue([]),
}));

describe('NotificationAlertDetail', () => {
  const mockOnNavigate = jest.fn();
  const mockOnNameResolved = jest.fn();
  const mockOnSetHeaderActions = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show loader initially', () => {
    render(
      <NotificationAlertDetail
        fqn="test-alert"
        onNavigate={mockOnNavigate}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render tabs after loading', async () => {
    await act(async () => {
      render(
        <NotificationAlertDetail
          fqn="test-alert"
          onNavigate={mockOnNavigate}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-configuration')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tab-recentEvents')).toBeInTheDocument();
    expect(screen.getByTestId('tab-diagnostic-info')).toBeInTheDocument();
  });

  it('should call onNameResolved with alert name after loading', async () => {
    await act(async () => {
      render(
        <NotificationAlertDetail
          fqn="test-alert"
          onNameResolved={mockOnNameResolved}
          onNavigate={mockOnNavigate}
        />
      );
    });

    await waitFor(() => {
      expect(mockOnNameResolved).toHaveBeenCalledWith('test-alert');
    });
  });

  it('should call onSetHeaderActions with header buttons after loading', async () => {
    await act(async () => {
      render(
        <NotificationAlertDetail
          fqn="test-alert"
          onNavigate={mockOnNavigate}
          onSetHeaderActions={mockOnSetHeaderActions}
        />
      );
    });

    await waitFor(() => {
      expect(mockOnSetHeaderActions).toHaveBeenCalled();
    });

    const headerActions = mockOnSetHeaderActions.mock.calls[0][0];

    expect(headerActions).toBeDefined();
  });
});
