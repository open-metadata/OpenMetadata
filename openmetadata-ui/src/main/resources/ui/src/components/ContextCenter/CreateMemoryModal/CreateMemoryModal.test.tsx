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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import {
  Control,
  FieldValues,
  FormProvider,
  useController,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { getContextMemoryVersions } from '../../../rest/contextMemoryAPI';
import CreateMemoryModal from './CreateMemoryModal.component';
import { CreateMemoryModalProps } from './CreateMemoryModal.interface';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Database01: jest.fn(() => null),
  FileLock02: jest.fn(() => null),
  InfoCircle: jest.fn(() => null),
  Lightbulb03: jest.fn(() => null),
  Lock01: jest.fn(() => null),
  Plus: jest.fn(() => null),
  Share07: jest.fn(() => null),
  X: jest.fn(() => null),
}));

jest.mock(
  '../../../components/common/MarkdownEditor/markdownComponents',
  () => ({
    getCustomMarkdownComponents: jest.fn(() => ({})),
    preprocessMarkdownText: jest.fn((text: string) => text),
  })
);

jest.mock('../../../rest/contextMemoryAPI', () => ({
  createContextMemory: jest.fn(),
  updateContextMemory: jest.fn(),
  deleteContextMemory: jest.fn(),
  getContextMemoryVersions: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest.fn(() => null),
  getEntityIconWithBg: jest.fn(() => null),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  getTags: jest.fn(() => Promise.resolve({ data: [], paging: {} })),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  formatDate: jest.fn(() => 'Jan 1, 2026'),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  ClassificationTag: jest.fn(() => <div data-testid="classification-tag" />),
}));

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ userName }: { userName: string }) => <span>{userName}</span>)
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => jest.fn(() => <div data-testid="data-asset-select-list" />)
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Alert: jest.fn(({ title }: { title: string }) => (
    <div role="alert">{title}</div>
  )),
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  BadgeWithButton: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Box: jest.fn(
    ({
      children,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>
  ),
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  ButtonUtility: jest.fn(({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick}>x</button>
  )),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Dialog: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Dot: jest.fn(() => <span />),
  FieldTypes: { TEXT: 'text', SELECT: 'select' },
  FormField: ({
    control,
    name,
    children,
  }: {
    control: Control<FieldValues>;
    name: string;
    children: (controller: unknown) => React.ReactNode;
  }) => {
    const controller = useController({ control, name });

    return <>{children(controller)}</>;
  },
  FormItemLabel: jest.fn(({ label }: { label: React.ReactNode }) => (
    // eslint-disable-next-line jsx-a11y/label-has-for -- test mock
    <label>{label}</label>
  )),
  getField: (fieldProp: {
    name: string;
    label: React.ReactNode;
    type: string;
    props?: Record<string, unknown>;
  }) => {
    const MockField = () => {
      const { control } = useFormContext();
      const { field } = useController({ control, name: fieldProp.name });
      const testId = fieldProp.props?.['data-testid'] as string | undefined;

      if (fieldProp.type === 'select') {
        const options =
          (fieldProp.props?.options as { id: string; label: string }[]) ?? [];

        return (
          <div>
            <label htmlFor={testId}>
              {fieldProp.label}
              <select
                data-testid={testId}
                id={testId}
                value={field.value?.id ?? ''}
                onChange={(e) => {
                  let next: { id: string; label: string } | null = null;
                  for (const opt of options) {
                    if (opt.id === e.target.value) {
                      next = opt;

                      break;
                    }
                  }
                  field.onChange(next);
                }}>
                <option aria-label={testId} value="" />
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      }

      return (
        <div>
          <label htmlFor={testId}>
            {fieldProp.label}
            <input
              aria-label={testId}
              data-testid={testId}
              id={testId}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
            />
          </label>
        </div>
      );
    };

    return <MockField />;
  },
  HookForm: ({
    form,
    children,
    className,
    onSubmit,
  }: {
    form: ReturnType<typeof useForm>;
    children: React.ReactNode;
    className?: string;
    onSubmit?: (e: React.FormEvent) => void;
  }) => (
    <FormProvider {...form}>
      <form className={className} onSubmit={onSubmit}>
        {children}
      </form>
    </FormProvider>
  ),
  Input: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (val: string) => void;
    }) => (
      <input
        aria-label={testId}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
      isOpen ? <div>{children}</div> : null
  ),
  Select: Object.assign(
    jest.fn(
      ({
        'data-testid': testId,
        children,
      }: {
        'data-testid'?: string;
        children?: React.ReactNode;
      }) => <div data-testid={testId}>{children}</div>
    ),
    {
      Item: jest.fn(({ label }: { label: string }) => <option>{label}</option>),
    }
  ),
  TextArea: jest.fn(
    ({
      'data-testid': testId,
      value,
      onChange,
    }: {
      'data-testid'?: string;
      value?: string;
      onChange?: (val: string) => void;
    }) => (
      <textarea
        aria-label={testId}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

describe('CreateMemoryModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onCreated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the content input', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-content-input')).toBeInTheDocument();
  });

  it('renders title and type inputs', () => {
    render(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-select')).toBeInTheDocument();
  });

  it('links applied glossary terms from the memory modal', () => {
    const memory = {
      id: 'memory-id',
      name: 'monthlyRecurringRevenue',
      title: 'Monthly recurring revenue',
      memory: 'Recurring subscription revenue each month.',
      derivedEntities: [
        {
          id: 'term-id',
          type: 'glossaryTerm',
          name: 'monthly_recurring_revenue',
          displayName: 'Monthly recurring revenue',
          fullyQualifiedName: 'subscription_metrics.monthly_recurring_revenue',
        },
      ],
    } as ContextMemory;

    render(
      <MemoryRouter>
        <CreateMemoryModal {...defaultProps} viewOnly memoryToEdit={memory} />
      </MemoryRouter>
    );

    const derivedTerm = screen.getByTestId('memory-derived-term');

    expect(derivedTerm).toHaveTextContent('label.derived-term');
    expect(
      screen
        .getByTestId('memory-metadata-section')
        .compareDocumentPosition(derivedTerm) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const termLink = screen.getByRole('link', {
      name: 'Monthly recurring revenue',
    });

    expect(termLink).toHaveAttribute(
      'href',
      '/glossary/subscription_metrics.monthly_recurring_revenue'
    );

    fireEvent.click(termLink);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  const expensesTable = {
    id: 'table-id',
    type: 'table',
    name: 'fct_expenses',
    fullyQualifiedName: 'svc.db.sch.fct_expenses',
  };
  const expensesQuery = {
    id: 'query-id',
    type: 'query',
    name: 'monthly_expenses',
    displayName: 'Monthly expenses',
    fullyQualifiedName: 'svc.48f70df04c8bc43ab75a5da5da4f95f7',
  };
  const linkedMemory = {
    id: 'memory-id',
    name: 'expense-limit',
    title: 'Expense limit',
    memory: 'Meals are reimbursed up to 50 EUR.',
    primaryEntity: expensesTable,
    relatedEntities: [
      {
        id: 'file-id',
        type: 'contextFile',
        name: 'expense_policy.pdf',
        fullyQualifiedName: 'policies.expense_policy.pdf',
      },
      {
        id: 'other-memory-id',
        type: 'contextMemory',
        name: 'refund-window',
        displayName: 'Refund window',
        fullyQualifiedName: 'refund-window',
      },
    ],
  } as ContextMemory;

  const renderMemory = (
    memory: ContextMemory,
    props: Partial<CreateMemoryModalProps> = {}
  ) =>
    render(
      <MemoryRouter>
        <CreateMemoryModal
          {...defaultProps}
          viewOnly
          memoryToEdit={memory}
          {...props}
        />
      </MemoryRouter>
    );

  // In AI mode the modal outlives a route change, so following a link closes it.
  it('opens linked assets where they live and closes on the way', () => {
    renderMemory(linkedMemory);

    const links = screen.getAllByTestId('linked-asset-link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/table/svc.db.sch.fct_expenses',
      '/context-center/documents?document=file-id',
    ]);
    expect(screen.getByText('Refund window').closest('a')).toBeNull();

    fireEvent.click(links[1]);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // The Memories page keeps the memory in the URL; it closes it in place so Back reopens it.
  it('hands a followed link to onNavigate and ignores a new-tab click', () => {
    const onNavigate = jest.fn();
    renderMemory(linkedMemory, { onNavigate });

    const [tableLink] = screen.getAllByTestId('linked-asset-link');
    fireEvent.click(tableLink, { ctrlKey: true });
    fireEvent.click(tableLink, { metaKey: true });
    fireEvent.click(tableLink, { button: 1 });

    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(tableLink);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('opens a linked query on the one table the memory links', () => {
    renderMemory({
      ...linkedMemory,
      relatedEntities: [expensesQuery],
    } as ContextMemory);

    expect(
      screen.getByRole('link', { name: 'Monthly expenses' })
    ).toHaveAttribute('href', '/query-view/svc.db.sch.fct_expenses/query-id');
  });

  it.each([true, false])(
    'labels a restricted query without linking it when viewOnly is %s',
    (viewOnly) => {
      const restrictedQuery = { id: 'restricted-query-id', type: 'query' };
      renderMemory(
        { ...linkedMemory, relatedEntities: [restrictedQuery] },
        { viewOnly }
      );

      const label = screen.getByText('message.no-permission-to-view');

      expect(label).toBeVisible();
      expect(label.closest('a')).toBeNull();
      expect(screen.queryByText(restrictedQuery.id)).not.toBeInTheDocument();
      expect(
        screen.queryByText(expensesQuery.displayName)
      ).not.toBeInTheDocument();
      expect(screen.getByText('query')).toBeVisible();
    }
  );

  it('leaves a linked query unlinked when the memory links several tables', () => {
    renderMemory({
      ...linkedMemory,
      relatedEntities: [
        expensesQuery,
        {
          id: 'other-table-id',
          type: 'table',
          name: 'dim_employee',
          fullyQualifiedName: 'svc.db.sch.dim_employee',
        },
      ],
    } as ContextMemory);

    expect(screen.getByText('Monthly expenses').closest('a')).toBeNull();
  });

  // The stored reason names the Query by id; its name shows only where the history shows it.
  it('names the deleted Query a memory is held for', async () => {
    (getContextMemoryVersions as jest.Mock).mockResolvedValue({
      entityType: 'contextMemory',
      versions: [
        JSON.stringify({ ...linkedMemory, relatedEntities: [expensesQuery] }),
      ],
    });

    renderMemory({
      ...linkedMemory,
      entityStatus: ContextMemoryStatus.Draft,
      statusReason:
        'Supporting query query-id was deleted; review whether this memory still holds without it',
    } as ContextMemory);

    expect(
      await screen.findByText(
        'Supporting query "Monthly expenses" was deleted; review whether this memory still holds without it'
      )
    ).toBeInTheDocument();
  });

  it('closes when the document a memory came from is opened', () => {
    const memory = {
      id: 'memory-id',
      name: 'expense-limit',
      memory: 'Meals are reimbursed up to 50 EUR.',
      sourceEntity: {
        id: 'file-id',
        type: 'contextFile',
        name: 'expense_policy.pdf',
        fullyQualifiedName: 'policies.expense_policy.pdf',
      },
    } as ContextMemory;

    render(
      <MemoryRouter>
        <CreateMemoryModal {...defaultProps} viewOnly memoryToEdit={memory} />
      </MemoryRouter>
    );

    const source = screen.getByTestId('memory-source-file-link');

    expect(source).toHaveAttribute(
      'href',
      '/context-center/documents?document=file-id'
    );

    fireEvent.click(source);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not offer derived-term navigation while the memory is being edited', () => {
    const memory = {
      id: 'memory-id',
      name: 'monthlyRecurringRevenue',
      title: 'Monthly recurring revenue',
      memory: 'Recurring subscription revenue each month.',
      derivedEntities: [
        {
          id: 'term-id',
          type: 'glossaryTerm',
          name: 'monthly_recurring_revenue',
          displayName: 'Monthly recurring revenue',
          fullyQualifiedName: 'subscription_metrics.monthly_recurring_revenue',
        },
      ],
    } as ContextMemory;

    render(
      <MemoryRouter>
        <CreateMemoryModal {...defaultProps} canEdit memoryToEdit={memory} />
      </MemoryRouter>
    );

    const derivedTermSection = screen.getByTestId('memory-derived-term');

    expect(derivedTermSection).toHaveTextContent('Monthly recurring revenue');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Monthly recurring revenue'));

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows no derived term section when no glossary term came from the memory', () => {
    const memory = {
      id: 'memory-id',
      name: 'churn-risk-score',
      entityStatus: 'Approved',
      shareConfig: { visibility: 'Entity' },
      derivedEntities: [
        {
          id: 'concept-id',
          type: 'ontologyConcept',
          name: 'churn_risk_score',
          fullyQualifiedName: 'business.churn_risk_score',
        },
      ],
    } as ContextMemory;

    render(
      <MemoryRouter>
        <CreateMemoryModal {...defaultProps} viewOnly memoryToEdit={memory} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('memory-metadata-section')).toBeInTheDocument();
    expect(screen.queryByTestId('memory-derived-term')).not.toBeInTheDocument();
  });

  it.each<[ContextMemoryStatus, string]>([
    [ContextMemoryStatus.Deprecated, 'label.deprecated'],
    [ContextMemoryStatus.Superseded, 'label.superseded'],
  ])(
    'shows why a %s memory was replaced and links to its successor',
    (status, label) => {
      render(
        <MemoryRouter>
          <CreateMemoryModal
            {...defaultProps}
            viewOnly
            memoryToEdit={{
              id: 'old-memory',
              name: 'old-memory',
              entityStatus: status,
              statusReason: 'The replacement has the corrected definition.',
              supersededBy: {
                id: 'new-memory',
                type: 'contextMemory',
                name: 'new-memory',
              },
            }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        screen.getByText('The replacement has the corrected definition.')
      ).toBeInTheDocument();
      expect(screen.getByText('new-memory')).toHaveAttribute(
        'href',
        '/context-center/memories?memory=new-memory'
      );
    }
  );

  it('keeps the other Context Center parameters when opening the successor', () => {
    render(
      <MemoryRouter
        initialEntries={['/context-center/memories?memory=old-memory&tab=all']}>
        <CreateMemoryModal
          {...defaultProps}
          viewOnly
          memoryToEdit={{
            id: 'old-memory',
            name: 'old-memory',
            entityStatus: ContextMemoryStatus.Deprecated,
            supersededBy: {
              id: 'new-memory',
              type: 'contextMemory',
              name: 'new-memory',
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('new-memory')).toHaveAttribute(
      'href',
      '/context-center/memories?memory=new-memory&tab=all'
    );
  });

  it('does not offer successor navigation while the memory is being edited', () => {
    render(
      <MemoryRouter>
        <CreateMemoryModal
          {...defaultProps}
          canEdit
          memoryToEdit={{
            id: 'old-memory',
            name: 'old-memory',
            entityStatus: ContextMemoryStatus.Deprecated,
            supersededBy: {
              id: 'new-memory',
              type: 'contextMemory',
              name: 'new-memory',
            },
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('new-memory')).not.toHaveAttribute('href');
  });
});
