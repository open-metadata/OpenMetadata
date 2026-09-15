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
 * These rules are disabled for this test file only: the JSX below is throwaway
 * mock markup for `@openmetadata/ui-core-components`. The mocks intentionally
 * expose accessible names via label nesting (which the tests query by role and
 * text); adding htmlFor/id pairs would require unique per-instance ids and
 * aria-label would override those nesting-based names, breaking assertions.
 */
/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/control-has-associated-label */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../../generated/events/api/createEventSubscription';
import {
  AlertType as EventSubscriptionAlertType,
  ArgumentsInput,
  Effect,
  EventFilterRule,
  EventSubscription,
  InputType,
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { validateNotificationTemplate } from '../../../rest/notificationtemplateAPI';
import { searchQuery } from '../../../rest/searchAPI';
import AlertAiDestinationConfigFields from './AlertAiDestinationConfigFields.component';
import AlertAiDestinationItem from './AlertAiDestinationItem.component';
import AlertAiDestinationSection from './AlertAiDestinationSection.component';
import AlertAiForm from './AlertAiForm.component';
import AlertAiFormFields from './AlertAiFormFields.component';
import AlertAiNotificationSection from './AlertAiNotificationSection.component';
import AlertAiRuleSection from './AlertAiRuleSection.component';
import AlertAiSection from './AlertAiSection.component';
import AlertDescriptionCard from './AlertDescriptionCard.component';
import { CUSTOM_TEMPLATE_VALUE } from './Template.constants';

jest.mock('./NotificationTemplateUtils', () => ({
  getTemplateValidationAlert: jest.fn((response) =>
    response ? <div data-testid="template-validation-alert" /> : null
  ),
  getTemplateEntityRefObject: jest.fn((template) => ({
    id: template.id,
    name: template.name,
    type: 'notificationTemplate',
  })),
}));

jest.mock('../../../rest/alertsAPI', () => ({
  testAlertDestination: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [
        {
          _source: {
            displayName: 'Domain 1',
            fullyQualifiedName: 'domain1',
          },
        },
      ],
    },
  }),
}));

jest.mock('../../../rest/notificationtemplateAPI', () => ({
  validateNotificationTemplate: jest.fn().mockResolvedValue({ isValid: true }),
}));

jest.mock('../../../components/common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({
    'data-testid': testId,
    initialValue,
    onFocus,
    onTextChange,
    readonly,
  }: {
    'data-testid'?: string;
    initialValue?: string;
    onFocus?: () => void;
    onTextChange?: (value: string) => void;
    readonly?: boolean;
  }) => (
    <textarea
      data-testid={testId}
      disabled={readonly}
      value={initialValue ?? ''}
      onChange={(event) => onTextChange?.(event.target.value)}
      onFocus={onFocus}
    />
  ),
}));

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => ({
    __esModule: true,
    default: ({ markdown }: { markdown?: string }) => (
      <div
        // eslint-disable-next-line react/no-danger -- test fixture markup
        dangerouslySetInnerHTML={{ __html: markdown ?? '' }}
        data-testid="field-doc-preview"
      />
    ),
  })
);

jest.mock('../../../components/common/EntityDescription/Description', () => ({
  __esModule: true,
  default: ({
    description,
    hasEditAccess,
    onDescriptionUpdate,
  }: {
    description?: string;
    hasEditAccess: boolean;
    onDescriptionUpdate: (description: string) => void;
  }) => (
    <button
      data-can-edit={hasEditAccess}
      data-testid="description-v1"
      onClick={() => onDescriptionUpdate('Updated description')}>
      {description}
    </button>
  ),
}));

interface MockCoreProps {
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  isSelected?: boolean;
  hint?: string;
  items?: MockSelectItem[];
  label?: ReactNode;
  id?: string;
  onButtonClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onBlur?: () => void;
  onChange?: (value: string | boolean) => void;
  onItemCleared?: (key: string) => void;
  onItemInserted?: (key: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPress?: () => void;
  onSearchChange?: (value: string) => void;
  onSelectionChange?: (key: string | null) => void;
  placeholder?: string;
  selectedKey?: string | null;
  selectedItems?: MockSelectItem[];
  type?: string;
  value?: string;
}

interface MockSelectProps extends Omit<MockCoreProps, 'children'> {
  children?: ReactNode | ((item: MockSelectItem) => ReactNode);
}

interface MockSelectItem {
  id: string;
  isDisabled?: boolean;
  label?: string;
}

jest.mock('@openmetadata/ui-core-components', () => {
  const Autocomplete = ({
    children,
    'data-testid': testId,
    hint,
    isDisabled,
    isInvalid,
    items = [],
    label,
    onItemCleared,
    onItemInserted,
    onSearchChange,
    placeholder,
    selectedItems = [],
  }: MockSelectProps) => (
    <label>
      {label}
      <input
        aria-invalid={isInvalid}
        data-testid={testId}
        disabled={isDisabled}
        placeholder={placeholder}
        onChange={(event) => onSearchChange?.(event.target.value)}
      />
      <select
        data-testid={`${testId}-options`}
        disabled={isDisabled}
        onChange={(event) => onItemInserted?.(event.target.value)}>
        {typeof children === 'function'
          ? items.map((item) => children(item))
          : children}
      </select>
      {selectedItems.map((item) => (
        <button
          data-testid={`${testId}-clear-${item.id}`}
          key={item.id}
          type="button"
          onClick={() => onItemCleared?.(item.id)}>
          {item.label ?? item.id}
        </button>
      ))}
      {hint ? <span>{hint}</span> : null}
    </label>
  );

  Autocomplete.Item = ({ children, id }: MockCoreProps & { id: string }) => (
    <option value={id}>{children}</option>
  );

  const Select = ({
    children,
    'data-testid': testId,
    hint,
    isDisabled,
    isInvalid,
    isRequired,
    items = [],
    label,
    onSelectionChange,
    selectedKey,
  }: MockSelectProps) => (
    <label>
      {label}
      {isRequired ? '*' : null}
      <select
        aria-invalid={isInvalid}
        data-testid={testId}
        disabled={isDisabled}
        value={selectedKey ?? ''}
        onChange={(event) => onSelectionChange?.(event.target.value)}>
        {typeof children === 'function'
          ? items.map((item) => children(item))
          : children}
      </select>
      {hint ? <span>{hint}</span> : null}
    </label>
  );

  Select.Item = ({
    children,
    id,
    isDisabled,
  }: MockCoreProps & { id: string }) => (
    <option disabled={isDisabled} value={id}>
      {children}
    </option>
  );
  Select.ComboBox = (props: MockSelectProps) => (
    <div data-testid={`${props['data-testid']}-combobox`}>
      <Select {...props} />
    </div>
  );

  const MultiSelect = ({
    children,
    isDisabled,
    items = [],
    label,
  }: MockSelectProps) => (
    <label>
      {label}
      <select multiple disabled={isDisabled}>
        {typeof children === 'function'
          ? items.map((item) => children(item))
          : children}
      </select>
    </label>
  );

  MultiSelect.Item = ({ children, id }: MockCoreProps & { id: string }) => (
    <option value={id}>{children}</option>
  );

  return {
    Accordion: ({ children }: MockCoreProps) => <div>{children}</div>,
    AccordionHeader: ({ children }: MockCoreProps) => <div>{children}</div>,
    AccordionItem: ({ children }: MockCoreProps) => <div>{children}</div>,
    AccordionPanel: ({ children }: MockCoreProps) => <div>{children}</div>,
    Alert: ({ title }: MockCoreProps & { title?: ReactNode }) => (
      <div>{title}</div>
    ),
    Autocomplete,
    BadgeWithButton: ({
      children,
      'data-testid': testId,
      onButtonClick,
    }: MockCoreProps) => (
      <span data-testid={testId}>
        {children}
        <button type="button" onClick={onButtonClick}>
          remove
        </button>
      </span>
    ),
    Box: ({ children, className, 'data-testid': testId }: MockCoreProps) => (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    ),
    Button: ({
      children,
      'data-testid': testId,
      isDisabled,
      onPress,
    }: MockCoreProps) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    Card: ({ children, className, 'data-testid': testId }: MockCoreProps) => (
      <section className={className} data-testid={testId}>
        {children}
      </section>
    ),
    Checkbox: ({ 'data-testid': testId, isSelected }: MockCoreProps) => (
      <input
        readOnly
        checked={Boolean(isSelected)}
        data-testid={testId}
        type="checkbox"
      />
    ),
    Form: ({
      children,
      id,
      onSubmit,
    }: MockCoreProps & {
      id?: string;
      onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
    }) => (
      <form data-testid="alert-ai-form" id={id} onSubmit={onSubmit}>
        {children}
      </form>
    ),
    HookForm: ({
      children,
      id,
      renderFieldDoc,
      onSubmit,
    }: MockCoreProps & {
      id?: string;
      renderFieldDoc?: (markdown: string) => ReactNode;
      onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
    }) => (
      <form data-testid="alert-ai-form" id={id} onSubmit={onSubmit}>
        {children}
        {/* The real HookForm calls renderFieldDoc to paint the hint column.
            Exercising it here is what lets a test see how the doc is wrapped. */}
        {renderFieldDoc && (
          <div data-testid="hint-doc-slot">{renderFieldDoc('Doc body')}</div>
        )}
      </form>
    ),
    Input: ({
      'data-testid': testId,
      hint,
      id,
      isDisabled,
      isInvalid,
      isRequired,
      label,
      onBlur,
      onChange,
      onKeyDown,
      placeholder,
      type,
      value,
    }: MockCoreProps) => (
      <label>
        {label}
        {isRequired ? '*' : null}
        <input
          aria-invalid={isInvalid}
          data-testid={testId}
          disabled={isDisabled}
          id={id}
          placeholder={placeholder}
          type={type}
          value={value ?? ''}
          onBlur={onBlur}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {hint ? <span>{hint}</span> : null}
      </label>
    ),
    MultiSelect,
    PasswordInput: ({
      'data-testid': testId,
      hint,
      isDisabled,
      isInvalid,
      label,
      onChange,
      placeholder,
      value,
    }: MockCoreProps) => (
      <label>
        {label}
        <input
          aria-invalid={isInvalid}
          data-testid={testId}
          disabled={isDisabled}
          placeholder={placeholder}
          type="password"
          value={value ?? ''}
          onChange={(event) => onChange?.(event.target.value)}
        />
        {hint ? <span>{hint}</span> : null}
      </label>
    ),
    Select,
    Skeleton: () => <div data-testid="skeleton" />,
    TextArea: ({
      'data-testid': testId,
      isDisabled,
      onChange,
      placeholder,
      value,
    }: MockCoreProps) => (
      <textarea
        data-testid={testId}
        disabled={isDisabled}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
    Toggle: ({ isDisabled, isSelected, label, onChange }: MockCoreProps) => (
      <label>
        {label}
        <input
          checked={Boolean(isSelected)}
          disabled={isDisabled}
          type="checkbox"
          onChange={(event) => onChange?.(event.target.checked)}
        />
      </label>
    ),
    Typography: ({ children, className }: MockCoreProps) => (
      <span className={className}>{children}</span>
    ),
    useFieldDoc: ({
      doc,
      name,
    }: {
      doc?: string;
      name: string;
    }): { 'data-field-doc'?: string } => ({
      'data-field-doc': doc ? name : undefined,
    }),
  };
});

// The alert field docs are markdown-backed; stub the loader so the wiring can be
// asserted without a network fetch (jsdom has none, so the real loader would
// silently resolve to {} and the assertions would be vacuous).
jest.mock('../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({
    description: 'Optional context explaining why this alert exists.',
    destinations: 'Where notifications are delivered when the alert fires.',
    filters: 'Filters narrow the scope of the alert.',
    name: 'A unique name for this alert.',
    notificationTemplate:
      'Controls the wording of the message this alert sends.',
    source: 'The type of data asset that will activate this alert.',
    trigger: 'The events that cause this alert to fire.',
  }),
}));

jest.mock('@untitledui/icons', () => ({
  AlertCircle: () => null,
  Lightbulb05: () => null,
  Settings01: () => null,
  Trash01: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const suffix =
        params?.entity ||
        params?.fieldName ||
        params?.field ||
        params?.fieldText;

      return suffix ? `${key}:${suffix}` : key;
    },
  }),
}));

describe('AlertAi form field components', () => {
  beforeAll(() => {
    if (!globalThis.structuredClone) {
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        value: <T,>(value: T) => JSON.parse(JSON.stringify(value)) as T,
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const baseValue: ModifiedCreateEventSubscription = {
    alertType: AlertType.Custom,
    destinations: [],
    input: {},
    name: 'test-alert',
    readTimeout: 12,
    timeout: 10,
  };
  const alertDetails: EventSubscription = {
    alertType: EventSubscriptionAlertType.Observability,
    description: 'Existing description',
    destinations: [],
    id: 'alert-id',
    name: 'test-alert',
  };

  it('renders section title, description, and children', () => {
    render(
      <AlertAiSection description="Section description" title="Section title">
        <div data-testid="section-child">Child</div>
      </AlertAiSection>
    );

    expect(screen.getByTestId('section-title-section')).toBeInTheDocument();
    expect(screen.getByText('Section title')).toBeInTheDocument();
    expect(screen.getByText('Section description')).toBeInTheDocument();
    expect(screen.getByTestId('section-child')).toBeInTheDocument();
  });

  it('renders required marker for required section titles', () => {
    render(
      <AlertAiSection isRequired title="Section title">
        <div />
      </AlertAiSection>
    );

    const requiredMarker = screen.getByText('*');

    expect(requiredMarker.tagName).toBe('SPAN');
  });

  it('wires description card edit access and update callback', () => {
    const onDescriptionUpdate = jest.fn();

    render(
      <AlertDescriptionCard
        hasEditAccess
        alertDetails={alertDetails}
        onDescriptionUpdate={onDescriptionUpdate}
      />
    );

    const description = screen.getByTestId('description-v1');

    expect(screen.getByTestId('alert-description')).toBeInTheDocument();
    expect(description).toHaveAttribute('data-can-edit', 'true');
    expect(description).toHaveTextContent('Existing description');

    fireEvent.click(description);

    expect(onDescriptionUpdate).toHaveBeenCalledWith('Updated description');
  });

  it('does not render an empty read-only rule section', () => {
    const { container } = render(
      <AlertAiRuleSection
        isViewOnly
        field="filters"
        supportedRules={[]}
        title="Filters"
        value={baseValue}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the add rule button visible but disabled until source is selected', () => {
    const supportedRules: EventFilterRule[] = [
      {
        condition: '',
        displayName: 'Domain',
        effect: Effect.Include,
        name: 'domainList',
      },
    ];

    render(
      <AlertAiRuleSection
        field="filters"
        selectedSource={undefined}
        supportedRules={supportedRules}
        title="Filters"
        value={baseValue}
      />
    );

    const addFilterButton = screen.getByTestId('add-filters');

    expect(addFilterButton).toBeDisabled();
  });

  it('enables add rule buttons from selected source descriptors', () => {
    const value = {
      ...baseValue,
      resources: ['table'],
    } as ModifiedCreateEventSubscription;
    const sourceRule: EventFilterRule = {
      condition: '',
      displayName: 'Domain',
      effect: Effect.Include,
      name: 'domainList',
    };

    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        filterResources={[
          {
            name: 'table',
            supportedActions: [sourceRule],
            supportedFilters: [sourceRule],
          },
        ]}
        value={value}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('add-filters')).not.toBeDisabled();
    expect(screen.getByTestId('add-actions')).not.toBeDisabled();
  });

  it('renders selected read-only rules without edit actions', () => {
    const selectedRule: ArgumentsInput = {
      effect: Effect.Include,
      name: 'domainList',
    };
    const value = {
      ...baseValue,
      input: {
        filters: [selectedRule],
      },
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiRuleSection
        isViewOnly
        field="filters"
        selectedSource="table"
        supportedRules={[
          {
            condition: '',
            displayName: 'Domain',
            effect: Effect.Include,
            name: 'domainList',
          },
        ]}
        title="Filters"
        value={value}
      />
    );

    expect(screen.getByTestId('filters-0')).toBeInTheDocument();
    expect(screen.queryByTestId('remove-filters-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-filters')).not.toBeInTheDocument();
  });

  it('searches selectable runtime argument options with OSS search utilities', async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const selectedRule: ArgumentsInput = {
      arguments: [{ input: [], name: 'domainList' }],
      effect: Effect.Include,
      name: 'matchAnyDomain',
    };
    const value = {
      ...baseValue,
      input: {
        filters: [selectedRule],
      },
    } as ModifiedCreateEventSubscription;

    await act(async () => {
      render(
        <AlertAiRuleSection
          field="filters"
          selectedSource="table"
          supportedRules={[
            {
              arguments: ['domainList'],
              condition: '',
              effect: Effect.Include,
              inputType: InputType.Runtime,
              name: 'matchAnyDomain',
            } as EventFilterRule,
          ]}
          title="Filters"
          value={value}
          onChange={onChange}
        />
      );
    });

    await waitFor(() => expect(searchQuery).toHaveBeenCalled());
    (searchQuery as jest.Mock).mockClear();

    await act(async () => {
      fireEvent.change(screen.getByTestId('domainList-autocomplete'), {
        target: { value: 'dom' },
      });
    });

    expect(searchQuery).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() =>
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'dom' })
      )
    );
    await waitFor(() =>
      expect(screen.getByText('Domain 1')).toBeInTheDocument()
    );
    jest.useRealTimers();
  });

  it('renders fixed runtime options with the fqn autocomplete contract', () => {
    const onChange = jest.fn();
    const selectedRule: ArgumentsInput = {
      arguments: [{ input: [], name: 'testResultList' }],
      effect: Effect.Include,
      name: 'testResultTrigger',
    };
    const value = {
      ...baseValue,
      input: {
        actions: [selectedRule],
      },
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiRuleSection
        field="actions"
        selectedSource="testCase"
        supportedRules={[
          {
            arguments: ['testResultList'],
            condition: '',
            effect: Effect.Include,
            inputType: InputType.Runtime,
            name: 'testResultTrigger',
          } as EventFilterRule,
        ]}
        title="Triggers"
        value={value}
        onChange={onChange}
      />
    );

    expect(screen.getByText('label.test-case-result')).toBeInTheDocument();
    expect(screen.getByTestId('testResultList-autocomplete')).toHaveAttribute(
      'placeholder',
      'label.search-by-type'
    );

    fireEvent.change(
      screen.getByTestId('testResultList-autocomplete-options'),
      { target: { value: 'Success' } }
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          actions: [
            expect.objectContaining({
              arguments: [{ input: ['Success'], name: 'testResultList' }],
            }),
          ],
        }),
      })
    );
  });

  it('stacks runtime autocompletes at the trigger width and contains selected chips', async () => {
    const selectedRule: ArgumentsInput = {
      arguments: [
        { input: ['Aborted'], name: 'testStatusList' },
        {
          input: ['90f55b5b-98e9-4f7f-a34d-123456789012'],
          name: 'testSuiteList',
        },
      ],
      effect: Effect.Include,
      name: 'testSuiteTrigger',
    };
    const value = {
      ...baseValue,
      input: {
        actions: [selectedRule],
      },
    } as ModifiedCreateEventSubscription;

    await act(async () => {
      render(
        <AlertAiRuleSection
          field="actions"
          selectedSource="testCase"
          supportedRules={[
            {
              arguments: ['testStatusList', 'testSuiteList'],
              condition: '',
              effect: Effect.Include,
              inputType: InputType.Runtime,
              name: 'testSuiteTrigger',
            } as EventFilterRule,
          ]}
          title="Triggers"
          value={value}
        />
      );
    });

    const statusAutocompleteField = screen.getByTestId(
      'testStatusList-autocomplete'
    ).parentElement?.parentElement;
    const suiteAutocompleteField = screen.getByTestId(
      'testSuiteList-autocomplete'
    ).parentElement?.parentElement;
    const statusArgumentField = statusAutocompleteField?.parentElement;
    const suiteArgumentField = suiteAutocompleteField?.parentElement;
    const runtimeArgumentsGrid = statusArgumentField?.parentElement;

    expect(statusArgumentField).toHaveClass('tw:col-span-2');
    expect(suiteArgumentField).toHaveClass('tw:col-span-2');
    expect(runtimeArgumentsGrid).toBe(suiteArgumentField?.parentElement);
    expect(runtimeArgumentsGrid).toHaveClass('tw:mr-12', 'tw:w-auto');
    expect(statusAutocompleteField).toHaveClass(
      'tw:[&_[role=group]>div>span]:max-w-full'
    );
    expect(suiteAutocompleteField).toHaveClass(
      'tw:[&_[role=group]>div>span]:max-w-full'
    );
  });

  it('hides destination add and test actions in read-only mode', () => {
    const value = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.Owners,
        } as ModifiedDestination,
      ],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationSection
        isViewOnly
        selectedSource="table"
        value={value}
      />
    );

    expect(screen.getByTestId('destination-list')).toBeInTheDocument();
    expect(
      screen.queryByTestId('add-destination-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('test-destination-button')
    ).not.toBeInTheDocument();
  });

  it('renders read-only destination category as a disabled select without combobox overlay', () => {
    const destination = {
      category: SubscriptionCategory.Admins,
      destinationType: SubscriptionCategory.Admins,
      type: SubscriptionType.Email,
    } as ModifiedDestination;

    render(
      <AlertAiDestinationItem
        isViewOnly
        destination={destination}
        name={0}
        value={
          {
            ...baseValue,
            destinations: [destination],
          } as ModifiedCreateEventSubscription
        }
      />
    );

    const destinationSelect = screen.getByTestId(
      'destination-category-select-0'
    );

    expect(destinationSelect).toBeDisabled();
    expect(destinationSelect).toHaveValue(SubscriptionCategory.Admins);
    expect(
      screen.queryByTestId('destination-category-select-0-combobox')
    ).not.toBeInTheDocument();
  });

  it('renders read-only destination and type fields side by side on the details page', () => {
    const destination = {
      category: SubscriptionCategory.Admins,
      destinationType: SubscriptionCategory.Admins,
      type: SubscriptionType.Email,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationItem
        isViewOnly
        destination={destination}
        name={0}
        value={value}
      />
    );

    expect(screen.getByTestId('destination-type-select-0')).toBeDisabled();
  });

  it('updates email destination receivers after entering a valid email tag', () => {
    const onChange = jest.fn();
    const destination = {
      config: { receivers: ['team@example.com'] },
      destinationType: SubscriptionType.Email,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationConfigFields
        destination={destination}
        name={0}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('email-input-0'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.keyDown(screen.getByTestId('email-input-0'), {
      key: 'Enter',
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            config: { receivers: ['team@example.com', 'admin@example.com'] },
            destinationType: SubscriptionType.Email,
          }),
        ],
      })
    );
  });

  it('commits a pending valid email destination receiver on blur', () => {
    const onChange = jest.fn();
    const destination = {
      config: { receivers: ['team@example.com'] },
      destinationType: SubscriptionType.Email,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationConfigFields
        destination={destination}
        name={0}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('email-input-0'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.blur(screen.getByTestId('email-input-0'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            config: { receivers: ['team@example.com', 'admin@example.com'] },
            destinationType: SubscriptionType.Email,
          }),
        ],
      })
    );
  });

  it('renders webhook auth fields for bearer destinations', () => {
    const destination = {
      config: {
        authType: {
          secretKey: 'secret',
          type: Type.Bearer,
        },
        endpoint: 'https://hooks.example.com',
      },
      destinationType: SubscriptionType.Slack,
    } as ModifiedDestination;

    render(
      <AlertAiDestinationConfigFields
        isViewOnly
        destination={destination}
        name={0}
        value={
          {
            ...baseValue,
            destinations: [destination],
          } as ModifiedCreateEventSubscription
        }
      />
    );

    expect(screen.getByTestId('endpoint-input-0')).toBeDisabled();
    expect(screen.getByTestId('auth-type-select-0')).toBeDisabled();
    expect(screen.getByTestId('secret-key-input-0')).toHaveValue('secret');
  });

  it('defaults downstream depth when notify downstream is enabled', () => {
    const onChange = jest.fn();
    const destination = {
      destinationType: SubscriptionCategory.Owners,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationItem
        destination={destination}
        name={0}
        value={value}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByTestId('destination-downstream-depth-0')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'label.notify-downstream' })
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        destinations: [
          expect.objectContaining({
            destinationType: SubscriptionCategory.Owners,
            downstreamDepth: 1,
            notifyDownstream: true,
          }),
        ],
      })
    );
  });

  it('shows downstream depth field enabled when notify downstream is on', () => {
    const destination = {
      destinationType: SubscriptionCategory.Owners,
      downstreamDepth: 2,
      notifyDownstream: true,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationItem
        destination={destination}
        name={0}
        value={value}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('destination-downstream-depth-0')).toHaveValue(2);
    expect(screen.getByTestId('destination-downstream-depth-0')).toBeEnabled();
  });

  it('tests configured external destinations with OSS destination API', async () => {
    const destination = {
      category: SubscriptionCategory.External,
      config: { endpoint: 'https://hooks.example.com' },
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination],
    } as ModifiedCreateEventSubscription;

    render(<AlertAiDestinationSection selectedSource="table" value={value} />);

    expect(screen.getByTestId('test-destination-button')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('test-destination-button'));

    await waitFor(() =>
      expect(testAlertDestination).toHaveBeenCalledWith({
        destinations: [
          expect.objectContaining({
            category: SubscriptionCategory.External,
            type: SubscriptionType.Slack,
          }),
        ],
      })
    );
  });

  it('renders custom notification template fields and updates custom data', async () => {
    const onChange = jest.fn();
    const value = {
      ...baseValue,
      customNotificationTemplateData: {
        displayName: 'Template',
        templateBody: 'Body',
        templateSubject: 'Subject',
      },
      notificationTemplate: CUSTOM_TEMPLATE_VALUE,
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiNotificationSection
        templates={[]}
        value={value}
        onChange={onChange}
      />
    );

    expect(screen.getByTestId('custom-template-name-input')).toHaveValue(
      'Template'
    );
    expect(
      screen.getByText((content) =>
        content.includes('label.template-field-name:label.name')
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('custom-template-subject-input')).toHaveValue(
      'Subject'
    );
    expect(
      screen.getByText((content) =>
        content.includes('label.template-field-name:label.subject')
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('custom-template-body-input')).toHaveValue(
      'Body'
    );
    expect(
      screen.getByText((content) =>
        content.includes('label.template-field-name:label.body')
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('message.handlebar-helper-text')).toHaveLength(
      2
    );

    const bodyEditorFooter = screen.getByTestId(
      'custom-template-validate-container'
    );

    expect(bodyEditorFooter).not.toHaveTextContent(
      'message.handlebar-helper-text'
    );
    expect(bodyEditorFooter).toHaveTextContent(
      'label.validate-template-syntax'
    );
    expect(bodyEditorFooter).toHaveTextContent('label.validate');
    expect(screen.getByTestId('custom-template-info-banner')).toHaveTextContent(
      'message.notification-template-help-text label.view-documentation'
    );
    expect(
      screen.getByRole('link', { name: 'label.view-documentation' })
    ).toHaveAttribute(
      'href',
      'https://docs.getcollate.io/how-to-guides/data-quality-observability/alerts-notifications/notification-templates/index'
    );
    expect(
      screen.getByRole('link', { name: 'label.view-documentation' })
    ).toHaveAttribute('target', '_blank');
    expect(
      screen
        .getByTestId('custom-template-name-input')
        .closest('[data-field-doc]')
    ).toHaveAttribute('data-field-doc', 'root/displayName');
    expect(
      screen
        .getByTestId('custom-template-subject-input')
        .closest('[data-field-doc]')
    ).toHaveAttribute('data-field-doc', 'root/templateSubject');
    expect(
      screen
        .getByTestId('custom-template-body-input')
        .closest('[data-field-doc]')
    ).toHaveAttribute('data-field-doc', 'root/templateBody');

    fireEvent.change(screen.getByTestId('custom-template-subject-input'), {
      target: { value: 'Updated subject' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customNotificationTemplateData: expect.objectContaining({
          displayName: 'Template',
          templateBody: 'Body',
          templateSubject: 'Updated subject',
        }),
      })
    );

    fireEvent.click(screen.getByTestId('custom-template-validate-button'));

    await waitFor(() =>
      expect(validateNotificationTemplate).toHaveBeenCalledWith(
        'Subject',
        'Body'
      )
    );
  });

  it('shows required errors below custom notification template fields without hiding helper text', () => {
    const value = {
      ...baseValue,
      customNotificationTemplateData: {
        displayName: '',
        templateBody: '',
        templateSubject: '',
      },
      notificationTemplate: CUSTOM_TEMPLATE_VALUE,
    } as ModifiedCreateEventSubscription;

    render(<AlertAiNotificationSection templates={[]} value={value} />);

    fireEvent.click(screen.getByTestId('custom-template-validate-button'));

    expect(validateNotificationTemplate).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'label.field-required:label.template-field-name:label.name'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'label.field-required:label.template-field-name:label.subject'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'label.field-required:label.template-field-name:label.body'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('message.handlebar-helper-text')).toHaveLength(
      2
    );
    expect(
      screen.getByTestId('custom-template-validate-container')
    ).not.toHaveTextContent('message.handlebar-helper-text');
  });

  it('renders custom notification template fields as view-only fields', () => {
    const value = {
      ...baseValue,
      customNotificationTemplateData: {
        displayName: 'Template',
        templateBody: '<p><strong>Testing harshit template</strong></p>',
        templateSubject: 'Subject',
      },
      notificationTemplate: CUSTOM_TEMPLATE_VALUE,
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiNotificationSection isViewOnly templates={[]} value={value} />
    );

    expect(screen.getByTestId('custom-template-name-input')).toHaveValue(
      'Template'
    );
    expect(screen.getByTestId('custom-template-name-input')).toBeDisabled();
    expect(screen.getByTestId('custom-template-subject-input')).toHaveValue(
      'Subject'
    );
    expect(screen.getByTestId('custom-template-subject-input')).toBeDisabled();
    expect(
      screen.queryByTestId('custom-template-body-input')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('field-doc-preview')).toHaveTextContent(
      'Testing harshit template'
    );
    expect(
      screen.queryByText('<p><strong>Testing harshit template</strong></p>')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-template-info-banner')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-template-validate-container')
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByTestId('custom-template-name-input')
        .closest('[data-field-doc]')
    ).not.toBeInTheDocument();
  });

  it('renders selected saved notification template fields as read-only fields', () => {
    const template = {
      displayName: 'Saved Template',
      id: 'template-id',
      name: 'saved_template',
      templateBody: 'Saved body',
      templateSubject: 'Saved subject',
    } as NotificationTemplate;
    const selectedTemplate = JSON.stringify({
      id: template.id,
      name: template.name,
      type: 'notificationTemplate',
    });
    const value = {
      ...baseValue,
      notificationTemplate: selectedTemplate,
    } as ModifiedCreateEventSubscription;

    render(<AlertAiNotificationSection templates={[template]} value={value} />);

    expect(screen.getByTestId('custom-template-name-input')).toHaveValue(
      'Saved Template'
    );
    expect(screen.getByTestId('custom-template-name-input')).toBeDisabled();
    expect(screen.getByTestId('custom-template-subject-input')).toHaveValue(
      'Saved subject'
    );
    expect(screen.getByTestId('custom-template-subject-input')).toBeDisabled();
    expect(screen.getByTestId('field-doc-preview')).toHaveTextContent(
      'Saved body'
    );
    expect(
      screen.queryByTestId('custom-template-body-input')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-template-info-banner')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-template-validate-container')
    ).not.toBeInTheDocument();
    // The fields are read-only because a saved template is selected, but the
    // form itself is still editable, so the hints stay. Dropping them here
    // left the panel showing whichever field was focused before, which reads
    // as the hint being broken rather than deliberately absent.
    expect(
      screen
        .getByTestId('custom-template-name-input')
        .closest('[data-field-doc]')
    ).toBeInTheDocument();
  });

  it('resets dependent values when source changes', () => {
    const onChange = jest.fn();
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.External,
          destinationType: SubscriptionType.Slack,
          type: SubscriptionType.Slack,
        },
      ],
      input: {
        actions: [{ effect: Effect.Include, name: 'eventTypeList' }],
        filters: [{ effect: Effect.Include, name: 'domainList' }],
      },
      resources: ['table'],
    };

    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        filterResources={[{ name: 'table' }, { name: 'pipeline' }]}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('source-select'), {
      target: { value: 'pipeline' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        destinations: [],
        input: {},
        resources: ['pipeline'],
      })
    );
  });

  it('submits editable forms and skips submit in view mode', async () => {
    const onSubmit = jest.fn();
    const validValue = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.External,
          config: { receivers: ['alerts@example.com'] },
          destinationType: SubscriptionType.Email,
          type: SubscriptionType.Email,
        },
      ],
      resources: ['table'],
    };

    const editableProps = {
      filterResources: [{ name: 'table' }],
      mode: 'edit' as const,
      onChange: jest.fn(),
      onSubmit,
      shouldShowActionsSection: false,
      shouldShowFiltersSection: false,
      value: validValue,
    };

    const { rerender } = render(<AlertAiForm {...editableProps} />);

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(validValue));

    onSubmit.mockClear();

    rerender(
      <AlertAiForm
        filterResources={[]}
        mode="view"
        shouldShowActionsSection={false}
        shouldShowFiltersSection={false}
        value={baseValue}
      />
    );

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows required errors for name, source, and destination before submitting', async () => {
    const onSubmit = jest.fn();

    render(
      <AlertAiForm
        filterResources={[{ name: 'table' }]}
        mode="add"
        shouldShowActionsSection={false}
        shouldShowFiltersSection={false}
        value={{ ...baseValue, name: '' }}
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('alert-name-input')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByTestId('source-select')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(
      screen.getByText('message.field-text-is-required:label.name')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.field-text-is-required:label.source')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.field-text-is-required:label.destination')
    ).toBeInTheDocument();
  });

  it('clears source required error after selecting a source', async () => {
    const onSubmit = jest.fn();

    render(
      <AlertAiForm
        filterResources={[{ name: 'table' }]}
        mode="add"
        shouldShowActionsSection={false}
        shouldShowFiltersSection={false}
        value={{ ...baseValue, name: '' }}
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    expect(
      screen.getByText('message.field-text-is-required:label.source')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('source-select'), {
      target: { value: 'table' },
    });

    await waitFor(() =>
      expect(
        screen.queryByText('message.field-text-is-required:label.source')
      ).not.toBeInTheDocument()
    );

    expect(
      screen.getByText('message.field-text-is-required:label.name')
    ).toBeInTheDocument();
  });

  it('renders hint docs inside the shared typography wrapper', () => {
    render(
      <AlertAiForm
        filterResources={[{ name: 'table' }]}
        mode="edit"
        shouldShowActionsSection={false}
        shouldShowFiltersSection={false}
        value={baseValue}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    // form-hint-doc is what sizes and colours the hint text. Rendering the doc
    // without it left this panel on TipTap's defaults, visibly heavier than the
    // Data Quality panels, and nothing failed.
    expect(
      screen.getByTestId('hint-doc-slot').querySelector('.form-hint-doc')
    ).toBeInTheDocument();
  });

  it('registers a form hint doc for each main alert field', async () => {
    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        filterResources={[{ name: 'table' }]}
        value={{} as ModifiedCreateEventSubscription}
        onChange={jest.fn()}
      />
    );

    // The docs resolve from a promise inside an effect; flush it so the
    // re-render that attaches data-field-doc has happened before asserting.
    await act(async () => {
      await Promise.resolve();
    });

    for (const field of [
      'alertName',
      'alertDescription',
      'alertSource',
      'alertFilters',
      'alertTrigger',
      'alertDestinations',
      'alertNotificationTemplate',
    ]) {
      expect(
        document.querySelector(`[data-field-doc="${field}"]`)
      ).not.toBeNull();
    }
  });

  it('suppresses field hints in the read-only configuration view', async () => {
    render(
      <AlertAiFormFields
        isViewOnly
        shouldShowActionsSection
        shouldShowFiltersSection
        filterResources={[{ name: 'table' }]}
        value={{} as ModifiedCreateEventSubscription}
        onChange={jest.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('[data-field-doc]')).toBeNull();
  });
});
