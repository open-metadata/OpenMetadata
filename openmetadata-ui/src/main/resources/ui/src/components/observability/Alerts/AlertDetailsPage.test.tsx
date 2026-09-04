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

import {
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import { ReactNode } from 'react';
import { AlertDetailTabs } from '../../../enums/Alerts.enum';
import {
    AlertType,
    EventSubscription,
    ProviderType
} from '../../../generated/events/eventSubscription';
import { ModifiedEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import AlertDetailsPage from './AlertDetailsPage';

const mockNavigate = jest.fn();
const mockUseAlertDetailsPage = jest.fn();
const mockUseObservabilityAlertForm = jest.fn();
const mockGetModifiedAlertDataForForm = jest.fn();

jest.mock('./NotificationTemplateUtils', () => ({
  getTemplateEntityRefObject: jest.fn((template) => ({
    id: template.id,
    name: template.name,
    type: 'notificationTemplate',
  })),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'service.alert' }),
}));

jest.mock('../../../pages/AlertDetailsPage/hooks/useAlertDetailsPage', () => ({
  useAlertDetailsPage: (params: unknown) => mockUseAlertDetailsPage(params),
}));

jest.mock(
  '../../../pages/AddObservabilityPage/hooks/useObservabilityAlertForm',
  () => ({
    useObservabilityAlertForm: (params: unknown) =>
      mockUseObservabilityAlertForm(params),
  })
);

jest.mock('../../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    getModifiedAlertDataForForm: (alert: EventSubscription) =>
      mockGetModifiedAlertDataForForm(alert),
  },
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Tabs = ({
    children,
    onSelectionChange,
  }: {
    children?: ReactNode;
    onSelectionChange?: (key: string) => void;
  }) => (
    <div data-testid="tabs">
      <button
        data-testid="change-tab"
        onClick={() => onSelectionChange?.('activity')}>
        change tab
      </button>
      {children}
    </div>
  );

  Tabs.List = ({
    children,
    className,
    size,
    type,
  }: {
    children?: ReactNode;
    className?: string;
    size?: string;
    type?: string;
  }) => (
    <div
      className={className}
      data-size={size}
      data-testid="tabs-list"
      data-type={type}>
      {children}
    </div>
  );
  Tabs.Item = ({
    className,
    label,
  }: {
    className?: string | ((state: { isSelected: boolean }) => string);
    label: string;
  }) => (
    <span
      className={
        typeof className === 'function'
          ? className({ isSelected: false })
          : className
      }
      data-testid="tab-item">
      {label}
    </span>
  );

  return {
    Box: ({
      children,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>,
    ButtonUtility: ({
      'data-testid': testId,
      isDisabled,
      onClick,
    }: {
      'data-testid'?: string;
      isDisabled?: boolean;
      onClick?: () => void;
    }) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
        {testId}
      </button>
    ),
    Owner: jest.fn(() => <div data-testid="owner-label" />),
    Tabs,
    toOwnerRefs: jest.requireActual('@openmetadata/ui-core-components').toOwnerRefs,
    toOwnerRef: jest.requireActual('@openmetadata/ui-core-components').toOwnerRef,
  };
});

jest.mock('@untitledui/icons', () => ({
  Edit03: () => null,
  RefreshCw04: () => null,
  Trash01: () => null,
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

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => ({
    __esModule: true,
    default: ({ permissionValue }: { permissionValue?: string }) => (
      <div data-testid="error-placeholder">{permissionValue}</div>
    ),
  })
);


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
          confirm
        </button>
        <button data-testid="cancel-delete" onClick={onCancel}>
          cancel
        </button>
      </div>
    ) : null,
}));

jest.mock(
  '../../../components/common/HeaderShell/HeaderShell.component',
  () => ({
    __esModule: true,
    default: ({
      footer,
      meta,
      subtitle,
      title,
      actions,
    }: {
      footer?: ReactNode;
      meta?: ReactNode;
      subtitle?: string;
      title: string;
      actions?: ReactNode;
    }) => (
      <div data-testid="page-header">
        <span>{title}</span>
        <span data-testid="page-header-subtitle">{subtitle}</span>
        <div data-testid="header-metadata">{meta}</div>
        <div data-testid="header-actions">{actions}</div>
        {footer}
      </div>
    ),
  })
);

jest.mock('./AlertAiForm.component', () => ({
  __esModule: true,
  default: ({
    mode,
    supportedFilters,
    supportedTriggers,
    value,
  }: {
    mode: string;
    supportedFilters?: unknown[];
    supportedTriggers?: unknown[];
    value: ModifiedEventSubscription;
  }) => (
    <div data-testid="alert-ai-form">
      <span data-testid="form-mode">{mode}</span>
      <span data-testid="form-name">{value.name}</span>
      <span data-testid="filters-count">{supportedFilters?.length ?? 0}</span>
      <span data-testid="triggers-count">{supportedTriggers?.length ?? 0}</span>
    </div>
  ),
}));

jest.mock('./AlertDescriptionCard.component', () => ({
  __esModule: true,
  default: ({
    onDescriptionUpdate,
  }: {
    onDescriptionUpdate: (description: string) => void;
  }) => (
    <button
      data-testid="description-card"
      onClick={() => onDescriptionUpdate('Updated description')}>
      description
    </button>
  ),
}));

jest.mock('./AlertEditModal.component', () => ({
  __esModule: true,
  default: ({
    onClose,
    onSaved,
  }: {
    onClose: () => void;
    onSaved: () => Promise<void> | void;
  }) => (
    <div data-testid="edit-modal">
      <button data-testid="close-edit-modal" onClick={onClose}>
        close
      </button>
      <button data-testid="save-edit-modal" onClick={onSaved}>
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

const alertDetails: EventSubscription = {
  alertType: AlertType.Observability,
  destinations: [],
  filteringRules: {
    resources: ['table'],
  },
  fullyQualifiedName: 'service.alert',
  id: 'alert-id',
  name: 'test-alert',
  provider: ProviderType.User,
} as EventSubscription;

const modifiedAlert: ModifiedEventSubscription = {
  alertType: AlertType.Observability,
  destinations: [],
  filteringRules: {
    resources: ['table'],
  },
  fullyQualifiedName: 'service.alert',
  id: 'alert-id',
  name: 'test-alert',
  provider: ProviderType.User,
  readTimeout: 15,
  timeout: 20,
};

const getDetailsState = (overrides = {}) => ({
  alertDetails,
  deletePermission: true,
  editDescriptionPermission: true,
  editOwnersPermission: true,
  editPermission: true,
  extraInfo: <span data-testid="extra-info">extra</span>,
  fetchAlertDetails: jest.fn(),
  handleAlertDelete: jest.fn(),
  handleAlertEdit: jest.fn(),
  handleAlertSync: jest.fn(),
  hideDeleteModal: jest.fn(),
  isSyncing: false,
  loadingCount: 0,
  onDescriptionUpdate: jest.fn(),
  onOwnerUpdate: jest.fn(),
  ownerLoading: false,
  setShowDeleteModal: jest.fn(),
  showDeleteModal: false,
  tab: AlertDetailTabs.CONFIGURATION,
  tabItems: [
    { key: AlertDetailTabs.CONFIGURATION, label: 'Configuration' },
    {
      children: <div data-testid="activity-tab">Activity</div>,
      key: 'activity',
      label: 'Activity',
    },
  ],
  viewPermission: true,
  ...overrides,
});

const getFormState = () => ({
  filterResources: [
    {
      name: 'table',
      supportedActions: [{ name: 'action' }],
      supportedFilters: [{ name: 'filter' }],
    },
  ],
  templates: [],
});

describe('AlertDetailsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetModifiedAlertDataForForm.mockReturnValue(modifiedAlert);
    mockUseAlertDetailsPage.mockReturnValue(getDetailsState());
    mockUseObservabilityAlertForm.mockReturnValue(getFormState());
  });

  it('renders permission error when view access is denied', () => {
    mockUseAlertDetailsPage.mockReturnValue(
      getDetailsState({ loadingCount: 0, viewPermission: false })
    );

    render(<AlertDetailsPage />);

    expect(screen.getByTestId('error-placeholder')).toHaveTextContent(
      'label.view-entity:label.alert-detail-plural'
    );
  });

  it('renders generic error when alert details are unavailable', () => {
    mockUseAlertDetailsPage.mockReturnValue(
      getDetailsState({ alertDetails: undefined, loadingCount: 0 })
    );

    render(<AlertDetailsPage />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('keeps the document title mounted while alert details are loading', () => {
    mockUseAlertDetailsPage.mockReturnValue(
      getDetailsState({ loadingCount: 1 })
    );

    render(<AlertDetailsPage />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.getByTestId('document-title')).toHaveTextContent(
      'test-alert'
    );
  });

  it('renders configuration tab content with selected resource rules', () => {
    render(<AlertDetailsPage />);

    expect(screen.getByTestId('page-header')).toHaveTextContent('test-alert');
    expect(screen.getByTestId('page-header-subtitle')).toHaveTextContent(
      'service.alert'
    );
    expect(screen.getByTestId('description-card')).toBeInTheDocument();
    expect(screen.getByTestId('form-mode')).toHaveTextContent('view');
    expect(screen.getByTestId('form-name')).toHaveTextContent('test-alert');
    expect(screen.getByTestId('filters-count')).toHaveTextContent('1');
    expect(screen.getByTestId('triggers-count')).toHaveTextContent('1');
  });

  it('renders the header meta row with owner and event stats', () => {
    render(<AlertDetailsPage />);

    // The meta slot must carry both the owner label and the event-stat block
    // (this row regressed to an empty/stacked layout during the HeaderShell
    // migration when it lost its horizontal wrapper).
    const metaRow = screen.getByTestId('header-metadata');

    expect(within(metaRow).getByTestId('owner-label')).toBeInTheDocument();
    expect(within(metaRow).getByTestId('extra-info')).toBeInTheDocument();
  });

  it('uses the shared compact underline style for header tabs', () => {
    render(<AlertDetailsPage />);

    const tabsList = screen.getByTestId('tabs-list');

    expect(tabsList).toHaveAttribute('data-size', 'sm');
    expect(tabsList).toHaveAttribute('data-type', 'underline');

    screen.getAllByTestId('tab-item').forEach((tabItem) => {
      expect(tabItem).not.toHaveClass('tw:text-md', 'tw:font-semibold');
    });
  });

  it('wires description, sync, delete, and edit modal actions', async () => {
    const fetchAlertDetails = jest.fn();
    const handleAlertSync = jest.fn();
    const onDescriptionUpdate = jest.fn();
    const setShowDeleteModal = jest.fn();

    mockUseAlertDetailsPage.mockImplementation(
      ({ onEditAlert }: { onEditAlert: () => void }) =>
        getDetailsState({
          fetchAlertDetails,
          handleAlertEdit: onEditAlert,
          handleAlertSync,
          onDescriptionUpdate,
          setShowDeleteModal,
        })
    );

    render(<AlertDetailsPage />);

    fireEvent.click(screen.getByTestId('description-card'));
    fireEvent.click(screen.getByTestId('sync-button'));
    fireEvent.click(screen.getByTestId('delete-button'));
    fireEvent.click(screen.getByTestId('edit-button'));

    expect(onDescriptionUpdate).toHaveBeenCalledWith('Updated description');
    expect(handleAlertSync).toHaveBeenCalled();
    expect(setShowDeleteModal).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-edit-modal'));

    await waitFor(() => expect(fetchAlertDetails).toHaveBeenCalled());
  });

  it('navigates when detail tab changes', () => {
    render(<AlertDetailsPage />);

    fireEvent.click(screen.getByTestId('change-tab'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/observability/alert/service.alert/activity',
      { replace: true }
    );
  });
});
