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
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { ReactNode } from 'react';
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
}));

jest.mock('@untitledui/icons', () => ({
  Plus: () => null,
}));

jest.mock(
  '../../../components/common/DocumentTitle/DocumentTitle',
  () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => (
      <span data-testid="document-title">{title}</span>
    ),
  })
);

jest.mock('../../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock(
  '../../../components/common/DeleteModal/DeleteModal',
  () => ({
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
  })
);

jest.mock(
  '../../../components/common/HeaderShell/HeaderShell.component',
  () => ({
    __esModule: true,
    default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
      <div data-testid="page-header">
        <span>{title}</span>
        {actions}
      </div>
    ),
  })
);

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

jest.mock('./AlertEditModal.component', () => ({
  __esModule: true,
  default: ({
    fqn,
    mode,
    onClose,
    onSaved,
  }: {
    fqn?: string;
    mode?: 'add' | 'edit';
    onClose: () => void;
    onSaved: (fqn?: string) => Promise<void> | void;
  }) => (
    <div data-testid="alert-edit-modal">
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
});
