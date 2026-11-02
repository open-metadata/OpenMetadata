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

/*
 * Disabled for this test file only: the Toggle below is throwaway mock markup
 * for `@openmetadata/ui-core-components`. It stands in for the core control and
 * carries a data-testid the tests query directly; a real associated label would
 * add nothing to the mock.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AlertType,
  ProviderType,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import AlertEditModal from './AlertEditModal.component';

const mockUseAlertFormData = jest.fn();

jest.mock('../../../pages/AddObservabilityPage/hooks/useAlertFormData', () => ({
  useAlertFormData: (params: unknown) => mockUseAlertFormData(params),
}));

jest.mock('../../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('./AlertAiForm.component', () => ({
  __esModule: true,
  default: ({
    mode,
    onChange,
    onSubmit,
    shouldShowActionsSection,
    showHint,
    templateResourcePermission,
    templatesLoading,
    value,
  }: {
    mode: string;
    onChange: (value: ModifiedCreateEventSubscription) => void;
    onSubmit: (value: ModifiedCreateEventSubscription) => void;
    shouldShowActionsSection?: boolean;
    showHint?: boolean;
    templateResourcePermission?: Record<string, boolean>;
    templatesLoading?: boolean;
    value: ModifiedCreateEventSubscription;
  }) => (
    <div data-testid="alert-ai-form">
      <span data-testid="form-mode">{mode}</span>
      <span data-testid="form-shows-triggers">
        {String(Boolean(shouldShowActionsSection))}
      </span>
      <span data-testid="form-template-permission">
        {JSON.stringify(templateResourcePermission ?? null)}
      </span>
      <span data-testid="form-templates-loading">
        {String(Boolean(templatesLoading))}
      </span>
      <span data-testid="form-name">{value.name}</span>
      <span data-testid="form-display-name">{value.displayName}</span>
      <span data-testid="form-show-hint">{String(showHint)}</span>
      <button
        data-testid="change-form"
        onClick={() => onChange({ ...value, name: 'updated-alert' })}>
        change
      </button>
      <button data-testid="submit-form" onClick={() => onSubmit(value)}>
        submit
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

const alert: ModifiedEventSubscription = {
  alertType: AlertType.Observability,
  destinations: [],
  displayName: 'Display Alert',
  filteringRules: {
    resources: ['table'],
  },
  id: 'alert-id',
  name: 'test-alert',
  provider: ProviderType.User,
  readTimeout: 15,
  timeout: 20,
} as ModifiedEventSubscription;

const getHookState = (overrides = {}) => ({
  alert,
  extraFormButtons: {},
  handleSave: jest.fn(),
  inlineAlertDetails: undefined,
  isLoading: false,
  loadingState: { alerts: false, templates: false },
  saving: false,
  shouldShowActionsSection: true,
  selection: { support: { supportedFilters: [], supportedTriggers: [] } },
  shouldShowFiltersSection: true,
  templateResourcePermission: undefined,
  templates: [],
  ...overrides,
});

describe('AlertEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAlertFormData.mockReturnValue(getHookState());
  });

  it('passes fqn, save callback, close callback and the chosen sources and rules to the alert form hook', async () => {
    const onClose = jest.fn();
    const onSaved = jest.fn();

    render(
      <AlertEditModal
        isOpen
        fqn="service.alert"
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    expect(mockUseAlertFormData).toHaveBeenCalledWith({
      afterSaveAction: onSaved,
      alertType: AlertType.Observability,
      fqn: 'service.alert',
      input: { actions: [], filters: [] },
      onCancel: onClose,
      sources: [],
    });

    await waitFor(() =>
      expect(mockUseAlertFormData).toHaveBeenLastCalledWith({
        afterSaveAction: onSaved,
        alertType: AlertType.Observability,
        fqn: 'service.alert',
        input: undefined,
        onCancel: onClose,
        sources: ['table'],
      })
    );
  });

  it('passes the form values, and no antd form, to extra form buttons', async () => {
    const ExtraButton = jest.fn(
      ({ values }: { values?: ModifiedCreateEventSubscription }) => (
        <span data-testid="extra-button">{values?.resources?.[0]}</span>
      )
    );
    mockUseAlertFormData.mockReturnValue(
      getHookState({ extraFormButtons: { ExtraButton } })
    );

    render(
      <AlertEditModal
        isOpen
        fqn="service.alert"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('extra-button')).toHaveTextContent('table')
    );

    for (const [props] of ExtraButton.mock.calls) {
      expect(props).not.toHaveProperty('formRef');
    }
  });

  it('shows loader while edit alert details are loading', () => {
    mockUseAlertFormData.mockReturnValue(
      getHookState({ alert: undefined, isLoading: false })
    );

    render(<AlertEditModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-ai-form')).not.toBeInTheDocument();
  });

  it('renders edit form with fetched alert values and submits through hook', async () => {
    const handleSave = jest.fn();
    const notificationTemplate = JSON.stringify({
      id: 'template-id',
      name: 'template-name',
      type: 'notificationTemplate',
    });
    const alertWithTestTemplateFields = {
      ...alert,
      destinations: [
        {
          category: SubscriptionCategory.External,
          destinationType: SubscriptionType.Email,
          type: SubscriptionType.Email,
        },
      ],
      notificationTemplate,
    } as ModifiedEventSubscription;

    mockUseAlertFormData.mockReturnValue(
      getHookState({ alert: alertWithTestTemplateFields, handleSave })
    );

    render(
      <AlertEditModal
        isOpen
        fqn="service.alert"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('form-name')).toHaveTextContent('test-alert')
    );

    expect(screen.getByTestId('form-display-name')).toHaveTextContent(
      'Display Alert'
    );
    expect(mockUseAlertFormData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sources: ['table'] })
    );

    fireEvent.click(screen.getByTestId('submit-form'));

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-alert',
        resources: ['table'],
      })
    );
  });

  it('renders add form with empty alert values', () => {
    render(
      <AlertEditModal
        isOpen
        mode="add"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByTestId('form-mode')).toHaveTextContent('add');
    expect(screen.getByTestId('form-name')).toHaveTextContent('');
    expect(screen.getByTestId('form-display-name')).toHaveTextContent('');
    expect(mockUseAlertFormData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sources: [] })
    );
  });

  it('keeps the Show Hint toggle and the AI form on the same show hint state', async () => {
    render(<AlertEditModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    const toggle = screen.getByRole('switch', { name: 'label.show-hint' });

    await waitFor(() =>
      expect(screen.getByTestId('form-show-hint')).toHaveTextContent('true')
    );

    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(screen.getByTestId('form-show-hint')).toHaveTextContent('false');
    expect(toggle).not.toBeChecked();
  });

  it('prevents dismissal while saving', () => {
    const onClose = jest.fn();

    mockUseAlertFormData.mockReturnValue(getHookState({ saving: true }));

    render(<AlertEditModal isOpen onClose={onClose} onSaved={jest.fn()} />);

    // The drawer's close handler is guarded: while saving it must not
    // propagate to the caller's onClose.
    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows dismissal when not saving', () => {
    const onClose = jest.fn();

    render(<AlertEditModal isOpen onClose={onClose} onSaved={jest.fn()} />);

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the template permission and loading state to the form', () => {
    mockUseAlertFormData.mockReturnValue(
      getHookState({
        loadingState: { alerts: false, templates: true },
        templateResourcePermission: { Create: true },
      })
    );

    render(
      <AlertEditModal
        isOpen
        mode="add"
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    expect(screen.getByTestId('form-template-permission')).toHaveTextContent(
      '{"Create":true}'
    );
    expect(screen.getByTestId('form-templates-loading')).toHaveTextContent(
      'true'
    );
  });
});
