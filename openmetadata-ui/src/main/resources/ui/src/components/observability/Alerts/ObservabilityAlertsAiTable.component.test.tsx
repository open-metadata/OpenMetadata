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
import { ReactNode } from 'react';
import { PAGE_SIZE_BASE } from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { CursorType } from '../../../enums/pagination.enum';
import {
  EventSubscription,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import {
  AlertTableColumn,
  ALERT_TABLE_COLUMN_IDS,
} from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.constants';
import { AlertPermission } from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.interface';
import ObservabilityAlertsAiTable from './ObservabilityAlertsAiTable.component';

interface MockButtonProps {
  children?: ReactNode;
  'data-testid'?: string;
  isDisabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onPress?: () => void;
}

interface MockFeature {
  description?: ReactNode;
  key: string;
  title?: ReactNode;
}

interface MockAction {
  key: string;
  label: ReactNode;
  onPress?: () => void;
}

interface MockPaginationProps {
  className?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  page: number;
  total: number;
}

interface MockTableBodyProps<T> {
  children: (item: T) => ReactNode;
  items: T[];
  renderEmptyState: () => ReactNode;
}

jest.mock('@openmetadata/ui-core-components', () => {
  const Table = ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>;

  Table.Header = ({
    children,
    columns,
  }: {
    children: (column: AlertTableColumn) => ReactNode;
    columns: AlertTableColumn[];
  }) => <div>{columns.map((column) => children(column))}</div>;
  Table.Head = ({
    className,
    id,
    label,
  }: {
    className?: string;
    id: string;
    label: string;
  }) => (
    <div className={className} data-testid={`header-${id}`}>
      {label}
    </div>
  );
  Table.Body = <T,>({
    children,
    items,
    renderEmptyState,
  }: MockTableBodyProps<T>) => (
    <div>
      {items.length
        ? items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- test mock over generic items, no stable id
            <div key={index}>{children(item)}</div>
          ))
        : renderEmptyState()}
    </div>
  );
  Table.Row = ({ children, id }: { children?: ReactNode; id?: string }) => (
    <div data-testid={`table-row-${id}`}>{children}</div>
  );
  Table.Cell = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="table-cell">
      {children}
    </div>
  );

  return {
    Box: ({
      children,
      ...rest
    }: { children?: ReactNode } & Record<string, unknown>) => (
      <div {...rest}>{children}</div>
    ),
    Button: ({ children, 'data-testid': testId, onPress }: MockButtonProps) => (
      <button data-testid={testId} onClick={onPress}>
        {children}
      </button>
    ),
    ButtonUtility: ({
      children,
      'data-testid': testId,
      isDisabled,
      onClick,
    }: MockButtonProps) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
        {children}
      </button>
    ),
    EmptyPlaceholder: ({
      actions,
      description,
      features,
      title,
    }: {
      actions?: MockAction[];
      description?: ReactNode;
      features?: MockFeature[];
      title?: ReactNode;
    }) => (
      <div data-testid="empty-placeholder">
        <span>{title}</span>
        <span>{description}</span>
        {features?.map((feature) => (
          <div key={feature.key}>
            <span>{feature.title}</span>
            <span>{feature.description}</span>
          </div>
        ))}
        {actions?.map((action) => (
          <button key={action.key} onClick={action.onPress}>
            {action.label}
          </button>
        ))}
      </div>
    ),
    PaginationCardWithControls: ({
      className,
      onPageChange,
      onPageSizeChange,
      page,
      total,
    }: MockPaginationProps) => (
      <div className={className} data-testid="pagination">
        <span data-testid="pagination-total">{total}</span>
        <button data-testid="next-page" onClick={() => onPageChange(page + 1)}>
          next
        </button>
        <button
          data-testid="previous-page"
          onClick={() => onPageChange(page - 1)}>
          previous
        </button>
        <button
          data-testid="change-page-size"
          onClick={() => onPageSizeChange(PAGE_SIZE_BASE * 2)}>
          page size
        </button>
      </div>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    Table,
    TableCard: {
      Root: ({ children }: { children?: ReactNode }) => (
        <div data-testid="table-card">{children}</div>
      ),
    },
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('@untitledui/icons', () => ({
  AlertTriangle: () => null,
  Bell01: () => null,
  Edit03: () => null,
  MarkerPin01: () => null,
  Plus: () => null,
  Trash01: () => null,
  ZapFast: () => null,
}));

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewNew',
  () => ({
    __esModule: true,
    default: ({ markdown }: { markdown: string }) => (
      <span data-testid="description-preview">{markdown}</span>
    ),
  })
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.entity ? `${key}:${params.entity}` : key,
  }),
}));

jest.mock('react-router-dom', () => ({
  Link: ({
    children,
    className,
    'data-testid': testId,
    title,
    to,
  }: {
    children?: ReactNode;
    className?: string;
    'data-testid'?: string;
    title?: string;
    to: string;
  }) => (
    <a className={className} data-testid={testId} href={to} title={title}>
      {children}
    </a>
  ),
}));

const columnList: AlertTableColumn[] = [
  { id: ALERT_TABLE_COLUMN_IDS.NAME, name: 'Name' },
  { id: ALERT_TABLE_COLUMN_IDS.TRIGGER, name: 'Source' },
  { id: ALERT_TABLE_COLUMN_IDS.DESCRIPTION, name: 'Description' },
  { id: ALERT_TABLE_COLUMN_IDS.ACTIONS, name: 'Actions' },
];

const alertRecord: EventSubscription = {
  description: 'Alert description',
  filteringRules: {
    resources: ['table'],
  },
  fullyQualifiedName: 'service.alert',
  id: 'alert-id',
  name: 'test-alert',
} as EventSubscription;

const alertPermissions: AlertPermission[] = [
  {
    delete: true,
    edit: true,
    id: 'alert-id',
  } as AlertPermission,
];

const baseProps = {
  alertPermissions,
  alertResourcePermission: { Create: true } as OperationPermission,
  alerts: [alertRecord],
  columnList,
  currentPage: 1,
  getAlertDetailsPath: jest.fn((fqn: string) => `/alerts/${fqn}`),
  loading: false,
  loadingCount: 0,
  onAddAlert: jest.fn(),
  onEditAlert: jest.fn(),
  onPageChange: jest.fn(),
  onPageSizeChange: jest.fn(),
  onSelectAlert: jest.fn(),
  pageSize: PAGE_SIZE_BASE,
  paging: { total: 30 },
  showPagination: true,
};

describe('ObservabilityAlertsAiTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders alert rows with link navigation and actions', () => {
    render(<ObservabilityAlertsAiTable {...baseProps} />);

    const alertLink = screen.getByTestId('alert-name');

    expect(alertLink).toHaveAttribute('href', '/alerts/service.alert');
    expect(alertLink).toHaveTextContent('test-alert');
    expect(screen.getByText('table')).toBeInTheDocument();
    expect(screen.getByTestId('description-preview')).toHaveTextContent(
      'Alert description'
    );

    fireEvent.click(screen.getByTestId('alert-edit-test-alert'));
    fireEvent.click(screen.getByTestId('alert-delete-test-alert'));

    expect(baseProps.onEditAlert).toHaveBeenCalledWith(alertRecord);
    expect(baseProps.onSelectAlert).toHaveBeenCalledWith(alertRecord);
  });

  it('truncates long alert names and exposes the full value as a title', () => {
    const longName = 'alert-name-that-is-longer-than-the-name-column';

    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        alerts={[{ ...alertRecord, displayName: longName }]}
      />
    );

    expect(screen.getByTestId('alert-name')).toHaveClass('tw:truncate');
    expect(screen.getByTestId('alert-name')).toHaveAttribute('title', longName);
    expect(screen.getByTestId('alert-name').parentElement).toHaveClass(
      'tw:w-[30%]!',
      'tw:max-w-0'
    );
  });

  it('uses view callback instead of link when provided', () => {
    const onViewAlert = jest.fn();

    render(
      <ObservabilityAlertsAiTable {...baseProps} onViewAlert={onViewAlert} />
    );

    fireEvent.click(screen.getByTestId('alert-name'));

    expect(onViewAlert).toHaveBeenCalledWith(alertRecord);
  });

  it('disables delete action for system alerts', () => {
    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        alerts={[{ ...alertRecord, provider: ProviderType.System }]}
      />
    );

    expect(screen.getByTestId('alert-delete-test-alert')).toBeDisabled();
  });

  it('renders the features EmptyPlaceholder when there are no alerts', () => {
    render(<ObservabilityAlertsAiTable {...baseProps} alerts={[]} />);

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('message.observability-alert-empty-heading')
    ).toBeInTheDocument();
    expect(screen.getByText('label.pick-a-trigger')).toBeInTheDocument();
    expect(
      screen.getByText('label.choose-the-destination')
    ).toBeInTheDocument();
    expect(screen.getByText('label.stay-ahead')).toBeInTheDocument();
  });

  it('renders the new-alert action when the user has create permission and invokes onAddAlert on click', () => {
    render(<ObservabilityAlertsAiTable {...baseProps} alerts={[]} />);

    fireEvent.click(screen.getByText('label.new-entity:label.alert'));

    expect(baseProps.onAddAlert).toHaveBeenCalledTimes(1);
  });

  it('does not render the new-alert action when the user lacks create permission', () => {
    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        alertResourcePermission={
          { Create: false, All: false } as OperationPermission
        }
        alerts={[]}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.queryByText('label.new-entity:label.alert')
    ).not.toBeInTheDocument();
  });

  it('does not render the new-alert action when the resource permission is unknown (fails closed)', () => {
    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        alertResourcePermission={undefined}
        alerts={[]}
        loadingCount={0}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.queryByText('label.new-entity:label.alert')
    ).not.toBeInTheDocument();
  });

  it('renders an error + retry state when the resource-permission fetch failed', () => {
    const onRetryPermission = jest.fn();
    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        hasResourcePermissionError
        alerts={[]}
        onRetryPermission={onRetryPermission}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('label.new-entity:label.alert')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.try-again'));

    expect(onRetryPermission).toHaveBeenCalledTimes(1);
  });

  it('maps pagination changes to cursor params', () => {
    render(
      <ObservabilityAlertsAiTable
        {...baseProps}
        paging={{ after: 'next-cursor', total: 30 }}
      />
    );

    fireEvent.click(screen.getByTestId('next-page'));
    fireEvent.click(screen.getByTestId('previous-page'));
    fireEvent.click(screen.getByTestId('change-page-size'));

    expect(baseProps.onPageChange).toHaveBeenNthCalledWith(1, {
      cursorType: CursorType.AFTER,
      currentPage: 2,
    });
    expect(baseProps.onPageChange).toHaveBeenNthCalledWith(2, {
      cursorType: CursorType.BEFORE,
      currentPage: 0,
    });
    expect(baseProps.onPageSizeChange).toHaveBeenCalledWith(PAGE_SIZE_BASE * 2);
  });

  it('removes the nested pagination border from the alerts table card', () => {
    render(<ObservabilityAlertsAiTable {...baseProps} />);

    expect(screen.getByTestId('pagination')).toHaveClass('tw:border-0!');
  });

  it('shows skeleton actions while permissions are loading', () => {
    render(<ObservabilityAlertsAiTable {...baseProps} loadingCount={1} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
