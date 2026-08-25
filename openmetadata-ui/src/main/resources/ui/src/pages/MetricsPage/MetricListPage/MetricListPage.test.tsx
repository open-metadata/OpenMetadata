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
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import {
  EntityStatus,
  Metric,
  MetricGranularity,
  MetricType,
} from '../../../generated/entity/data/metric';
import { useMetricHierarchy } from '../../../hooks/useMetricHierarchy';
import {
  deleteMetricAsync,
  exportMetricDetailsInCSV,
} from '../../../rest/metricsAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityBulkEditPath } from '../../../utils/EntityPureUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import MetricListPage from './MetricListPage';

const mockNavigate = jest.fn();
const mockGetResourcePermission = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => {
  const React = jest.requireActual('react');
  const SelectionContext = React.createContext({
    disabledKeys: new Set<string>(),
    selectedKeys: new Set<string>(),
    onRowAction: undefined as ((id: string) => void) | undefined,
    onSelectionChange: (_selection: Set<string>) => undefined,
  });
  const MenuContext = React.createContext(undefined) as React.Context<
    ((id: string) => void) | undefined
  >;
  const ButtonGroupContext = React.createContext(undefined) as React.Context<
    ((selection: Set<string>) => void) | undefined
  >;

  const Box = ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => {
    const {
      align: _align,
      direction: _direction,
      gap: _gap,
      justify: _justify,
      ...domProps
    } = props as Record<string, unknown>;

    return <div {...domProps}>{children}</div>;
  };
  const Button = ({
    children,
    isDisabled,
    isLoading,
    onPress,
    iconLeading: _iconLeading,
    iconTrailing: _iconTrailing,
    color: _color,
    ...props
  }: Record<string, unknown>) => (
    <button
      {...props}
      disabled={Boolean(isDisabled || isLoading)}
      onClick={onPress as React.MouseEventHandler<HTMLButtonElement>}>
      {children as React.ReactNode}
    </button>
  );
  const Card = ({
    children,
    isSelected,
    ...props
  }: Record<string, unknown>) => (
    <section data-selected={Boolean(isSelected)} {...props}>
      {children as React.ReactNode}
    </section>
  );
  Card.Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Card.Header = ({ title }: { title: string }) => <h2>{title}</h2>;
  Card.Footer = ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  );

  const Table = ({
    children,
    disabledKeys = [],
    selectedKeys = new Set(),
    onRowAction,
    onSelectionChange,
    'aria-label': ariaLabel,
  }: Record<string, unknown>) => (
    <SelectionContext.Provider
      value={{
        disabledKeys: new Set(disabledKeys as string[]),
        selectedKeys: selectedKeys as Set<string>,
        onRowAction: onRowAction as ((id: string) => void) | undefined,
        onSelectionChange: onSelectionChange as (
          selection: Set<string>
        ) => void,
      }}>
      <table aria-label={ariaLabel as string} data-testid="core-metric-table">
        {children as React.ReactNode}
      </table>
    </SelectionContext.Provider>
  );
  Table.Header = ({ children }: { children: React.ReactNode }) => (
    <thead>
      <tr>
        <th aria-label="selection" />
        {children}
      </tr>
    </thead>
  );
  Table.Head = ({
    children,
    label,
    ...props
  }: React.ThHTMLAttributes<HTMLTableCellElement> & { label?: string }) => (
    <th data-uses-label={Boolean(label)} {...props}>
      {label ?? children}
    </th>
  );
  Table.Body = ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  );
  const TableRow = ({
    children,
    hideSelectionCell,
    id,
    ...props
  }: {
    children: React.ReactNode;
    hideSelectionCell?: boolean;
    id: string;
  } & React.HTMLAttributes<HTMLTableRowElement>) => {
    const selection = React.useContext(SelectionContext);
    const isDisabled = selection.disabledKeys.has(id);
    const isSelected = selection.selectedKeys.has(id);

    return (
      <tr {...props}>
        {!hideSelectionCell && (
          <td>
            <button
              data-testid={`open-${id}`}
              disabled={isDisabled}
              onClick={() => selection.onRowAction?.(id)}>
              open
            </button>
            <button
              aria-pressed={isSelected}
              data-testid={`select-${id}`}
              disabled={isDisabled}
              onClick={() => {
                const next = new Set(selection.selectedKeys);
                isSelected ? next.delete(id) : next.add(id);
                selection.onSelectionChange(next);
              }}>
              select
            </button>
          </td>
        )}
        {children}
      </tr>
    );
  };
  Table.Row = TableRow;
  Table.Cell = ({
    children,
    ...props
  }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td {...props}>{children}</td>
  );

  const Dialog = ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div aria-label={title} role="dialog">
      {children}
    </div>
  );
  Dialog.Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Dialog.Footer = ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  );

  const Menu = ({ children, onAction }: Record<string, unknown>) => (
    <MenuContext.Provider value={onAction as (id: string) => void}>
      <div>{children as React.ReactNode}</div>
    </MenuContext.Provider>
  );
  const MenuItem = ({ id, label, isDisabled }: Record<string, unknown>) => {
    const onAction = React.useContext(MenuContext);

    return (
      <button
        data-testid={`menu-item-${id}`}
        disabled={Boolean(isDisabled)}
        onClick={() => onAction?.(String(id))}>
        {label as string}
      </button>
    );
  };

  return {
    Avatar: ({ initials, size }: { initials: string; size: string }) => (
      <span data-avatar-size={size}>{initials}</span>
    ),
    Badge: ({
      children,
      className,
      color,
      size,
    }: {
      children: React.ReactNode;
      className?: string;
      color?: string;
      size?: string;
    }) => (
      <span
        className={className}
        data-badge-color={color}
        data-badge-size={size}>
        {children}
      </span>
    ),
    Box,
    Breadcrumbs: ({ items }: { items: Array<{ label: string }> }) => (
      <nav>{items.map(({ label }) => label).join(' / ')}</nav>
    ),
    Button,
    ButtonGroup: ({
      children,
      onSelectionChange,
      ...props
    }: Record<string, unknown>) => (
      <ButtonGroupContext.Provider
        value={onSelectionChange as (selection: Set<string>) => void}>
        <div {...props} role="group">
          {children as React.ReactNode}
        </div>
      </ButtonGroupContext.Provider>
    ),
    ButtonGroupItem: ({ id, ...props }: Record<string, unknown>) => {
      const onSelectionChange = React.useContext(ButtonGroupContext);

      return (
        <button {...props} onClick={() => onSelectionChange?.(new Set([id]))} />
      );
    },
    Card,
    Checkbox: ({
      'aria-label': ariaLabel,
      isSelected,
      onChange,
    }: Record<string, unknown>) => (
      <button
        aria-checked={Boolean(isSelected)}
        aria-label={ariaLabel as string}
        role="checkbox"
        onClick={() =>
          (onChange as ((selected: boolean) => void) | undefined)?.(!isSelected)
        }
      />
    ),
    Dialog,
    Dropdown: {
      Root: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      DotsButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props} />
      ),
      Popover: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Menu,
      Item: MenuItem,
    },
    EmptyPlaceholder: ({
      title,
      description,
    }: {
      title: string;
      description: string;
    }) => (
      <div data-testid="metric-empty-placeholder">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    ),
    Input: ({
      onChange,
      ...props
    }: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input aria-label="Search" {...props} onChange={onChange} />
    ),
    Modal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ModalOverlay: ({
      children,
      isOpen,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
    }) => (isOpen ? <>{children}</> : null),
    Skeleton: () => <div data-testid="skeleton" />,
    Table,
    FeaturedIcon: ({
      children,
      'data-testid': dataTestId,
    }: {
      children: React.ReactNode;
      'data-testid'?: string;
    }) => <span data-testid={dataTestId}>{children}</span>,
    Typography: ({
      as: Component = 'span',
      children,
      size,
      weight,
      ...props
    }: {
      as?: React.ElementType;
      children: React.ReactNode;
      size?: string;
      weight?: string;
    } & React.HTMLAttributes<HTMLElement>) => (
      <Component data-size={size} data-weight={weight} {...props}>
        {children}
      </Component>
    ),
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../../hooks/useMetricHierarchy');
jest.mock('../../../rest/searchAPI');
jest.mock('../../../rest/metricsAPI', () => ({
  deleteMetricAsync: jest.fn(),
  exportMetricDetailsInCSV: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
}));
jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock(
  '../../../components/Metric/MetricListHealth/MetricListHealth.component',
  () => ({
    __esModule: true,
    default: ({ metricId }: { metricId: string }) => (
      <span data-testid={`metric-health-${metricId}`}>Healthy</span>
    ),
  })
);

const mockUseMetricHierarchy = useMetricHierarchy as jest.Mock;
const mockSearchQuery = searchQuery as jest.Mock;
const mockDeleteMetric = deleteMetricAsync as jest.Mock;
const mockExportMetrics = exportMetricDetailsInCSV as jest.Mock;

const rootMetric: Metric = {
  id: 'metric-1',
  name: 'net_sales',
  fullyQualifiedName: 'net_sales',
  description: 'Net sales after returns',
  childrenCount: 2,
  entityStatus: EntityStatus.Approved,
  owners: [{ id: 'owner-1', name: 'alice', type: 'user' }],
};

const hierarchyActions = {
  toggleExpand: jest.fn(),
  toggleGroup: jest.fn(),
  loadMoreChildren: jest.fn(),
  loadMoreGroupMembers: jest.fn(),
  expandAll: jest.fn(),
  collapseAll: jest.fn(),
  reset: jest.fn(),
  refetch: jest.fn(),
};

const setHierarchy = ({
  rows = [rootMetric],
  total = rows.length,
  topLevelNodes = [{ row: rootMetric }],
  error,
  isPending = false,
  collapsedGroupIds = [],
}: {
  rows?: unknown[];
  total?: number;
  topLevelNodes?: unknown[];
  error?: Error;
  isPending?: boolean;
  collapsedGroupIds?: string[];
} = {}) => {
  mockUseMetricHierarchy.mockImplementation(() => ({
    topLevelNodes,
    buildRows: () => rows,
    paging: { total, offset: 0, limit: 20 },
    isPending,
    isFetching: isPending,
    error,
    expandedRowKeys: [],
    collapsedGroupIds,
    loadingParentIds: [],
    loadingGroupIds: [],
    ...hierarchyActions,
  }));
};

const buildSearchResponse = (metrics: Metric[], total = metrics.length) => ({
  hits: {
    hits: metrics.map((metric) => ({ _source: metric })),
    total: { value: total },
  },
});

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MetricListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    mockGetResourcePermission.mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
      Create: true,
      Delete: true,
      EditAll: true,
    });
    mockSearchQuery.mockResolvedValue(buildSearchResponse([]));
    mockDeleteMetric.mockResolvedValue({});
    mockExportMetrics.mockResolvedValue({});
    setHierarchy();
  });

  it('renders the accessible core table with hierarchy, status, health, and no excluded content', async () => {
    renderPage();

    expect(
      await screen.findByRole('table', { name: 'label.metric-plural' })
    ).toBeInTheDocument();
    expect(screen.getByText('net_sales')).toBeInTheDocument();
    expect(screen.getByTestId('metric-health-metric-1')).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'label.approved' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'label.metric' })
    ).toHaveAttribute('data-uses-label', 'true');
    expect(
      screen.getByRole('columnheader', {
        name: 'label.glossary-term-plural',
      })
    ).toHaveAttribute('data-uses-label', 'true');
    expect(screen.getByText('AL')).toHaveAttribute('data-avatar-size', 'xs');
    expect(screen.getByTestId('metric-icon-metric-1')).toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/value trend/i)).not.toBeInTheDocument();
  });

  it('renders metric type colors and uppercase mono granularity consistently', async () => {
    const styledMetric = {
      ...rootMetric,
      childrenCount: 0,
      granularity: MetricGranularity.Day,
      metricType: MetricType.Sum,
    };
    setHierarchy({
      rows: [styledMetric],
      topLevelNodes: [{ row: styledMetric }],
    });

    renderPage();

    expect(await screen.findByText('label.sum')).toHaveAttribute(
      'data-badge-color',
      'blue'
    );
    expect(screen.getByText('label.sum')).toHaveAttribute(
      'data-badge-size',
      'xs'
    );
    expect(screen.getByText('label.sum')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide'
    );
    expect(screen.getByText('label.day')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide',
      'tw:text-xs',
      'tw:font-semibold'
    );
  });

  it('matches the prototype page heading and single-line toolbar structure', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'label.metric-plural',
    });

    expect(heading).toHaveAttribute('data-size', 'text-xl');
    expect(heading).toHaveAttribute('data-weight', 'bold');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-search')).toHaveClass('tw:sm:max-w-84');
    expect(screen.getByTestId('metric-list-toolbar')).toHaveClass(
      'tw:sm:flex-row'
    );
  });

  it('navigates through the metric row action while keeping checkbox selection separate', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', { name: 'net_sales' })
    ).toHaveAttribute('href', '/metric/net_sales');

    fireEvent.click(screen.getByTestId('open-metric-1'));

    expect(mockNavigate).toHaveBeenCalledWith('/metric/net_sales');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('select-metric-1'));

    expect(screen.getByText(/1 label.selected-lowercase/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows loading, empty, no-permission, and retryable error states', async () => {
    let resolvePermission: (value: unknown) => void = (_value) => undefined;
    mockGetResourcePermission.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      })
    );
    const first = renderPage();

    expect(screen.getByTestId('metric-list-loading')).toBeInTheDocument();

    resolvePermission({ ViewAll: true, Create: true });
    await screen.findByText('net_sales');
    first.unmount();

    setHierarchy({ rows: [], total: 0, topLevelNodes: [] });
    const empty = renderPage();

    expect(
      await screen.findByTestId('metric-empty-placeholder')
    ).toHaveTextContent('message.metric-empty-state-title');

    empty.unmount();

    mockGetResourcePermission.mockResolvedValueOnce({});
    const denied = renderPage();

    expect(
      await screen.findByText('message.no-permission-to-view')
    ).toBeInTheDocument();

    denied.unmount();

    mockGetResourcePermission.mockRejectedValue(new Error('permission boom'));
    renderPage();

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    const callsBeforeRetry = mockGetResourcePermission.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));
    await waitFor(() =>
      expect(mockGetResourcePermission).toHaveBeenCalledTimes(
        callsBeforeRetry + 1
      )
    );

    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('switches and persists card/table mode and defaults narrow screens to cards', async () => {
    const first = renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByTestId('metric-card-view-button'));

    expect(await screen.findByTestId('metric-card-view')).toBeInTheDocument();
    expect(localStorage.getItem('metricsList.viewMode.v1')).toBe('card');

    first.unmount();

    const persisted = renderPage();

    expect(await screen.findByTestId('metric-card-view')).toBeInTheDocument();

    persisted.unmount();

    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    renderPage();

    expect(await screen.findByTestId('metric-card-view')).toBeInTheDocument();
  });

  it('keeps group context when hierarchy search matches a group or descendant', async () => {
    const groupRow = {
      id: 'group:group-1',
      isGroupRow: true,
      group: {
        id: 'group-1',
        name: 'profitability',
        displayName: 'Profitability',
      },
      memberCount: 1,
    };
    const descendant = {
      id: 'child-1',
      name: 'net_sales_emea',
      fullyQualifiedName: 'net_sales.net_sales_emea',
      parent: { id: 'metric-1', type: 'metric' },
      metricGroup: { id: 'group-1', type: 'metricGroup' },
    };
    mockUseMetricHierarchy.mockImplementation(
      ({ query }: { query?: string }) => {
        const isMatchingHierarchy = Boolean(query);
        const topLevelNodes = isMatchingHierarchy
          ? [{ row: groupRow, groupId: 'group-1', members: [descendant] }]
          : [{ row: rootMetric }];

        return {
          topLevelNodes,
          buildRows: () =>
            isMatchingHierarchy ? [groupRow, descendant] : [rootMetric],
          paging: { total: 1, offset: 0, limit: 20 },
          isPending: false,
          isFetching: false,
          expandedRowKeys: [],
          collapsedGroupIds: [],
          loadingParentIds: [],
          loadingGroupIds: [],
          ...hierarchyActions,
        };
      }
    );
    renderPage();
    const input = await screen.findByTestId('metric-search');
    fireEvent.change(input, { target: { value: 'profitability' } });

    expect(
      await screen.findByText('net_sales_emea', {}, { timeout: 2000 })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-group-profitability')
    ).toBeInTheDocument();
    expect(mockUseMetricHierarchy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        page: 1,
        query: 'profitability',
      })
    );

    fireEvent.change(input, { target: { value: 'emea' } });

    await waitFor(() =>
      expect(mockUseMetricHierarchy).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: 'emea' })
      )
    );

    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('offers and applies every metric status through server-side filtering', async () => {
    mockSearchQuery.mockResolvedValue(
      buildSearchResponse([
        {
          id: 'rejected-1',
          name: 'rejected_metric',
          fullyQualifiedName: 'rejected_metric',
          entityStatus: EntityStatus.Rejected,
        },
      ])
    );
    renderPage();
    await screen.findByText('net_sales');

    for (const status of Object.values(EntityStatus)) {
      expect(screen.getByTestId(`menu-item-${status}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByTestId(`menu-item-${EntityStatus.Rejected}`));

    expect(await screen.findByText('rejected_metric')).toBeInTheDocument();
    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryFilter: getTermQuery({ entityStatus: EntityStatus.Rejected }),
      })
    );
  });

  it('renders full-width group banners, variant controls, and group paging', async () => {
    const groupRow = {
      id: 'group:group-1',
      isGroupRow: true,
      group: {
        id: 'group-1',
        name: 'profitability',
        displayName: 'Profitability',
        description: 'Margin, profit, and revenue-quality metrics',
      },
      memberCount: 3,
    };
    const groupedMetric = {
      ...rootMetric,
      metricGroup: { id: 'group-1', type: 'metricGroup' },
    };
    const loadMoreRow = {
      id: 'load-more:group:group-1',
      isLoadMoreRow: true,
      scope: 'group',
      parentId: 'group-1',
      parentFqn: '',
      remaining: 2,
    };
    setHierarchy({
      rows: [groupRow, groupedMetric, loadMoreRow],
      total: 1,
      topLevelNodes: [
        { row: groupRow, groupId: 'group-1', members: [groupedMetric] },
      ],
    });
    renderPage();

    const groupToggle = await screen.findByTestId('metric-group-profitability');
    const groupRowElement = groupToggle.closest('tr');
    const groupCell = groupToggle.closest('td');

    expect(groupRowElement).toHaveAttribute(
      'data-testid',
      'metric-group-row-group-1'
    );
    expect(groupRowElement?.querySelectorAll('td')).toHaveLength(1);
    expect(groupCell).toHaveAttribute('colspan', '7');
    expect(groupCell).toHaveTextContent(
      'Margin, profit, and revenue-quality metrics'
    );
    expect(
      screen.queryByTestId('select-group:group-1')
    ).not.toBeInTheDocument();

    fireEvent.click(groupToggle);

    expect(hierarchyActions.toggleGroup).toHaveBeenCalledWith('group:group-1');

    fireEvent.click(screen.getByTestId('expand-metric-1'));

    expect(hierarchyActions.toggleExpand).toHaveBeenCalledWith(
      true,
      groupedMetric
    );

    fireEvent.click(screen.getByTestId('load-more-group-group-1'));

    expect(hierarchyActions.loadMoreGroupMembers).toHaveBeenCalledWith(
      'group-1'
    );

    expect(
      screen.queryByTestId('add-variant-metric-1')
    ).not.toBeInTheDocument();
  });

  it('expands group banners once by default without expanding metric variants or overriding collapse', async () => {
    const groupRow = {
      id: 'group:group-1',
      isGroupRow: true,
      group: {
        id: 'group-1',
        name: 'profitability',
        displayName: 'Profitability',
      },
      memberCount: 1,
    };
    const groupedMetric = {
      ...rootMetric,
      metricGroup: { id: 'group-1', type: 'metricGroup' },
    };
    setHierarchy({
      rows: [groupRow, groupedMetric],
      total: 1,
      topLevelNodes: [
        { row: groupRow, groupId: 'group-1', members: [groupedMetric] },
      ],
    });
    renderPage();

    await waitFor(() =>
      expect(hierarchyActions.expandAll).toHaveBeenCalledTimes(1)
    );

    const cardViewButton = await screen.findByTestId('metric-card-view-button');

    expect(hierarchyActions.toggleExpand).not.toHaveBeenCalled();
    expect(screen.getByTestId('expand-metric-1')).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    fireEvent.click(screen.getByTestId('metric-group-profitability'));

    expect(hierarchyActions.toggleGroup).toHaveBeenCalledWith('group:group-1');

    setHierarchy({
      collapsedGroupIds: ['group:group-1'],
      rows: [groupRow],
      total: 1,
      topLevelNodes: [
        { row: groupRow, groupId: 'group-1', members: [groupedMetric] },
      ],
    });
    fireEvent.click(cardViewButton);

    expect(hierarchyActions.expandAll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('metric-group-profitability')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('does not mount health queries for roots hidden inside collapsed groups', async () => {
    const groupRow = {
      id: 'group:group-1',
      isGroupRow: true,
      group: {
        id: 'group-1',
        name: 'profitability',
        displayName: 'Profitability',
      },
      memberCount: 1,
    };
    setHierarchy({
      collapsedGroupIds: [groupRow.id],
      rows: [groupRow],
      total: 1,
      topLevelNodes: [{ row: groupRow, groupId: 'group-1' }],
    });

    renderPage();

    expect(
      await screen.findByTestId('metric-group-profitability')
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('metric-health-metric-1')
    ).not.toBeInTheDocument();
  });

  it('persists customizable columns', async () => {
    renderPage();
    await screen.findByText('net_sales');
    fireEvent.click(screen.getByRole('button', { name: 'label.health' }));

    expect(
      JSON.parse(localStorage.getItem('metricsList.columnPrefs.v2') ?? '[]')
    ).not.toContain('health');
  });

  it('uses normal top-level pagination and clears selection between pages', async () => {
    setHierarchy({ total: 41 });
    renderPage();
    fireEvent.click(await screen.findByTestId('select-metric-1'));

    expect(screen.getByText(/1 label.selected-lowercase/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('metric-page-next'));

    await waitFor(() =>
      expect(mockUseMetricHierarchy).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20, query: '' })
      )
    );

    expect(
      screen.queryByText(/1 label.selected-lowercase/)
    ).not.toBeInTheDocument();
  });

  it('prunes hidden child selections when their group is collapsed', async () => {
    const groupRow = {
      id: 'group:group-1',
      isGroupRow: true,
      group: { id: 'group-1', name: 'profitability' },
      memberCount: 2,
    };
    const child = {
      id: 'child-1',
      name: 'emea_margin',
      fullyQualifiedName: 'emea_margin',
    };
    const parent = {
      ...rootMetric,
      metricGroup: { id: 'group-1', type: 'metricGroup' },
      children: [child],
    };
    setHierarchy({
      rows: [groupRow, parent],
      total: 1,
      topLevelNodes: [{ row: groupRow, groupId: 'group-1', members: [parent] }],
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('select-child-1'));

    expect(screen.getByText(/1 label.selected-lowercase/)).toBeInTheDocument();

    setHierarchy({
      rows: [groupRow],
      total: 1,
      topLevelNodes: [{ row: groupRow, groupId: 'group-1', members: [] }],
      collapsedGroupIds: ['group:group-1'],
    });
    fireEvent.click(screen.getByTestId('metric-card-view-button'));

    await waitFor(() =>
      expect(
        screen.queryByText(/1 label.selected-lowercase/)
      ).not.toBeInTheDocument()
    );

    expect(screen.queryByTestId('bulk-delete-metric')).not.toBeInTheDocument();
  });

  it('passes filtered and selected scopes to bulk edit', async () => {
    const filtered = renderPage();
    const input = await screen.findByTestId('metric-search');
    fireEvent.change(input, { target: { value: 'sales' } });
    fireEvent.click(screen.getByTestId('bulk-edit-metric'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      getEntityBulkEditPath(EntityType.METRIC, '*'),
      {
        state: {
          metricBulkEditScope: {
            mode: 'filtered',
            filters: { searchText: 'sales', statusFilter: undefined },
          },
        },
      }
    );

    filtered.unmount();

    renderPage();
    fireEvent.click(await screen.findByTestId('select-metric-1'));
    fireEvent.click(screen.getByTestId('bulk-edit-metric'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      getEntityBulkEditPath(EntityType.METRIC, '*'),
      expect.objectContaining({
        state: expect.objectContaining({
          metricBulkEditScope: expect.objectContaining({
            mode: 'selected',
            metricIds: ['metric-1'],
            metricNames: ['net_sales'],
          }),
        }),
      })
    );
  });

  it('confirms bulk deletion, refreshes hierarchy, and exposes mutation progress', async () => {
    let resolveDelete: () => void = () => undefined;
    mockDeleteMetric.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('select-metric-1'));
    fireEvent.click(screen.getByTestId('bulk-delete-metric'));
    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(screen.getByTestId('confirm-button')).toBeDisabled();
    expect(mockDeleteMetric).toHaveBeenCalledWith('metric-1');

    resolveDelete();
    await waitFor(() => expect(hierarchyActions.reset).toHaveBeenCalled());

    expect(mockShowSuccessToast).toHaveBeenCalled();
  });

  it('exports metrics from the core action menu', async () => {
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    renderPage();
    fireEvent.click(await screen.findByTestId('menu-item-export'));

    await waitFor(() => expect(mockExportMetrics).toHaveBeenCalledWith('*'));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'csv-jobs-refresh' })
    );

    dispatchSpy.mockRestore();
  });
});
