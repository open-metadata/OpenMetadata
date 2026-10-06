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
import NotificationAlertForm from './NotificationAlertForm';

const mockT = (key: string) => key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
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
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../../../../../../rest/alertsAPI', () => ({
  getResourceFunctions: jest.fn().mockResolvedValue({
    data: [{ name: 'table', supportedFilters: [] }],
  }),
  getAlertsFromName: jest.fn().mockResolvedValue({
    id: 'alert-1',
    name: 'test-alert',
    fullyQualifiedName: 'test-alert',
    provider: 'user',
  }),
  createNotificationAlert: jest.fn().mockResolvedValue({}),
  updateNotificationAlert: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    getModifiedAlertDataForForm: jest.fn().mockReturnValue({
      name: 'test-alert',
      displayName: 'Test Alert',
      destinations: [],
      timeout: 10,
      readTimeout: 30,
    }),
    handleAlertSave: jest.fn(),
    getAddAlertFormExtraWidgets: jest.fn().mockReturnValue({}),
    getAlertAiTemplateSection: jest.fn().mockReturnValue(null),
    getAddAlertFormExtraButtons: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockSetInlineAlertDetails = jest.fn();

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    setInlineAlertDetails: mockSetInlineAlertDetails,
    inlineAlertDetails: null,
    currentUser: { id: 'user-1' },
  }),
}));

const mockGetResourceLimit = jest.fn();

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({
    getResourceLimit: mockGetResourceLimit,
  }),
}));

const mockGetResourcePermission = jest.fn().mockResolvedValue({});

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({
      getResourcePermission: mockGetResourcePermission,
    }),
  })
);

jest.mock('../../../../../../utils/PermissionDerivation', () => ({
  getDerivedPermissionFlags: jest.fn().mockReturnValue({ canViewAll: false }),
}));

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {},
}));

jest.mock('../../../../../../constants/constants', () => ({
  PAGE_SIZE_LARGE: 50,
}));

jest.mock('../../../../../../constants/Alerts.constants', () => ({
  DEFAULT_READ_TIMEOUT: 30,
}));

jest.mock('../../../../../../rest/notificationtemplateAPI', () => ({
  getAllNotificationTemplates: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('../../../../../observability/Alerts/AlertAiForm.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="alert-ai-form" />),
}));

jest.mock(
  '../../../../../observability/Alerts/AlertAiFormFields.constants',
  () => ({
    ALERT_AI_DEFAULT_CONNECTION_TIMEOUT: 10,
    ALERT_AI_FORM_MODAL_ID: 'alert-form-modal',
  })
);

describe('NotificationAlertForm', () => {
  const mockOnNavigate = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render AlertAiForm after loading', async () => {
    const { getResourceFunctions } = jest.requireMock(
      '../../../../../../rest/alertsAPI'
    );
    getResourceFunctions.mockResolvedValue({ data: [] });

    await act(async () => {
      render(<NotificationAlertForm onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-ai-form')).toBeInTheDocument();
    });
  });

  it('should render cancel and save buttons', async () => {
    await act(async () => {
      render(<NotificationAlertForm onNavigate={mockOnNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });
  });

  it('should call onNavigate with list type when cancel is clicked', async () => {
    await act(async () => {
      render(<NotificationAlertForm onNavigate={mockOnNavigate} />);
    });

    await waitFor(async () => {
      const cancelBtn = screen.getByTestId('cancel-btn');
      cancelBtn.click();

      expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
    });
  });
});
