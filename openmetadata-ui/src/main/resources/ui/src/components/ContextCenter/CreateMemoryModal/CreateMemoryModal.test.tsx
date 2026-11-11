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
import { Button } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { OwnerType } from '../../../enums/user.enum';
import {
  ContextMemory,
  ContextMemoryStatus,
} from '../../../generated/entity/context/contextMemory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getContextMemoryById,
  getContextMemoryVersions,
  updateContextMemory,
} from '../../../rest/contextMemoryAPI';
import { getUserByName } from '../../../rest/userAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import CreateMemoryModal from './CreateMemoryModal.component';
import { CreateMemoryModalProps } from './CreateMemoryModal.interface';

jest.mock('react-i18next', () => {
  // One object across renders, like the global mock; echoes the Query a translated reason names.
  const translation = {
    t: (key: string, options?: { query?: string }) =>
      options?.query === undefined ? key : `${key}:${options.query}`,
    i18n: { language: 'en-US', dir: () => 'ltr' },
  };

  return {
    ...jest.requireActual('react-i18next'),
    useTranslation: () => translation,
  };
});

const DISPLAY_NAMES: Record<string, string> = {
  admin: 'Admin User',
  alice: 'Alice Smith',
  MemoryReconciliationApplicationBot: 'Memory Reconciliation Agent',
};

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
  XClose: jest.fn(() => null),
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
  getContextMemoryById: jest.fn(),
  getContextMemoryVersions: jest.fn(),
}));

jest.mock('../../../rest/userAPI', () => ({
  ...jest.requireActual('../../../rest/userAPI'),
  getUserByName: jest.fn(),
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
  jest.fn(
    ({ userName, displayName }: { userName: string; displayName?: string }) => (
      <span>{displayName ?? userName}</span>
    )
  )
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
      'data-testid': testId,
      isDisabled,
      onClick,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
      isDisabled?: boolean;
      onClick?: () => void;
    }) => (
      // The core Button is type="button" unless told otherwise, so it never submits the form.
      <button
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onClick}>
        {children}
      </button>
    )
  ),
  ButtonUtility: jest.fn(({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick}>x</button>
  )),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Dialog: Object.assign(
    jest.fn(
      ({
        children,
        showCloseButton,
        onClose,
      }: {
        children: React.ReactNode;
        showCloseButton?: boolean;
        onClose?: () => void;
      }) => (
        <div>
          {showCloseButton && (
            <button
              aria-label="label.close"
              data-testid="memory-modal-close"
              onClick={onClose}>
              x
            </button>
          )}
          {children}
        </div>
      )
    ),
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
    useApplicationStore.setState({ userProfilePics: {} });
    (getUserByName as jest.Mock).mockImplementation(async (name: string) => ({
      id: name,
      name,
      displayName: DISPLAY_NAMES[name],
      email: '',
    }));
  });

  const renderViewOnly = (memory: ContextMemory) =>
    renderWithQueryClient(
      <MemoryRouter>
        <CreateMemoryModal {...defaultProps} viewOnly memoryToEdit={memory} />
      </MemoryRouter>
    );

  it('renders the content input', () => {
    renderWithQueryClient(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-content-input')).toBeInTheDocument();
  });

  it('renders title and type inputs', () => {
    renderWithQueryClient(<CreateMemoryModal {...defaultProps} />);

    expect(screen.getByTestId('memory-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-select')).toBeInTheDocument();
  });

  it.each([
    {
      type: 'user',
      name: 'alice',
      displayName: 'Alice',
      ownerType: OwnerType.USER,
    },
    {
      type: 'team',
      name: 'operations',
      displayName: 'Operations',
      ownerType: OwnerType.TEAM,
    },
  ])('shows the $type owner and last updater separately', async (ownerCase) => {
    const { ownerType, ...owner } = ownerCase;
    const memory: ContextMemory = {
      id: 'memory-id',
      name: 'refund-policy',
      owners: [{ id: 'owner-id', ...owner }],
      updatedBy: 'admin',
      updatedAt: 1767225600000,
    };

    renderViewOnly(memory);

    const metadata = within(screen.getByTestId('memory-metadata-section'));

    expect(await metadata.findByText('Admin User')).toBeInTheDocument();
    expect(metadata.getByText('label.updated-by')).toBeInTheDocument();
    expect(metadata.getByText(/Jan 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText('label.owner')).toBeInTheDocument();
    expect(screen.getByText(owner.displayName)).toBeInTheDocument();
    expect(UserPopOverCard).toHaveBeenCalledWith(
      expect.objectContaining({ type: ownerType, userName: owner.name }),
      expect.anything()
    );
    expect(screen.queryByText('label.created-by')).not.toBeInTheDocument();
  });

  it('names the last updater by display name, as the memory card does', async () => {
    const memory: ContextMemory = {
      id: 'memory-id',
      name: 'refund-policy',
      owners: [
        { id: 'owner-id', type: 'user', name: 'alice', displayName: 'Alice' },
      ],
      updatedBy: 'MemoryReconciliationApplicationBot',
      updatedAt: 1767225600000,
    };

    renderViewOnly(memory);

    const metadata = within(screen.getByTestId('memory-metadata-section'));

    expect(
      await metadata.findByText('Memory Reconciliation Agent')
    ).toBeInTheDocument();
    expect(
      metadata.queryByText('MemoryReconciliationApplicationBot')
    ).not.toBeInTheDocument();
  });

  it('shows the last updater when a memory has no owner', async () => {
    const memory: ContextMemory = {
      id: 'memory-id',
      name: 'legacy-policy',
      updatedBy: 'admin',
      updatedAt: 1767225600000,
    };

    renderViewOnly(memory);

    const metadata = within(screen.getByTestId('memory-metadata-section'));

    expect(await metadata.findByText('Admin User')).toBeInTheDocument();
    expect(metadata.getByText('label.updated-by')).toBeInTheDocument();
    expect(screen.queryByText('label.owner')).not.toBeInTheDocument();
    expect(screen.queryByText('label.created-by')).not.toBeInTheDocument();
  });

  it('shows the last updater when the owner also made the update', async () => {
    const memory: ContextMemory = {
      id: 'memory-id',
      name: 'owned-policy',
      owners: [{ id: 'owner-id', type: 'user', name: 'alice' }],
      updatedBy: 'alice',
      updatedAt: 1767225600000,
    };

    renderViewOnly(memory);

    const metadata = within(screen.getByTestId('memory-metadata-section'));

    expect(await metadata.findByText('Alice Smith')).toBeInTheDocument();
    expect(metadata.getByText('label.updated-by')).toBeInTheDocument();
    expect(screen.getByText('label.owner')).toBeInTheDocument();
  });

  it('keeps the update date when a legacy memory has no updater', () => {
    const memory: ContextMemory = {
      id: 'memory-id',
      name: 'legacy-policy',
      updatedAt: 1767225600000,
    };

    renderViewOnly(memory);

    const metadata = within(screen.getByTestId('memory-metadata-section'));

    expect(metadata.getByText('label.updated')).toBeInTheDocument();
    expect(metadata.getByText('Jan 1, 2026')).toBeInTheDocument();
    expect(metadata.queryByText('label.updated-by')).not.toBeInTheDocument();
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

    renderWithQueryClient(
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
    renderWithQueryClient(
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
        'message.memory-supporting-query-deleted:Monthly expenses'
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

    renderWithQueryClient(
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

    renderWithQueryClient(
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

    renderWithQueryClient(
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
      renderWithQueryClient(
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
    renderWithQueryClient(
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
    renderWithQueryClient(
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

  describe('deciding a memory that awaits approval', () => {
    const awaiting = (entityStatus: ContextMemoryStatus): ContextMemory => ({
      id: 'memory-id',
      name: 'vat-rate',
      title: 'VAT rate',
      entityStatus,
      updatedAt: 1767225600000,
    });

    it.each([ContextMemoryStatus.Unprocessed, ContextMemoryStatus.Draft])(
      'offers an admin Approve and Reject on a %s memory',
      (status) => {
        renderMemory(awaiting(status), { isAdminUser: true });

        expect(screen.getByTestId('memory-approve-btn')).toHaveTextContent(
          'label.approve'
        );
        expect(screen.getByTestId('memory-reject-btn')).toHaveTextContent(
          'label.reject'
        );
      }
    );

    it.each<[string, ContextMemoryStatus, Partial<CreateMemoryModalProps>]>([
      ['an admin', ContextMemoryStatus.Approved, { isAdminUser: true }],
      ['a non-admin', ContextMemoryStatus.Unprocessed, { isAdminUser: false }],
      ['a non-admin', ContextMemoryStatus.Draft, {}],
      [
        'an admin editing',
        ContextMemoryStatus.Unprocessed,
        { isAdminUser: true, viewOnly: false, canEdit: true },
      ],
    ])('offers %s no decision on a %s memory', (_viewer, status, props) => {
      renderMemory(awaiting(status), props);

      expect(screen.getByText('label.cancel')).toBeInTheDocument();
      expect(
        screen.queryByTestId('memory-approve-btn')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('memory-reject-btn')).not.toBeInTheDocument();
    });

    // Its conflict review decides it: approving here would leave both contradicting memories Approved.
    it('offers an admin no decision on a Draft held for disputes', () => {
      renderMemory(
        {
          ...awaiting(ContextMemoryStatus.Draft),
          disputes: [
            {
              memory: { id: 'other-memory', type: 'contextMemory' },
              reason: 'The rates differ',
            },
          ],
        },
        { isAdminUser: true }
      );

      expect(screen.getByText('label.cancel')).toBeInTheDocument();
      expect(
        screen.queryByTestId('memory-approve-btn')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('memory-reject-btn')).not.toBeInTheDocument();
    });

    it.each([
      ['memory-approve-btn', 'Approved'],
      ['memory-reject-btn', 'Rejected'],
    ])(
      '%s moves the memory to %s and hands the update to the parent',
      async (testId, status) => {
        const onUpdated = jest.fn();
        (updateContextMemory as jest.Mock).mockResolvedValue({
          ...awaiting(ContextMemoryStatus.Unprocessed),
          entityStatus: status,
        });
        renderMemory(awaiting(ContextMemoryStatus.Unprocessed), {
          isAdminUser: true,
          onUpdated,
        });

        fireEvent.click(screen.getByTestId(testId));

        await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));

        expect(updateContextMemory).toHaveBeenCalledTimes(1);
        expect(updateContextMemory).toHaveBeenCalledWith('memory-id', [
          { op: 'test', path: '/updatedAt', value: 1767225600000 },
          { op: 'replace', path: '/entityStatus', value: status },
        ]);
        expect(showSuccessToast).toHaveBeenCalledWith(
          'server.entity-updated-success'
        );
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      }
    );

    it.each<[string, string, ContextMemoryStatus]>([
      ['beside Approve', 'secondary', ContextMemoryStatus.Unprocessed],
      ['with nothing to decide', 'primary', ContextMemoryStatus.Approved],
    ])('shows Edit %s as %s', (_case, color, status) => {
      renderMemory(awaiting(status), { isAdminUser: true, canEdit: true });

      expect(jest.mocked(Button)).toHaveBeenCalledWith(
        expect.objectContaining({ children: 'label.edit', color }),
        expect.anything()
      );
    });

    it('reports a refused decision and keeps the memory open', async () => {
      const error = new Error('Draft cannot move to Approved');
      const onUpdated = jest.fn();
      (updateContextMemory as jest.Mock).mockRejectedValue(error);
      (getContextMemoryById as jest.Mock).mockResolvedValue(
        awaiting(ContextMemoryStatus.Draft)
      );
      renderMemory(awaiting(ContextMemoryStatus.Draft), {
        isAdminUser: true,
        onUpdated,
      });

      fireEvent.click(screen.getByTestId('memory-approve-btn'));

      await waitFor(() =>
        expect(screen.getByTestId('memory-approve-btn')).toBeEnabled()
      );

      expect(showErrorToast).toHaveBeenCalledWith(error);
      expect(showSuccessToast).not.toHaveBeenCalled();
      expect(onUpdated).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('says a memory changed since it was opened instead of the patch library’s message', async () => {
      (updateContextMemory as jest.Mock).mockRejectedValue(
        new Error('Test operation failed')
      );
      (getContextMemoryById as jest.Mock).mockResolvedValue({
        ...awaiting(ContextMemoryStatus.Unprocessed),
        updatedAt: 1767225600001,
      });
      renderMemory(awaiting(ContextMemoryStatus.Unprocessed), {
        isAdminUser: true,
      });

      fireEvent.click(screen.getByTestId('memory-approve-btn'));

      await waitFor(() =>
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.memory-changed-since-opened'
        )
      );

      expect(getContextMemoryById).toHaveBeenCalledWith('memory-id');
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('holds both decisions while one is being saved', async () => {
      let finishSave: ((memory: ContextMemory) => void) | undefined;
      (updateContextMemory as jest.Mock).mockReturnValue(
        new Promise<ContextMemory>((resolve) => {
          finishSave = resolve;
        })
      );
      renderMemory(awaiting(ContextMemoryStatus.Unprocessed), {
        isAdminUser: true,
      });

      fireEvent.click(screen.getByTestId('memory-approve-btn'));
      fireEvent.click(screen.getByTestId('memory-reject-btn'));

      expect(screen.getByTestId('memory-approve-btn')).toBeDisabled();
      expect(screen.getByTestId('memory-reject-btn')).toBeDisabled();
      expect(updateContextMemory).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishSave?.(awaiting(ContextMemoryStatus.Approved));
      });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('holds editing, deletion and dismissal while a decision is being saved', async () => {
      let finishSave: ((memory: ContextMemory) => void) | undefined;
      (updateContextMemory as jest.Mock).mockReturnValue(
        new Promise<ContextMemory>((resolve) => {
          finishSave = resolve;
        })
      );
      renderMemory(awaiting(ContextMemoryStatus.Unprocessed), {
        isAdminUser: true,
        canEdit: true,
        canDelete: true,
      });

      fireEvent.click(screen.getByTestId('memory-approve-btn'));

      try {
        expect(screen.getByText('label.edit')).toBeDisabled();
        expect(screen.getByText('label.delete')).toBeDisabled();
        expect(screen.getByText('label.cancel')).toBeDisabled();
        expect(
          screen.queryByTestId('memory-modal-close')
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('label.edit'));
        fireEvent.click(screen.getByText('label.cancel'));

        expect(
          screen.queryByTestId('memory-content-input')
        ).not.toBeInTheDocument();
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      } finally {
        await act(async () => {
          finishSave?.(awaiting(ContextMemoryStatus.Approved));
        });
      }

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['changes identity', false],
      ['unmounts', false],
      ['changes identity after a failed request', true],
    ])(
      'does not notify or close the parent after the originating panel %s',
      async (change, fails) => {
        let finishSave: ((memory: ContextMemory) => void) | undefined;
        (updateContextMemory as jest.Mock).mockReturnValue(
          new Promise<ContextMemory>((resolve, reject) => {
            finishSave = fails
              ? () => reject(new Error('The decision was refused'))
              : resolve;
          })
        );
        (getContextMemoryById as jest.Mock).mockResolvedValue(
          awaiting(ContextMemoryStatus.Unprocessed)
        );
        const onUpdated = jest.fn();
        const panel = renderMemory(awaiting(ContextMemoryStatus.Unprocessed), {
          isAdminUser: true,
          onUpdated,
        });
        fireEvent.click(screen.getByTestId('memory-approve-btn'));

        if (change === 'unmounts') {
          panel.unmount();
        } else {
          panel.rerender(
            <MemoryRouter>
              <CreateMemoryModal
                {...defaultProps}
                isAdminUser
                viewOnly
                memoryToEdit={{
                  ...awaiting(ContextMemoryStatus.Unprocessed),
                  id: 'memory-b',
                }}
                onUpdated={onUpdated}
              />
            </MemoryRouter>
          );
        }
        await act(async () => {
          finishSave?.(awaiting(ContextMemoryStatus.Approved));
        });

        expect(onUpdated).not.toHaveBeenCalled();
        expect(defaultProps.onClose).not.toHaveBeenCalled();
        expect(showSuccessToast).not.toHaveBeenCalled();
        expect(showErrorToast).not.toHaveBeenCalled();
      }
    );
  });
});
