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
  within,
} from '@testing-library/react';
import { isEmpty } from 'lodash';
import { ReactNode } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import { AlertCapabilities } from '../../../generated/events/api/alertCapabilities';
import { AlertType } from '../../../generated/events/api/createEventSubscription';
import {
  AlertType as EventSubscriptionAlertType,
  ArgumentsInput,
  Effect,
  EventFilterRule,
  EventSubscription,
  InputType,
  Status,
  SubscriptionCategory,
  SubscriptionType,
  Type,
  type Destination,
} from '../../../generated/events/eventSubscription';
import type { AlertSelection } from '../../../hooks/useAlertSelection';
import {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
} from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import type { SelectionSupport } from '../../../utils/Alerts/AlertSelectionUtil';
import { AlertSourceSearch } from '../../../utils/Alerts/AlertSourceSearch';
import alertsClassBase from '../../../utils/AlertsClassBase';
import AlertAiDestinationConfigFields from './AlertAiDestinationConfigFields.component';
import AlertAiDestinationItem from './AlertAiDestinationItem.component';
import AlertAiDestinationSection from './AlertAiDestinationSection.component';
import AlertAiForm from './AlertAiForm.component';
import AlertAiFormFields from './AlertAiFormFields.component';
import AlertAiRuleSection, {
  RuleArgumentField,
} from './AlertAiRuleSection.component';
import AlertAiSection from './AlertAiSection.component';
import AlertDescriptionCard from './AlertDescriptionCard.component';

// The AI form's onChange is a functional updater (prev) => next; apply the latest updater to the
// value the component rendered with to get the committed value the assertions check.
const applyLastUpdater = (
  onChange: jest.Mock,
  prev: ModifiedCreateEventSubscription
): ModifiedCreateEventSubscription =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0](prev);

const makeSourceSearch = (): AlertSourceSearch => ({
  byId: jest.fn().mockResolvedValue([]),
  byName: jest.fn().mockResolvedValue([]),
  containerEntities: [],
  indexes: [],
});

// The sources the server lists for the picker.
const LISTED_SOURCES = {
  alertType: 'Observability',
  filters: [],
  triggers: [],
  sources: ['table', 'topic', 'pipeline'].map((name) => ({
    name,
    kind: 'entity',
  })),
} as unknown as AlertCapabilities;

// What the page that shows the form hands it: what the chosen sources support, and their search.
// An answer for the chosen sources says whether it lists any rule, as getSelectionSupport does.
const selectionOf = (support: SelectionSupport = {}): AlertSelection => ({
  sources: [],
  support: {
    hasFilters: support.supportedFilters && !isEmpty(support.supportedFilters),
    hasTriggers:
      support.supportedTriggers && !isEmpty(support.supportedTriggers),
    ...support,
  },
  capabilities: {
    selection: LISTED_SOURCES,
    knownSources: [],
    loading: false,
    settled: true,
    retry: jest.fn(),
  },
  ready: true,
  loading: false,
  search: makeSourceSearch(),
});

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
    Alert: ({
      title,
      variant,
    }: MockCoreProps & { title?: ReactNode; variant?: string }) => (
      <div data-testid={`alert-${variant}`}>{title}</div>
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
    Label: ({ children }: MockCoreProps) => <span>{children}</span>,
    MultiSelect,
    RadioButton: () => null,
    RadioGroup: ({
      children,
      'data-testid': testId,
      isDisabled,
      onChange,
      value,
    }: MockCoreProps) => (
      <div data-testid={testId}>
        {children}
        <select
          aria-label="http-method"
          disabled={isDisabled}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
        </select>
      </div>
    ),
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

jest.mock('@openmetadata/ui-core-components/icons', () => ({
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
    jest.restoreAllMocks();
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
        selectedSources={[]}
        sourceSearch={makeSourceSearch()}
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
        selectedSources={[]}
        sourceSearch={makeSourceSearch()}
        supportedRules={supportedRules}
        title="Filters"
        value={baseValue}
      />
    );

    const addFilterButton = screen.getByTestId('add-filters');

    expect(addFilterButton).toBeDisabled();
  });

  it('enables add rule buttons once the chosen sources support rules', () => {
    const value = {
      ...baseValue,
      resources: ['table', 'topic'],
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
        selection={selectionOf({
          supportedFilters: [sourceRule],
          supportedTriggers: [sourceRule],
        })}
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
        selectedSources={['table']}
        sourceSearch={makeSourceSearch()}
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
          selectedSources={['table']}
          sourceSearch={makeSourceSearch()}
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

    await waitFor(() =>
      expect(screen.getByText('Domain 1')).toBeInTheDocument()
    );
    (searchQuery as jest.Mock).mockClear();
    (searchQuery as jest.Mock).mockResolvedValueOnce({
      hits: {
        hits: [
          {
            _source: { displayName: 'Domain 2', fullyQualifiedName: 'domain2' },
          },
        ],
      },
    });

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
    // Search results replace the initial options, as in the classic form.
    await waitFor(() =>
      expect(screen.getByText('Domain 2')).toBeInTheDocument()
    );

    expect(screen.queryByText('Domain 1')).not.toBeInTheDocument();
  });

  it('keeps a typed search when the initial options load during the debounce', async () => {
    jest.useFakeTimers();
    let resolveInitialLoad: ((value: unknown) => void) | undefined;
    (searchQuery as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialLoad = resolve;
        })
    );
    const selectedRule: ArgumentsInput = {
      arguments: [{ input: [], name: 'domainList' }],
      effect: Effect.Include,
      name: 'matchAnyDomain',
    };

    render(
      <AlertAiRuleSection
        field="filters"
        selectedSources={['table']}
        sourceSearch={makeSourceSearch()}
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
        value={
          {
            ...baseValue,
            input: { filters: [selectedRule] },
          } as ModifiedCreateEventSubscription
        }
        onChange={jest.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('domainList-autocomplete'), {
      target: { value: 'dom' },
    });

    await act(async () => {
      resolveInitialLoad?.({ hits: { hits: [] } });
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dom' })
    );
  });

  it('keeps a typed search when the source search is rebuilt during the debounce', async () => {
    jest.useFakeTimers();
    const getSourceSearch = () =>
      ({
        byId: jest.fn(),
        byName: jest.fn(),
        containerEntities: [],
        indexes: [],
      } as unknown as AlertSourceSearch);
    const value = {
      ...baseValue,
      input: {
        filters: [
          {
            arguments: [{ input: [], name: 'domainList' }],
            effect: Effect.Include,
            name: 'matchAnyDomain',
          },
        ],
      },
    } as ModifiedCreateEventSubscription;
    const renderField = (sourceSearch: AlertSourceSearch) => (
      <RuleArgumentField
        argument="domainList"
        field="filters"
        index={0}
        name={0}
        sourceSearch={sourceSearch}
        value={value}
        onChange={jest.fn()}
      />
    );

    const { rerender } = render(renderField(getSourceSearch()));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    (searchQuery as jest.Mock).mockClear();

    fireEvent.change(screen.getByTestId('domainList-autocomplete'), {
      target: { value: 'dom' },
    });
    // Adding a filter re-asks the server what the selection supports, which hands the field
    // a new source search while the typed text is still waiting on the debounce.
    rerender(renderField(getSourceSearch()));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dom' })
    );
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
        selectedSources={['testCase']}
        sourceSearch={makeSourceSearch()}
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

    expect(applyLastUpdater(onChange, value)).toEqual(
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
          selectedSources={['testCase']}
          sourceSearch={makeSourceSearch()}
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
        selectedSources={['table']}
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

    expect(applyLastUpdater(onChange, value)).toEqual(
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

    expect(applyLastUpdater(onChange, value)).toEqual(
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

  it('edits webhook headers, query params, and HTTP method like the classic form', () => {
    const onChange = jest.fn();
    const destination = {
      config: {
        endpoint: 'https://hooks.example.com',
        headers: [{ key: 'X-Token', value: 'abc' }],
      },
      destinationType: SubscriptionType.Webhook,
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

    const lastConfig = () =>
      (
        applyLastUpdater(onChange, value)
          .destinations?.[0] as ModifiedDestination
      ).config as {
        headers?: { key: string; value: string }[];
        httpMethod?: string;
        queryParams?: { key: string; value: string }[];
      };

    expect(screen.getByTestId('header-key-input-0-0')).toHaveValue('X-Token');

    fireEvent.change(screen.getByTestId('header-value-input-0-0'), {
      target: { value: 'xyz' },
    });

    expect(lastConfig().headers).toEqual([{ key: 'X-Token', value: 'xyz' }]);

    fireEvent.click(screen.getByTestId('add-query-param-button-0'));

    expect(lastConfig().queryParams).toEqual([{ key: '', value: '' }]);

    fireEvent.click(screen.getByTestId('remove-header-button-0-0'));

    expect(lastConfig().headers).toEqual([]);

    const httpMethod = within(screen.getByTestId('http-method-0')).getByRole(
      'combobox'
    );

    expect(httpMethod).toHaveValue('POST');

    fireEvent.change(httpMethod, { target: { value: 'PUT' } });

    expect(lastConfig().httpMethod).toBe('PUT');
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

    expect(applyLastUpdater(onChange, value)).toEqual(
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

  it('shows each duplicate AI alert destination its own test status', async () => {
    const duplicate = {
      category: SubscriptionCategory.External,
      config: { endpoint: 'https://hooks.slack.com' },
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    } as ModifiedDestination;
    const destinationsWithStatus: Array<Destination | undefined> = [
      {
        category: SubscriptionCategory.External,
        config: { endpoint: 'https://hooks.slack.com' },
        type: SubscriptionType.Slack,
        statusDetails: { status: Status.Success, statusCode: 200 },
      } as Destination,
      {
        category: SubscriptionCategory.External,
        config: { endpoint: 'https://hooks.slack.com' },
        type: SubscriptionType.Slack,
        statusDetails: {
          status: Status.Failed,
          statusCode: 500,
          reason: 'rate limited',
        },
      } as Destination,
    ];
    const value = {
      ...baseValue,
      destinations: [duplicate, duplicate],
    } as ModifiedCreateEventSubscription;

    render(
      <>
        <AlertAiDestinationItem
          destination={duplicate}
          destinationsWithStatus={destinationsWithStatus}
          name={0}
          value={value}
        />
        <AlertAiDestinationItem
          destination={duplicate}
          destinationsWithStatus={destinationsWithStatus}
          name={1}
          value={value}
        />
      </>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('alert-success')).toHaveLength(1);
      expect(screen.getAllByTestId('alert-error')).toHaveLength(1);
    });
  });

  it('does not leak an external AI destination test status onto a neighboring internal destination', async () => {
    const internal = {
      category: SubscriptionCategory.Owners,
      destinationType: SubscriptionCategory.Owners,
      type: SubscriptionType.Email,
    } as ModifiedDestination;
    const external = {
      category: SubscriptionCategory.External,
      config: { endpoint: 'https://hooks.slack.com' },
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    } as ModifiedDestination;
    const destinationsWithStatus: Array<Destination | undefined> = [
      undefined,
      {
        category: SubscriptionCategory.External,
        config: { endpoint: 'https://hooks.slack.com' },
        type: SubscriptionType.Slack,
        statusDetails: { status: Status.Success, statusCode: 200 },
      } as Destination,
    ];
    const value = {
      ...baseValue,
      destinations: [internal, external],
    } as ModifiedCreateEventSubscription;

    render(
      <>
        <AlertAiDestinationItem
          destination={internal}
          destinationsWithStatus={destinationsWithStatus}
          name={0}
          value={value}
        />
        <AlertAiDestinationItem
          destination={external}
          destinationsWithStatus={destinationsWithStatus}
          name={1}
          value={value}
        />
      </>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('alert-success')).toHaveLength(1);
      expect(screen.queryAllByTestId('alert-error')).toHaveLength(0);
    });
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

    render(
      <AlertAiDestinationSection selectedSources={['table']} value={value} />
    );

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

  it('clears AI destination test statuses when a destination row is removed', async () => {
    const destination = {
      category: SubscriptionCategory.External,
      config: { endpoint: 'https://hooks.example.com' },
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
    } as ModifiedDestination;
    const value = {
      ...baseValue,
      destinations: [destination, destination],
    } as ModifiedCreateEventSubscription;
    (testAlertDestination as jest.Mock).mockResolvedValueOnce([
      { statusDetails: { status: Status.Failed, statusCode: 500 } },
      { statusDetails: { status: Status.Success, statusCode: 200 } },
    ]);

    render(
      <AlertAiDestinationSection selectedSources={['table']} value={value} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-destination-button'));
    });

    expect(await screen.findByTestId('alert-success')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remove-destination-0'));

    await waitFor(() => {
      expect(screen.queryByTestId('alert-success')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument();
    });
  });

  it('rebuilds a clean internal row when switching a populated external destination to Owners', () => {
    const onChange = jest.fn();
    const populatedSlack: ModifiedDestination = {
      category: SubscriptionCategory.External,
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
      config: {
        endpoint: 'https://hooks.slack.com/services/T00/B00/XXX',
        authType: { type: Type.Bearer, secretKey: 'secret' },
        headers: [{ key: 'X-Key', value: 'v' }],
        queryParams: [{ key: 'q', value: '1' }],
      },
      notifyDownstream: true,
      downstreamDepth: 3,
    } as ModifiedDestination;
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [populatedSlack],
      resources: ['table'],
    };

    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        selection={selectionOf({
          recipientCategories: [SubscriptionCategory.Owners],
        })}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('destination-category-select-0'), {
      target: { value: SubscriptionCategory.Owners },
    });

    const result = applyLastUpdater(onChange, value);
    const resultDest = result.destinations?.[0] as ModifiedDestination;

    expect(resultDest.category).toBe(SubscriptionCategory.Owners);
    expect(resultDest.destinationType).toBe(SubscriptionCategory.Owners);
    expect(resultDest.type).toBeUndefined();
    expect(resultDest.config).toEqual({ sendToOwners: true });
    expect(resultDest.config?.endpoint).toBeUndefined();
    expect(resultDest.notifyDownstream).toBeUndefined();
    expect(resultDest.downstreamDepth).toBeUndefined();
  });

  it('does not carry the stale Slack endpoint when switching to another external destination (MSTeams)', () => {
    const onChange = jest.fn();
    const populatedSlack: ModifiedDestination = {
      category: SubscriptionCategory.External,
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
      config: {
        endpoint: 'https://hooks.slack.com/services/T00/B00/XXX',
        authType: { type: Type.Bearer, secretKey: 'secret' },
        headers: [{ key: 'X-Key', value: 'v' }],
        queryParams: [{ key: 'q', value: '1' }],
      },
      notifyDownstream: true,
      downstreamDepth: 3,
    } as ModifiedDestination;
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [populatedSlack],
      resources: ['table'],
    };

    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        selection={selectionOf()}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('destination-category-select-0'), {
      target: { value: SubscriptionType.MSTeams },
    });

    const result = applyLastUpdater(onChange, value);
    const resultDest = result.destinations?.[0] as ModifiedDestination;

    expect(resultDest.category).toBe(SubscriptionCategory.External);
    expect(resultDest.destinationType).toBe(SubscriptionType.MSTeams);
    expect(resultDest.type).toBe(SubscriptionType.MSTeams);
    expect(resultDest.config).toBeUndefined();
    expect(resultDest.config?.endpoint).toBeUndefined();
    expect(resultDest.notifyDownstream).toBeUndefined();
    expect(resultDest.downstreamDepth).toBeUndefined();
  });

  it('keeps the configured destination when the destination selection is cleared', () => {
    const onChange = jest.fn();
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.External,
          destinationType: SubscriptionType.Slack,
          type: SubscriptionType.Slack,
          config: { endpoint: 'https://hooks.slack.com/services/T00/B00/XXX' },
        } as ModifiedDestination,
      ],
      resources: ['table'],
    };

    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        selection={selectionOf()}
        value={value}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByTestId('destination-category-select-0'), {
      target: { value: '' },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks submit of a switched-but-unconfigured destination so stale fields never reach onSubmit', async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const populatedSlack: ModifiedDestination = {
      category: SubscriptionCategory.External,
      destinationType: SubscriptionType.Slack,
      type: SubscriptionType.Slack,
      config: {
        endpoint: 'https://hooks.slack.com/services/T00/B00/XXX',
        authType: { type: Type.Bearer, secretKey: 'secret' },
      },
      notifyDownstream: true,
      downstreamDepth: 3,
    } as ModifiedDestination;
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [populatedSlack],
      resources: ['table'],
    };

    const { rerender } = render(
      <AlertAiForm
        shouldShowActionsSection
        shouldShowFiltersSection
        mode="edit"
        selection={selectionOf()}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('destination-category-select-0'), {
      target: { value: SubscriptionType.MSTeams },
    });

    // Simulate the parent persisting the functional updater into state before the save.
    const switchedValue = applyLastUpdater(onChange, value);
    onChange.mockClear();

    rerender(
      <AlertAiForm
        shouldShowActionsSection
        shouldShowFiltersSection
        mode="edit"
        selection={selectionOf()}
        value={switchedValue}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());

    const submittedDestination = onSubmit.mock.calls[0]?.[0]?.destinations?.[0];

    // No payload reached onSubmit, and there is no stale Slack endpoint or downstream state to leak.
    expect(submittedDestination).toBeUndefined();
  });

  it('still submits a freshly-configured webhook destination after a category switch (no webhook regression)', async () => {
    const onSubmit = jest.fn();
    const value: ModifiedCreateEventSubscription = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.External,
          destinationType: SubscriptionType.MSTeams,
          type: SubscriptionType.MSTeams,
          config: { endpoint: 'https://outlook.example/webhook' },
        } as ModifiedDestination,
      ],
      resources: ['table'],
    };

    render(
      <AlertAiForm
        mode="edit"
        selection={selectionOf()}
        shouldShowActionsSection={false}
        shouldShowFiltersSection={false}
        value={value}
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.submit(screen.getByTestId('alert-ai-form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(value));

    expect(onSubmit.mock.calls[0][0].destinations[0].config).toEqual({
      endpoint: 'https://outlook.example/webhook',
    });
  });

  it('shows required errors instead of testing an unconfigured external destination', async () => {
    const value = {
      ...baseValue,
      destinations: [
        {
          category: SubscriptionCategory.External,
          destinationType: SubscriptionType.Slack,
          type: SubscriptionType.Slack,
        },
      ],
    } as ModifiedCreateEventSubscription;

    render(
      <AlertAiDestinationSection selectedSources={['table']} value={value} />
    );

    fireEvent.click(screen.getByTestId('test-destination-button'));

    expect(
      await screen.findByText(
        'message.field-text-is-required:label.endpoint-url'
      )
    ).toBeInTheDocument();
    expect(testAlertDestination).not.toHaveBeenCalled();
  });

  describe('several sources', () => {
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
    const renderFields = (onChange: jest.Mock) =>
      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={value}
          onChange={onChange}
        />
      );

    it('adds a source to the ones chosen, starting the rules over but keeping the destinations', () => {
      const onChange = jest.fn();
      renderFields(onChange);

      fireEvent.change(screen.getByTestId('source-select-options'), {
        target: { value: 'pipeline' },
      });

      expect(applyLastUpdater(onChange, value)).toEqual(
        expect.objectContaining({
          destinations: value.destinations,
          input: {},
          resources: ['table', 'pipeline'],
        })
      );
    });

    it('starts the destinations over when a source is taken away', () => {
      const onChange = jest.fn();
      renderFields(onChange);

      fireEvent.click(screen.getByTestId('source-select-clear-table'));

      expect(applyLastUpdater(onChange, value)).toEqual(
        expect.objectContaining({
          destinations: [],
          input: {},
          resources: [],
        })
      );
    });

    it('shows every source a saved alert watches', () => {
      render(
        <AlertAiFormFields
          isViewOnly
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={{ ...value, resources: ['table', 'pipeline'] }}
        />
      );

      expect(
        screen.getByTestId('source-select-clear-table')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('source-select-clear-pipeline')
      ).toBeInTheDocument();
      expect(screen.getByTestId('source-select')).toBeDisabled();
    });

    it('searches what every chosen source holds for a name filter', async () => {
      const selection = selectionOf({
        supportedFilters: [
          {
            arguments: ['fqnList'],
            condition: '',
            effect: Effect.Include,
            inputType: InputType.Runtime,
            name: 'filterByFqn',
          } as EventFilterRule,
        ],
      });
      (selection.search.byName as jest.Mock).mockResolvedValue([
        { label: 'shop.orders', value: 'shop.orders' },
      ]);

      await act(async () => {
        render(
          <AlertAiFormFields
            shouldShowFiltersSection
            selection={selection}
            shouldShowActionsSection={false}
            value={{
              ...value,
              input: {
                filters: [
                  {
                    arguments: [{ input: [], name: 'fqnList' }],
                    effect: Effect.Include,
                    name: 'filterByFqn',
                  },
                ],
              },
              resources: ['table', 'pipeline'],
            }}
            onChange={jest.fn()}
          />
        );
      });

      expect(selection.search.byName).toHaveBeenCalledWith('');
      expect(await screen.findByText('shop.orders')).toBeInTheDocument();
    });
  });

  describe('view-mode section visibility when what the sources support is unknown', () => {
    const viewValue = {
      ...baseValue,
      input: {
        actions: [{ effect: Effect.Include, name: 'testResultTrigger' }],
        filters: [{ effect: Effect.Include, name: 'domainList' }],
      },
      resources: ['table'],
    } as ModifiedCreateEventSubscription;
    const domainFilterRule: EventFilterRule = {
      condition: '',
      effect: Effect.Include,
      name: 'domainList',
    };
    const testResultTriggerRule: EventFilterRule = {
      condition: '',
      effect: Effect.Include,
      name: 'testResultTrigger',
    };

    it('renders configured filters and triggers in view mode when what the sources support is unknown (regression)', () => {
      render(
        <AlertAiFormFields
          isViewOnly
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={viewValue}
        />
      );

      expect(
        screen.getByTestId('label.filter-plural-section')
      ).toBeInTheDocument();
      expect(screen.getByTestId('label.trigger-section')).toBeInTheDocument();
      expect(screen.getByTestId('filters-0')).toBeInTheDocument();
      expect(screen.getByTestId('actions-0')).toBeInTheDocument();
    });

    it('renders configured rules in view mode once the sources support them (contrast)', () => {
      render(
        <AlertAiFormFields
          isViewOnly
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf({
            supportedFilters: [domainFilterRule],
            supportedTriggers: [testResultTriggerRule],
          })}
          value={viewValue}
        />
      );

      expect(
        screen.getByTestId('label.filter-plural-section')
      ).toBeInTheDocument();
      expect(screen.getByTestId('label.trigger-section')).toBeInTheDocument();
    });

    // The server answers after the saved alert has loaded, or its answer failed.
    it("keeps a saved alert's rules in edit mode while what the sources support is unknown", () => {
      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={viewValue}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('filters-0')).toBeInTheDocument();
      expect(screen.getByTestId('actions-0')).toBeInTheDocument();
      // A saved rule is shown by its name, never blank.
      expect(screen.getByTestId('filters-select-0')).toHaveValue('domainList');
      // Nothing new can be added until the server says what is supported.
      expect(screen.getByTestId('add-filters')).toBeDisabled();
    });

    it('shows no empty rule section in edit mode while what the sources support is unknown', () => {
      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={{ ...viewValue, input: {} }}
          onChange={jest.fn()}
        />
      );

      expect(
        screen.queryByTestId('label.filter-plural-section')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('label.trigger-section')
      ).not.toBeInTheDocument();
    });

    // Rules stored only in filteringRules, with no `input` selections.
    const legacyAlert: EventSubscription = {
      alertType: EventSubscriptionAlertType.Observability,
      destinations: [
        {
          category: SubscriptionCategory.External,
          config: { endpoint: 'https://hooks.slack.com/services/x' },
          readTimeout: 12,
          timeout: 10,
          type: SubscriptionType.Slack,
        },
      ],
      id: 'legacy-alert-id',
      name: 'legacy-alert',
      filteringRules: {
        actions: [
          {
            arguments: ['testSuiteList'],
            condition: 'matchTestResult(true)',
            effect: Effect.Include,
            name: 'testResultTrigger',
          },
        ],
        resources: ['table'],
        rules: [
          {
            arguments: ['domainList'],
            condition: 'matchAnyDomain(true)',
            effect: Effect.Include,
            name: 'domainList',
          },
        ],
      },
    } as EventSubscription;

    it("renders a legacy-shaped alert's rules in view mode after seeding from filteringRules", () => {
      // A WrittenByHand alert carries its rules only in the legacy filteringRules
      // shape with no `input`; getModifiedAlertDataForForm seeds `input` from it.
      const seeded = alertsClassBase.getModifiedAlertDataForForm(legacyAlert);

      render(
        <AlertAiFormFields
          isViewOnly
          shouldShowActionsSection
          shouldShowFiltersSection
          alert={seeded}
          selection={selectionOf()}
          value={seeded}
        />
      );

      // The legacy rules are seeded into `input`, so the form lists them in view
      // mode instead of hiding the sections — "a saved alert never hides them".
      expect(
        screen.getByTestId('label.filter-plural-section')
      ).toBeInTheDocument();
      expect(screen.getByTestId('label.trigger-section')).toBeInTheDocument();
      expect(screen.getByTestId('filters-0')).toBeInTheDocument();
      expect(screen.getByTestId('actions-0')).toBeInTheDocument();
      expect(screen.getByTestId('filters-select-0')).toHaveValue('domainList');
      expect(screen.getByTestId('actions-select-0')).toHaveValue(
        'testResultTrigger'
      );
    });

    it("keeps a legacy-shaped alert's rules listed when its sources change", () => {
      const seeded = alertsClassBase.getModifiedAlertDataForForm(legacyAlert);
      const formValue: ModifiedCreateEventSubscription = {
        ...seeded,
        domains: seeded.domains?.map(
          (domain) => domain.fullyQualifiedName ?? domain.id
        ),
      };
      const onChange = jest.fn();

      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          alert={seeded}
          selection={selectionOf()}
          value={formValue}
          onChange={onChange}
        />
      );

      fireEvent.change(screen.getByTestId('source-select-options'), {
        target: { value: 'pipeline' },
      });

      expect(applyLastUpdater(onChange, formValue)).toEqual(
        expect.objectContaining({
          input: seeded.input,
          resources: ['table', 'pipeline'],
        })
      );
    });

    it("keeps a legacy-shaped alert's rules read-only in edit mode", () => {
      const seeded = alertsClassBase.getModifiedAlertDataForForm(legacyAlert);

      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          alert={seeded}
          selection={selectionOf()}
          value={seeded}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByTestId('alert-brand')).toHaveTextContent(
        'message.alert-rules-read-only'
      );
      expect(screen.getByTestId('filters-select-0')).toHaveValue('domainList');
      expect(screen.queryByTestId('add-filters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-actions')).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-name-input')).not.toBeDisabled();
    });
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
      selection: selectionOf(),
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
        mode="view"
        selection={selectionOf()}
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
        mode="add"
        selection={selectionOf()}
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
        mode="add"
        selection={selectionOf()}
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

    fireEvent.change(screen.getByTestId('source-select-options'), {
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
        mode="edit"
        selection={selectionOf()}
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

  describe('notification template section', () => {
    it('renders none when no section is registered, as in OSS', () => {
      render(
        <AlertAiFormFields
          shouldShowActionsSection
          shouldShowFiltersSection
          selection={selectionOf()}
          value={{} as ModifiedCreateEventSubscription}
          onChange={jest.fn()}
        />
      );

      expect(screen.queryByTestId('template-section')).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-field-doc="alertNotificationTemplate"]')
      ).toBeNull();
    });

    it('renders the registered section with the template state', () => {
      const TemplateSection = jest.fn(() => (
        <div data-testid="template-section" />
      ));
      jest
        .spyOn(alertsClassBase, 'getAlertAiTemplateSection')
        .mockReturnValue(TemplateSection);
      const onChange = jest.fn();
      const permission = { Create: true } as OperationPermission;
      const templates = [{ id: 'template-id' }] as NotificationTemplate[];
      const value = { name: 'alert' } as ModifiedCreateEventSubscription;

      render(
        <AlertAiFormFields
          isViewOnly
          shouldShowActionsSection
          shouldShowFiltersSection
          templatesLoading
          selection={selectionOf()}
          templateResourcePermission={permission}
          templates={templates}
          value={value}
          onChange={onChange}
        />
      );

      expect(screen.getByTestId('template-section')).toBeInTheDocument();
      expect(TemplateSection).toHaveBeenCalledWith(
        {
          isViewOnly: true,
          loading: true,
          onChange,
          templateResourcePermission: permission,
          templates,
          value,
        },
        expect.anything()
      );
    });
  });

  it('registers a form hint doc for each main alert field', async () => {
    jest
      .spyOn(alertsClassBase, 'getAlertAiTemplateSection')
      .mockReturnValue(() => null);
    render(
      <AlertAiFormFields
        shouldShowActionsSection
        shouldShowFiltersSection
        selection={selectionOf()}
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
        selection={selectionOf()}
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
