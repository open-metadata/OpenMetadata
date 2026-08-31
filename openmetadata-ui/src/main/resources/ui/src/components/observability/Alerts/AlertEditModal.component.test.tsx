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
/* eslint-disable jsx-a11y/control-has-associated-label */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
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

const mockUseObservabilityAlertForm = jest.fn();

jest.mock(
  '../../../pages/AddObservabilityPage/hooks/useObservabilityAlertForm',
  () => ({
    useObservabilityAlertForm: (params: unknown) =>
      mockUseObservabilityAlertForm(params),
  })
);

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
    showHint,
    value,
  }: {
    mode: string;
    onChange: (value: ModifiedCreateEventSubscription) => void;
    onSubmit: (value: ModifiedCreateEventSubscription) => void;
    showHint?: boolean;
    value: ModifiedCreateEventSubscription;
  }) => (
    <div data-testid="alert-ai-form">
      <span data-testid="form-mode">{mode}</span>
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

// AlertEditModal delegates its chrome to AiFormModal; its own job is to wire
// props and render the form (or loader) as children. Mock AiFormModal to that
// boundary — its rendering is covered by the Data Quality suites. The mock
// exposes the pieces AlertEditModal passes: header actions (Show Hint toggle),
// the body, footer actions, and the guarded close handler.
jest.mock('../../../components/common/atoms/drawer/AiFormModal', () => ({
  AiFormModal: ({
    children,
    footerActions,
    headerActions,
    hintOpen,
    open,
    subtitle,
    title,
    onClose,
    onHintToggle,
  }: {
    children?: ReactNode;
    footerActions?: ReactNode;
    headerActions?: ReactNode;
    hintOpen?: boolean;
    open?: boolean;
    subtitle?: ReactNode;
    title?: ReactNode;
    onClose?: () => void;
    onHintToggle?: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="ai-form-modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-subtitle">{subtitle}</div>
        <div data-testid="modal-header-actions">{headerActions}</div>
        {/* The Show Hint control itself belongs to AiFormModal now, so this
              stands in for it: the contract under test is that AlertEditModal
              hands down hintOpen and reacts to onHintToggle. */}
        <div data-testid="modal-hint-open">{String(hintOpen)}</div>
        <button
          data-testid="modal-hint-toggle"
          onClick={() => onHintToggle?.(!hintOpen)}>
          toggle hint
        </button>
        <button data-testid="modal-close" onClick={() => onClose?.()}>
          close
        </button>
        <div data-testid="modal-body">{children}</div>
        <div data-testid="modal-footer-actions">{footerActions}</div>
      </div>
    ) : null,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Toggle: ({
    'data-testid': testId,
    isDisabled,
    isSelected,
    onChange,
  }: {
    'data-testid'?: string;
    isDisabled?: boolean;
    isSelected?: boolean;
    onChange?: (isSelected: boolean) => void;
  }) => (
    <input
      checked={Boolean(isSelected)}
      data-testid={testId}
      disabled={isDisabled}
      type="checkbox"
      onChange={(event) => onChange?.(event.target.checked)}
    />
  ),
}));

jest.mock('@untitledui/icons', () => ({
  AlertTriangle: () => null,
  Lightbulb05: () => null,
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
  filterResources: [],
  form: {
    setFieldValue: jest.fn(),
    setFieldsValue: jest.fn(),
  },
  handleSave: jest.fn(),
  inlineAlertDetails: undefined,
  isLoading: false,
  saving: false,
  shouldShowActionsSection: true,
  shouldShowFiltersSection: true,
  supportedFilters: [],
  supportedTriggers: [],
  templateResourcePermission: undefined,
  templates: [],
  ...overrides,
});

describe('AlertEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseObservabilityAlertForm.mockReturnValue(getHookState());
  });

  it('passes fqn, save callback, and close callback to the OSS alert form hook', () => {
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

    expect(mockUseObservabilityAlertForm).toHaveBeenCalledWith({
      afterSaveAction: onSaved,
      fqn: 'service.alert',
      onCancel: onClose,
    });
  });

  it('shows loader while edit alert details are loading', () => {
    mockUseObservabilityAlertForm.mockReturnValue(
      getHookState({ alert: undefined, isLoading: false })
    );

    render(<AlertEditModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-ai-form')).not.toBeInTheDocument();
  });

  it('renders edit form with fetched alert values and submits through hook', async () => {
    const handleSave = jest.fn();
    const form = { setFieldValue: jest.fn(), setFieldsValue: jest.fn() };
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

    mockUseObservabilityAlertForm.mockReturnValue(
      getHookState({ alert: alertWithTestTemplateFields, form, handleSave })
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
    expect(form.setFieldsValue).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: alertWithTestTemplateFields.destinations,
        notificationTemplate,
        resources: ['table'],
      })
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
  });

  it('keeps the modal and the AI form on the same show hint state', async () => {
    render(<AlertEditModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('form-show-hint')).toHaveTextContent('true')
    );

    expect(screen.getByTestId('modal-hint-open')).toHaveTextContent('true');

    // AiFormModal renders the control; this component owns the boolean, because
    // the form needs it too. Both sides have to move together.
    fireEvent.click(screen.getByTestId('modal-hint-toggle'));

    expect(screen.getByTestId('form-show-hint')).toHaveTextContent('false');
    expect(screen.getByTestId('modal-hint-open')).toHaveTextContent('false');
  });

  it('prevents dismissal while saving', () => {
    const onClose = jest.fn();

    mockUseObservabilityAlertForm.mockReturnValue(
      getHookState({ saving: true })
    );

    render(<AlertEditModal isOpen onClose={onClose} onSaved={jest.fn()} />);

    // The close handler passed to AiFormModal is guarded: while saving it must
    // not propagate to the caller's onClose.
    fireEvent.click(screen.getByTestId('modal-close'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows dismissal when not saving', () => {
    const onClose = jest.fn();

    render(<AlertEditModal isOpen onClose={onClose} onSaved={jest.fn()} />);

    fireEvent.click(screen.getByTestId('modal-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
