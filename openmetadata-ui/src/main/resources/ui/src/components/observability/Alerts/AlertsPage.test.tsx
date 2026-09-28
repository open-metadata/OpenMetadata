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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AlertType,
  EventSubscription,
} from '../../../generated/events/eventSubscription';
import { NOTIFICATION_ALERT_KIND } from './alertKinds';
import AlertsPage from './AlertsPage';

const mockNavigate = jest.fn();
const mockUseObservabilityAlerts = jest.fn();
const ALERT_COUNT_QUERY_KEY = [
  'askCollate',
  'observability',
  'alerts',
  'count',
] as const;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ key: 'test-location-key' }),
  useNavigate: () => mockNavigate,
}));

jest.mock(
  '../../../pages/ObservabilityAlertsPage/hooks/useObservabilityAlerts',
  () => ({
    useObservabilityAlerts: (params: unknown) =>
      mockUseObservabilityAlerts(params),
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
  Button: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  PageLayout: {
    PageHeader: ({
      title,
      actions,
    }: {
      title: string;
      actions?: ReactNode;
    }) => (
      <div data-testid="page-header">
        <span>{title}</span>
        {actions}
      </div>
    ),
  },
}));

jest.mock('@untitledui/icons', () => ({
  Plus: () => null,
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <span data-testid="document-title">{title}</span>
  ),
}));

jest.mock('../../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('../../../components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({
    onCancel,
    onDelete,
    open,
  }: {
    onCancel: () => void;
    onDelete: () => void;
    open: boolean;
  }) =>
    open ? (
      <div data-testid="delete-modal">
        <button data-testid="confirm-delete" onClick={onDelete}>
          delete
        </button>
        <button data-testid="cancel-delete" onClick={onCancel}>
          cancel
        </button>
      </div>
    ) : null,
}));

jest.mock('./ObservabilityAlertsAiTable.component', () => ({
  __esModule: true,
  default: ({
    alerts,
    onAddAlert,
    onEditAlert,
    onSelectAlert,
  }: {
    alerts: EventSubscription[];
    onAddAlert: () => void;
    onEditAlert?: (alert: EventSubscription) => void;
    onSelectAlert: (alert?: EventSubscription) => void;
  }) => (
    <div data-testid="alerts-table">
      <button data-testid="table-add-alert" onClick={onAddAlert}>
        add
      </button>
      <button
        data-testid="table-edit-alert"
        onClick={() => onEditAlert?.(alerts[0])}>
        edit
      </button>
      <button
        data-testid="table-select-alert"
        onClick={() => onSelectAlert(alerts[0])}>
        select
      </button>
    </div>
  ),
}));

const mockDeleteObservabilityAlert = jest.fn();

jest.mock('../../../rest/observabilityAPI', () => ({
  deleteObservabilityAlert: (id: string) => mockDeleteObservabilityAlert(id),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('./AlertEditModal.component', () => ({
  __esModule: true,
  default: ({
    kind,
    fqn,
    mode,
    onClose,
    onSaved,
  }: {
    kind?: { alertType: string };
    fqn?: string;
    mode?: 'add' | 'edit';
    onClose: () => void;
    onSaved: (fqn?: string) => Promise<void> | void;
  }) => (
    <div data-testid="alert-edit-modal">
      <span data-testid="modal-alert-type">{kind?.alertType}</span>
      <span data-testid="modal-mode">{mode}</span>
      <span data-testid="modal-fqn">{fqn}</span>
      <button data-testid="modal-close" onClick={onClose}>
        close
      </button>
      <button data-testid="modal-save" onClick={() => onSaved('saved.alert')}>
        save
      </button>
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.entity ? `${key}:${params.entity}` : key,
  }),
}));

const alertRecord: EventSubscription = {
  alertType: 'Observability',
  destinations: [],
  fullyQualifiedName: 'service.alert',
  id: 'alert-id',
  name: 'test-alert',
} as EventSubscription;

const getAlertsState = (overrides = {}) => ({
  alertPermissions: [],
  alertResourcePermission: { Create: true },
  alerts: [alertRecord],
  columnList: [],
  currentPage: 1,
  fetchAlerts: jest.fn(),
  getAlertDetailsPath: jest.fn(),
  handleAlertDelete: jest.fn(),
  handlePageSizeChange: jest.fn(),
  handleSelectAlert: jest.fn(),
  loading: false,
  loadingCount: 0,
  onPageChange: jest.fn(),
  pageSize: 10,
  paging: { total: 1 },
  selectedAlert: undefined,
  showPagination: false,
  ...overrides,
});

describe('AlertsPage', () => {
  let queryClient: QueryClient;
  const renderAlertsPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AlertsPage />
      </QueryClientProvider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockUseObservabilityAlerts.mockReturnValue(getAlertsState());
  });

  afterEach(() => queryClient.clear());

  it('renders loader while alerts are loading', () => {
    mockUseObservabilityAlerts.mockReturnValue(
      getAlertsState({ loadingCount: 1 })
    );

    renderAlertsPage();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('uses the shared observability page shell when loaded', () => {
    mockUseObservabilityAlerts.mockReturnValue(getAlertsState());

    renderAlertsPage();

    expect(screen.getByTestId('observability-page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
  });

  it('opens add modal and navigates to saved alert details', async () => {
    queryClient.setQueryData(ALERT_COUNT_QUERY_KEY, 18);

    renderAlertsPage();

    fireEvent.click(screen.getByText('label.add-entity:label.alert'));

    expect(screen.getByTestId('modal-mode')).toHaveTextContent('add');

    fireEvent.click(screen.getByTestId('modal-save'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/observability/alert/saved.alert'
      )
    );

    expect(
      queryClient.getQueryState(ALERT_COUNT_QUERY_KEY)?.isInvalidated
    ).toBe(true);
  });

  it('opens edit modal from table and refetches alerts after save', async () => {
    const fetchAlerts = jest.fn();
    mockUseObservabilityAlerts.mockReturnValue(getAlertsState({ fetchAlerts }));

    renderAlertsPage();

    fireEvent.click(screen.getByTestId('table-edit-alert'));

    expect(screen.getByTestId('modal-mode')).toHaveTextContent('edit');
    expect(screen.getByTestId('modal-fqn')).toHaveTextContent('service.alert');

    fireEvent.click(screen.getByTestId('modal-save'));

    await waitFor(() => expect(fetchAlerts).toHaveBeenCalled());
  });

  it('wires delete modal visibility and cancel callback', () => {
    const handleSelectAlert = jest.fn();
    mockUseObservabilityAlerts.mockReturnValue(
      getAlertsState({ handleSelectAlert, selectedAlert: alertRecord })
    );

    renderAlertsPage();

    fireEvent.click(screen.getByTestId('cancel-delete'));

    expect(handleSelectAlert).toHaveBeenCalledWith(undefined);
  });

  it('refreshes the list and the sidebar alert count after delete', async () => {
    const handleAlertDelete = jest.fn();
    mockDeleteObservabilityAlert.mockResolvedValue({});
    queryClient.setQueryData(ALERT_COUNT_QUERY_KEY, 18);
    mockUseObservabilityAlerts.mockReturnValue(
      getAlertsState({ handleAlertDelete, selectedAlert: alertRecord })
    );

    renderAlertsPage();

    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(handleAlertDelete).toHaveBeenCalled());

    expect(mockDeleteObservabilityAlert).toHaveBeenCalledWith('alert-id');
    expect(
      queryClient.getQueryState(ALERT_COUNT_QUERY_KEY)?.isInvalidated
    ).toBe(true);
  });

  describe('as the Settings → Notifications alert list', () => {
    const renderNotificationAlertsPage = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <AlertsPage kind={NOTIFICATION_ALERT_KIND} />
        </QueryClientProvider>
      );

    it('lists notification alerts including the system activity feed alert', () => {
      renderNotificationAlertsPage();

      expect(mockUseObservabilityAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          alertType: AlertType.Notification,
          includeSystemAlerts: true,
        })
      );

      const { getAlertDetailsPath } = mockUseObservabilityAlerts.mock
        .calls[0][0] as { getAlertDetailsPath: (fqn: string) => string };

      expect(getAlertDetailsPath('my_alert')).toBe(
        '/settings/notifications/alerts/my_alert/configuration'
      );
    });

    it('titles the page as notifications', () => {
      renderNotificationAlertsPage();

      expect(screen.getByTestId('page-header')).toHaveTextContent(
        'label.notification-plural'
      );
    });

    it('creates notification alerts and opens the new alert under settings', async () => {
      renderNotificationAlertsPage();

      fireEvent.click(screen.getByText('label.add-entity:label.alert'));

      expect(screen.getByTestId('modal-alert-type')).toHaveTextContent(
        AlertType.Notification
      );

      fireEvent.click(screen.getByTestId('modal-save'));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          '/settings/notifications/alerts/saved.alert/configuration'
        )
      );
    });
  });

  it('keeps serving observability alerts by default', () => {
    renderAlertsPage();

    expect(mockUseObservabilityAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: AlertType.Observability })
    );

    fireEvent.click(screen.getByText('label.add-entity:label.alert'));

    expect(screen.getByTestId('modal-alert-type')).toHaveTextContent(
      AlertType.Observability
    );
  });

  describe('create button (classic Create || All rule)', () => {
    it('shows for the All permission alone', () => {
      mockUseObservabilityAlerts.mockReturnValue(
        getAlertsState({ alertResourcePermission: { All: true } })
      );

      renderAlertsPage();

      expect(
        screen.getByText('label.add-entity:label.alert')
      ).toBeInTheDocument();
    });

    it('stays hidden without Create or All', () => {
      mockUseObservabilityAlerts.mockReturnValue(
        getAlertsState({ alertResourcePermission: { ViewAll: true } })
      );

      renderAlertsPage();

      expect(
        screen.queryByText('label.add-entity:label.alert')
      ).not.toBeInTheDocument();
    });
  });
});
