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

const mockForm = {
  watch: jest.fn().mockReturnValue([]),
  setValue: jest.fn(),
  handleSubmit: jest.fn(
    (fn) => () =>
      fn({
        displayName: 'test',
        resources: [],
        filters: [],
        destinations: [],
        timeout: 10,
        readTimeout: 30,
      })
  ),
  reset: jest.fn(),
  control: {},
};

jest.mock('react-hook-form', () => ({
  ...jest.requireActual('react-hook-form'),
  useForm: () => mockForm,
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
  HookForm: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  FormFields: jest
    .fn()
    .mockImplementation(() => <div data-testid="form-fields" />),
  FormField: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div>{children?.({ field: { value: '', onChange: jest.fn() } })}</div>
    )),
  FormItemLabel: jest
    .fn()
    .mockImplementation(({ label }) => <span>{label}</span>),
  FieldTypes: { TEXT: 'text' },
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

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    setInlineAlertDetails: jest.fn(),
    inlineAlertDetails: null,
    currentUser: { id: 'user-1' },
  }),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    getResourceLimit: jest.fn(),
  }),
}));

jest.mock('../../../../../../constants/Form.constants', () => ({
  NAME_FIELD_RULES: [],
}));

jest.mock('../../../../../../constants/constants', () => ({
  PAGE_SIZE_LARGE: 50,
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      getResourcePermission: jest.fn().mockResolvedValue({}),
    }),
  })
);

jest.mock('../../../../../../utils/PermissionDerivation', () => ({
  getDerivedPermissionFlags: jest.fn().mockReturnValue({ canViewAll: false }),
}));

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {},
}));

jest.mock('../../../../../../rest/notificationtemplateAPI', () => ({
  getAllNotificationTemplates: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(() => <div data-testid="rich-text-editor" />)
);

jest.mock('./NotificationSourceSelect', () =>
  jest.fn(() => <div data-testid="source-select" />)
);

jest.mock('./NotificationFiltersEditor', () =>
  jest.fn(() => <div data-testid="filters-editor" />)
);

jest.mock('./NotificationDestinationBridge', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="destination-bridge" />),
}));

describe('NotificationAlertForm', () => {
  const mockOnNavigate = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show loader while data is loading', async () => {
    const { getResourceFunctions } = jest.requireMock(
      '../../../../../../rest/alertsAPI'
    );
    let resolveAPI: (v: unknown) => void;
    getResourceFunctions.mockReturnValueOnce(
      new Promise((r) => {
        resolveAPI = r;
      })
    );

    render(<NotificationAlertForm onNavigate={mockOnNavigate} />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    await act(async () => {
      (resolveAPI as (v: unknown) => void)({ data: [] });
    });
  });

  it('should render form fields after loading', async () => {
    render(<NotificationAlertForm onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(screen.getByTestId('form-fields')).toBeInTheDocument();
      expect(screen.getByTestId('source-select')).toBeInTheDocument();
      expect(screen.getByTestId('destination-bridge')).toBeInTheDocument();
    });
  });

  it('should render cancel and save buttons', async () => {
    render(<NotificationAlertForm onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    });
  });

  it('should call onNavigate with list type when cancel is clicked', async () => {
    render(<NotificationAlertForm onNavigate={mockOnNavigate} />);

    const cancelBtn = await screen.findByTestId('cancel-btn');

    act(() => {
      cancelBtn.click();
    });

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
  });
});
