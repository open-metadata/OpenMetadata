/*
 *  Copyright 2024 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ObservabilityFormFiltersItem from '../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem';
import ObservabilityFormTriggerItem from '../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem';
import { AlertType } from '../../generated/events/eventSubscription';
import { getObservabilityAlertByFQN } from '../../rest/observabilityAPI';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import AddObservabilityPage from './AddObservabilityPage';

const MOCK_DATA = [
  {
    id: '971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    name: 'alert-test',
    fullyQualifiedName: 'alert-test',
    href: 'http://localhost:8585/api/v1/events/subscriptions/971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    version: 0.1,
    updatedAt: 1682366749021,
    updatedBy: 'admin',
    filteringRules: {
      resources: ['all'],
      rules: [
        {
          name: 'matchIngestionPipelineState',
          effect: 'include',
          condition: "matchIngestionPipelineState('partialSuccess')",
        },
      ],
    },
    subscriptionType: 'Email',
    subscriptionConfig: {
      receivers: ['test@gmail.com'],
    },
    enabled: true,
    batchSize: 10,
    timeout: 10,
    readTimeout: 12,
    deleted: false,
    provider: 'user',
  },
];
const mockNavigate = jest.fn();
const mockFqn = { fqn: '' };
const mockGlobalPermissions = {
  permissions: { eventsubscription: { Create: true } } as unknown,
};
const mockUseEntityPermissions = jest.fn();

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => mockFqn,
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: mockGlobalPermissions.permissions,
    getResourcePermission: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

const mockEntityPermissions = (EditAll: boolean) =>
  mockUseEntityPermissions.mockReturnValue({
    permissions: { ...DEFAULT_ENTITY_PERMISSION, EditAll },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(
      { ...DEFAULT_ENTITY_PERMISSION, EditAll },
      false
    ),
  });
const mockHandleAlertSave = jest.fn();
const mockGetModifiedAlertDataForForm = jest.fn();

jest.mock('../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    handleAlertSave: (...args: unknown[]) => mockHandleAlertSave(...args),
    getModifiedAlertDataForForm: (...args: unknown[]) =>
      mockGetModifiedAlertDataForForm(...args),
    getAddAlertFormExtraWidgets: jest.fn().mockReturnValue({}),
    getSourceNameSearch: jest.fn().mockReturnValue({}),
    getAddAlertFormExtraButtons: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../rest/observabilityAPI', () => ({
  getObservabilityAlertByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      fqn: 'alert-test',
    })
  ),
  createObservabilityAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      alert: 'Observability',
    })
  ),
  updateObservabilityAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'test',
      jsonPatch: MOCK_DATA,
    })
  ),
}));

jest.mock('../../rest/alertsAPI', () => ({
  getAlertsFromName: jest.fn(),
  createNotificationAlert: jest.fn(),
  updateNotificationAlert: jest.fn(),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock(
  '../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="source-select">Source Select</div>
      ))
);

jest.mock(
  '../../components/Alerts/DestinationFormItem/DestinationFormItem.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="destination-category-select">Destination Select</div>
      ))
);

jest.mock(
  '../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem',
  () => jest.fn().mockImplementation(() => <div>Filters</div>)
);

jest.mock(
  '../../components/Alerts/ObservabilityFormTriggerItem/ObservabilityFormTriggerItem',
  () => jest.fn().mockImplementation(() => <div>Triggers</div>)
);

const mockProps = {
  pageTitle: 'add-observability',
};

describe('Add ObservabilityPage Alerts Page Tests', () => {
  beforeEach(() => {
    mockFqn.fqn = '';
    mockGetModifiedAlertDataForForm.mockReset();
    mockGlobalPermissions.permissions = { eventsubscription: { Create: true } };
    mockEntityPermissions(false);
  });

  it('should show the permission placeholder when the user cannot create alerts', async () => {
    mockGlobalPermissions.permissions = {
      eventsubscription: { Create: false },
    };

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(screen.getByText(/label\.create-entity/)).toBeInTheDocument();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
  });

  it('should show the permission placeholder when the user cannot edit the alert', async () => {
    mockFqn.fqn = 'alert-test';

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    expect(screen.getByText(/label\.edit-entity/)).toBeInTheDocument();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
  });

  it('should show a retryable error instead of an endless loader when the alert to edit fails to load', async () => {
    mockFqn.fqn = 'alert-test';
    mockEntityPermissions(true);
    (getObservabilityAlertByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { status: 500 } })
    );

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));
    });

    expect(getObservabilityAlertByFQN).toHaveBeenCalledTimes(2);
  });

  it('should show a not-found state without retry when the alert to edit does not exist', async () => {
    mockFqn.fqn = 'alert-test';
    mockEntityPermissions(true);
    (getObservabilityAlertByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { status: 404 } })
    );

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText('label.alert-not-found')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.alert-not-found-description')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.something-went-wrong')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.reload' })
    ).not.toBeInTheDocument();
  });

  it('should offer a reload, not a permission denial, when the edit permission fails to load', async () => {
    mockFqn.fqn = 'alert-test';
    const refresh = jest.fn();
    mockUseEntityPermissions.mockReturnValue({
      permissions: DEFAULT_ENTITY_PERMISSION,
      isLoading: false,
      error: { response: { status: 500 } },
      refresh,
      ...getDerivedPermissionFlags(DEFAULT_ENTITY_PERMISSION, false),
    });

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('should render Add Observability Page', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.observability')).toBeInTheDocument();
  });

  it('should display SubTitle', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText(/message.alerts-description/)
    ).toBeInTheDocument();
  });

  it('should render Add alert button', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText(/label.create-entity/)).toBeInTheDocument();
  });

  it('should display the correct breadcrumb', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const breadcrumbLinks = screen.getAllByTestId('breadcrumb-link');

    expect(breadcrumbLinks[0]).toHaveTextContent('label.observability');
    expect(breadcrumbLinks[1]).toHaveTextContent('label.alert-plural');
    expect(breadcrumbLinks[2]).toHaveTextContent('label.create-entity');
  });

  it('should navigate back when the cancel button is clicked', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const cancelButton = screen.getByTestId('cancel-button');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should render form field for name', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    expect(screen.getByPlaceholderText('label.name')).toBeInTheDocument();
  });

  it('should render save button', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toHaveTextContent('label.save');
  });

  it('should render AlertFormSourceItem component', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    expect(screen.getByTestId('source-select')).toBeInTheDocument();
  });

  it('should render DestinationFormItem component', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    expect(
      screen.getByTestId('destination-category-select')
    ).toBeInTheDocument();
  });

  it('should call getAddAlertFormExtraWidgets from alertsClassBase', async () => {
    const { default: alertsClassBase } = await import(
      '../../utils/AlertsClassBase'
    );

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    expect(alertsClassBase.getAddAlertFormExtraWidgets).toHaveBeenCalled();
  });

  it('should call getAddAlertFormExtraButtons from alertsClassBase', async () => {
    const { default: alertsClassBase } = await import(
      '../../utils/AlertsClassBase'
    );

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.observability');

    expect(alertsClassBase.getAddAlertFormExtraButtons).toHaveBeenCalled();
  });

  it('should pass the current form values to extra form buttons', async () => {
    const { default: alertsClassBase } = await import(
      '../../utils/AlertsClassBase'
    );
    (alertsClassBase.getAddAlertFormExtraButtons as jest.Mock).mockReturnValue({
      ExtraButton: ({ values }: { values?: { displayName?: string } }) => (
        <span data-testid="extra-button">{values?.displayName}</span>
      ),
    });

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('label.name'), {
        target: { value: 'typed-alert' },
      });
    });

    expect(await screen.findByTestId('extra-button')).toHaveTextContent(
      'typed-alert'
    );
  });

  it('should keep rules stored without selections read-only when editing', async () => {
    mockFqn.fqn = 'alert-test';
    mockEntityPermissions(true);
    mockGetModifiedAlertDataForForm.mockReturnValue({
      ...MOCK_DATA[0],
      filteringRules: { ...MOCK_DATA[0].filteringRules, resources: [] },
      hasRulesWithoutSelections: true,
    });

    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText('message.alert-rules-read-only')
    ).toBeInTheDocument();
    expect(ObservabilityFormFiltersItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ isViewMode: true }),
      expect.anything()
    );
    expect(ObservabilityFormTriggerItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ isViewMode: true }),
      expect.anything()
    );
  });

  describe('as the notification alert page', () => {
    const notificationProps = {
      ...mockProps,
      alertType: AlertType.Notification,
    };

    it('should show the notification settings breadcrumb', async () => {
      await act(async () => {
        render(<AddObservabilityPage {...notificationProps} />, {
          wrapper: MemoryRouter,
        });
      });
      const breadcrumbLinks = screen.getAllByTestId('breadcrumb-link');

      expect(breadcrumbLinks[0]).toHaveTextContent('label.setting-plural');
      expect(breadcrumbLinks[1]).toHaveTextContent('label.notification-plural');
      expect(breadcrumbLinks[2]).toHaveTextContent('label.alert-plural');
      expect(breadcrumbLinks[3]).toHaveTextContent('label.create-entity');
    });

    it('should not offer the trigger section', async () => {
      await act(async () => {
        render(<AddObservabilityPage {...notificationProps} />, {
          wrapper: MemoryRouter,
        });
      });

      expect(await screen.findByText('Filters')).toBeInTheDocument();
      expect(screen.queryByText('Triggers')).not.toBeInTheDocument();
    });
  });
});
