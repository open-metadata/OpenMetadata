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
import { ALL_SERVICES_CATEGORY } from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { EXTENSION_POINTS } from '../../../utils/ExtensionPointTypes';
import ConnectionsListView, {
  NAME_COLUMN_WIDTH,
  SECONDARY_COLUMN_WIDTH,
} from './ConnectionsListView';
import {
  GRID_PAGE_SIZE_OPTIONS,
  LIST_PAGE_SIZE_OPTIONS,
} from './ConnectionsPage.constants';
import { ConnectionsCategory } from './useConnectionsData';

const mockNavigate = jest.fn();
const mockGetServiceDetailsPath = jest
  .fn()
  .mockReturnValue('/connections/databaseServices/mysql');
const mockGetAddServicePath = jest
  .fn()
  .mockImplementation((category: string) => `/${category}/add-service`);
const mockCheckPermission = jest.fn().mockReturnValue(true);
let mockPermissions: Record<string, unknown> = { all: { Create: true } };
const mockSetPage = jest.fn();
const mockSetPageSize = jest.fn();
const mockToggleSortOrder = jest.fn();
const mockOnCategoryChange = jest.fn();
const mockUseConnectionsData = jest.fn();
const mockServiceConnectionCard = jest.fn();
const mockGetContributions = jest.fn().mockReturnValue([]);

// The connector and health selections live in the URL, so the tests drive them by seeding it.
let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@untitledui/icons', () => {
  const Icon = () => <svg />;

  // A Proxy rather than a fixed list: the nav rail and the empty-state config each pull their own
  // set of glyphs, and a name missing from the mock would render `undefined` instead of failing.
  return new Proxy({}, { get: () => Icon });
});

jest.mock('@openmetadata/ui-core-components', () => {
  let sortHandler: ((descriptor: { direction: string }) => void) | undefined;
  let sortDirection = 'ascending';

  // Forwards className because the column sizing lives there. The previous mock dropped it, so a
  // `table-layout: fixed` class that generated no CSS at all still looked correct in tests.
  const Table = ({
    children,
    className,
    'data-testid': testId,
    onSortChange,
    sortDescriptor,
  }: {
    children: React.ReactNode;
    className?: string;
    'data-testid'?: string;
    onSortChange?: (descriptor: { direction: string }) => void;
    sortDescriptor?: { direction: string };
  }) => {
    sortHandler = onSortChange;
    sortDirection = sortDescriptor?.direction ?? 'ascending';

    return (
      <table className={className} data-testid={testId}>
        {children}
      </table>
    );
  };
  Table.Header = ({ children }: { children: React.ReactNode }) => (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
  Table.Head = ({
    allowsSorting,
    className,
    'data-testid': testId,
    id,
    label,
  }: {
    allowsSorting?: boolean;
    className?: string;
    'data-testid'?: string;
    id?: string;
    label?: string;
  }) => (
    <th
      className={className}
      data-column={id}
      data-testid={testId}
      onClick={() =>
        allowsSorting &&
        sortHandler?.({
          direction: sortDirection === 'ascending' ? 'descending' : 'ascending',
        })
      }>
      {label}
    </th>
  );
  Table.Body = ({
    children,
    items,
  }: {
    children: (item: Record<string, unknown>) => React.ReactNode;
    items: Record<string, unknown>[];
  }) => <tbody>{items.map((item) => children(item))}</tbody>;
  Table.Row = ({
    children,
    'data-testid': testId,
    id,
    onAction,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
    id: string;
    onAction?: () => void;
  }) => (
    <tr data-testid={testId} key={id} onClick={onAction}>
      {children}
    </tr>
  );
  Table.Cell = ({ children }: { children: React.ReactNode }) => (
    <td>{children}</td>
  );

  return {
    // `onPress` is react-aria's activation handler; jsdom only fires DOM events, so it is mapped
    // onto onClick here. Without that, a button wired with onPress looks present but inert.
    Button: ({
      children,
      color: _color,
      onClick,
      onPress,
      size: _size,
      ...rest
    }: {
      children: React.ReactNode;
      color?: string;
      onClick?: () => void;
      onPress?: () => void;
      size?: string;
      [key: string]: unknown;
    }) => (
      <button {...rest} onClick={onClick ?? onPress}>
        {children}
      </button>
    ),
    Toggle: ({
      isSelected,
      onChange,
      size: _size,
      ...rest
    }: {
      isSelected?: boolean;
      onChange?: (next: boolean) => void;
      size?: string;
      [key: string]: unknown;
    }) => (
      <input
        {...rest}
        checked={Boolean(isSelected)}
        type="checkbox"
        onChange={(event) => onChange?.(event.target.checked)}
      />
    ),
    Badge: ({
      children,
      bordered: _bordered,
      color: _color,
      size: _size,
      ...rest
    }: {
      children: React.ReactNode;
      bordered?: boolean;
      color?: string;
      size?: string;
      [key: string]: unknown;
    }) => <span {...rest}>{children}</span>,
    EmptyPlaceholder: ({
      'data-testid': testId,
      description,
      footer,
      title,
    }: {
      'data-testid'?: string;
      description?: React.ReactNode;
      footer?: React.ReactNode;
      title: string;
    }) => (
      <div data-testid={testId}>
        {title}
        {description}
        {footer}
      </div>
    ),
    PaginationCardWithControls: ({
      onPageChange,
      onPageSizeChange,
      pageSize,
      pageSizeOptions,
      total,
    }: {
      onPageChange?: (page: number) => void;
      onPageSizeChange?: (size: number) => void;
      pageSize: number;
      pageSizeOptions: number[];
      total: number;
    }) => (
      <div data-testid="pagination" data-total={total}>
        <button type="button" onClick={() => onPageChange?.(2)}>
          page-2
        </button>
        <select
          aria-label="page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange?.(Number(event.target.value))}>
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    ),
    Skeleton: () => (
      <span className="tw:animate-pulse" data-testid="count-skeleton" />
    ),
    Table,
    // Forwards data-testid: the page title and subtitle are Typography, and dropping it let
    // assertions naming them pass without ever finding an element.
    Typography: ({
      children,
      'data-testid': testId,
    }: {
      children?: React.ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>,
  };
});

// Renders the real `options` rather than a fixed list, so the cases below can assert what the filter
// actually offers, and toggles through the multi-select contract (onChange gets the whole next array).
jest.mock('./ConnectionsFilterButton', () => ({
  __esModule: true,
  default: ({
    testId,
    options,
    value,
    multiple,
    onChange,
  }: {
    testId: string;
    options: Array<{ value: string; label: string; supportingText?: string }>;
    value: string | string[];
    multiple?: boolean;
    onChange: (value: string | string[]) => void;
  }) => {
    const selected = Array.isArray(value) ? value : [value];
    // react-aria hands `onSelectionChange` the keys of its own collection, so a selected value that
    // is not among `options` is absent from the write-back — the real component drops it. Mirroring
    // that is what makes "every state is offered" testable rather than assumed.
    const offeredSelection = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.value);

    return (
      <div>
        <button data-testid={testId} type="button">
          {testId}
        </button>
        {options.map((option) => (
          <button
            data-selected={selected.includes(option.value)}
            data-testid={`${testId}-option-${option.value}`}
            key={option.value}
            type="button"
            onClick={() =>
              onChange(
                multiple
                  ? offeredSelection.includes(option.value)
                    ? offeredSelection.filter((entry) => entry !== option.value)
                    : [...offeredSelection, option.value]
                  : option.value
              )
            }>
            {`${option.label}:${option.supportingText ?? ''}`}
          </button>
        ))}
      </div>
    );
  },
}));

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  // Mirrors the real shape: an avatar that is a link, plus inert placeholder text. With an
  // all-inert mock a blanket stopPropagation and a targeted one look identical, which is how the
  // row shipped with a dead owners column.
  OwnerLabel: () => (
    <span data-testid="owner-label">
      <a data-testid="owner-link" href="/users/alice">
        alice
      </a>
      <span data-testid="owner-placeholder">No Owners</span>
    </span>
  ),
}));

jest.mock('./ConnectionsPageSkeleton', () => ({
  __esModule: true,
  default: ({ variant }: { variant: string }) => (
    <div data-testid={`connections-${variant}-skeleton`} />
  ),
}));

jest.mock('./ServiceConnectionCard', () => ({
  __esModule: true,
  default: (props: { service: { name: string }; showCategory?: boolean }) => {
    mockServiceConnectionCard(props);

    return (
      <div data-testid={`service-card-${props.service.name}`}>
        {props.service.name}
      </div>
    );
  },
}));

jest.mock('./useConnectionsData', () => ({
  useConnectionsData: (...args: unknown[]) => mockUseConnectionsData(...args),
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getAddServicePath: (...args: unknown[]) => mockGetAddServicePath(...args),
    getServiceDetailsPath: (...args: unknown[]) =>
      mockGetServiceDetailsPath(...args),
  },
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

// Identity mapping keeps the assertions about which resource was checked readable.
// `canCreateAnyServiceCategory` mirrors the real implementation (any category is enough) so the
// All-tab permission cases exercise the same rule through the mocked checkPermission.
jest.mock('../../../utils/ServicePureUtils', () => ({
  getResourceEntityFromServiceCategory: (category: string) => category,
  canCreateAnyServiceCategory: (permissions: unknown) =>
    Object.values(
      jest.requireActual('../../../enums/service.enum').ServiceCategory
    ).some((category) => mockCheckPermission('Create', category, permissions)),
}));

jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    filterUnsupportedServiceType: (types: string[]) => types,
    getServiceLogo: () => '/mysql.svg',
  },
}));

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
  })
);

const row = {
  displayName: 'MySQL Service',
  entityType: 'databaseService',
  fullyQualifiedName: 'mysql',
  id: 'mysql-id',
  name: 'mysql',
  owners: [],
  serviceType: 'Mysql',
};

const defaultData = {
  categoryCounts: {},
  countsLoading: false,
  estateTotal: 1,
  healthOptions: [
    { count: 2, value: 'success' },
    { count: 1, value: 'failed' },
  ],
  isCountReady: true,
  isError: false,
  isLoading: false,
  isRefreshing: false,
  serviceTypeOptions: [{ count: 24, value: 'Mysql' }],
  serviceTypesInTab: ['Mysql'],
  page: 1,
  pageSize: 10,
  rows: [row],
  setPage: mockSetPage,
  setPageSize: mockSetPageSize,
  sortOrder: 'asc',
  toggleSortOrder: mockToggleSortOrder,
  totalConnections: 24,
  totalRows: 24,
};

const renderView = (viewMode: 'grid' | 'list' = 'list', bottomInset?: number) =>
  render(
    <ConnectionsListView
      bottomInset={bottomInset}
      category="all"
      searchTerm=""
      viewMode={viewMode}
      viewToggle={<div data-testid="view-toggle" />}
      onCategoryChange={mockOnCategoryChange}
    />
  );

describe('ConnectionsListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockPermissions = { all: { Create: true } };
    mockCheckPermission.mockReturnValue(true);
    mockGetContributions.mockReturnValue([]);
    mockGetAddServicePath.mockImplementation(
      (category: string) => `/${category}/add-service`
    );
    mockUseConnectionsData.mockImplementation(
      ({ pageSizeOptions }: { pageSizeOptions: number[] }) => ({
        ...defaultData,
        pageSize: pageSizeOptions[0],
      })
    );
  });

  it('renders the standalone list with five truthful service columns', () => {
    renderView();

    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getByText('label.name')).toBeInTheDocument();
    expect(screen.getByText('label.connector')).toBeInTheDocument();
    expect(screen.getByText('label.category')).toBeInTheDocument();
    expect(screen.getByText('label.owner')).toBeInTheDocument();
    expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    expect(screen.getByText('MySQL Service')).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
    // `data-total` is the page count, so it follows the list page size — derived here so the
    // assertion cannot rot the next time that constant changes.
    expect(screen.getByTestId('pagination')).toHaveAttribute(
      'data-total',
      String(Math.ceil(24 / LIST_PAGE_SIZE_OPTIONS[0]))
    );
  });

  it('drops the redundant Category column on a specific category tab', () => {
    render(
      <ConnectionsListView
        category={ServiceCategory.DATABASE_SERVICES}
        searchTerm=""
        viewMode="list"
        viewToggle={<div data-testid="view-toggle" />}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(screen.queryByText('label.category')).not.toBeInTheDocument();
    expect(screen.getByText('label.connector')).toBeInTheDocument();
  });

  it('hides the category badge on the cards for a specific category tab', () => {
    render(
      <ConnectionsListView
        category={ServiceCategory.DATABASE_SERVICES}
        searchTerm=""
        viewMode="grid"
        viewToggle={<div data-testid="view-toggle" />}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(mockServiceConnectionCard).toHaveBeenCalledWith(
      expect.objectContaining({ showCategory: false })
    );
  });

  it('renders the same results as a flat card grid', () => {
    renderView('grid');

    expect(screen.getByTestId('connections-grid-view')).toBeInTheDocument();
    expect(screen.getByTestId('service-card-mysql')).toBeInTheDocument();
    expect(
      screen.queryByTestId('connections-add-service-card')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('connections-list-table')
    ).not.toBeInTheDocument();
    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: 'all',
        healthStates: [],
        pageSizeOptions: GRID_PAGE_SIZE_OPTIONS,
        searchTerm: '',
        serviceTypes: [],
      })
    );
  });

  it('renders the shared secondary navigation in both modes', () => {
    render(
      <ConnectionsListView
        category="all"
        searchTerm=""
        viewMode="grid"
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(screen.getByTestId('connections-secondary-nav')).toBeInTheDocument();
    expect(screen.getByTestId('connections-nav-all')).toHaveTextContent('24');

    fireEvent.click(
      screen.getByTestId(`connections-nav-${ServiceCategory.DATABASE_SERVICES}`)
    );

    expect(mockOnCategoryChange).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES
    );
  });

  it('shows the active category count from the estate-wide counts map', () => {
    mockUseConnectionsData.mockImplementation(
      ({ pageSizeOptions }: { pageSizeOptions: number[] }) => ({
        ...defaultData,
        categoryCounts: { [ServiceCategory.DATABASE_SERVICES]: 24 },
        pageSize: pageSizeOptions[0],
      })
    );

    render(
      <ConnectionsListView
        category={ServiceCategory.DATABASE_SERVICES}
        searchTerm=""
        viewMode="grid"
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(screen.getByText('label.database-service (24)')).toBeInTheDocument();
    expect(
      screen.getByTestId(`connections-nav-${ServiceCategory.DATABASE_SERVICES}`)
    ).toHaveTextContent('24');
  });

  it('shows a skeleton only on the active tab badge while counts load', () => {
    mockUseConnectionsData.mockImplementation(
      ({ pageSizeOptions }: { pageSizeOptions: number[] }) => ({
        ...defaultData,
        categoryCounts: { [ServiceCategory.DATABASE_SERVICES]: 24 },
        countsLoading: true,
        pageSize: pageSizeOptions[0],
      })
    );

    render(
      <ConnectionsListView
        category={ServiceCategory.DATABASE_SERVICES}
        searchTerm=""
        viewMode="grid"
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // The active category badge is replaced by a skeleton; a non-active one keeps its count.
    expect(screen.getAllByTestId('count-skeleton')).toHaveLength(1);
    expect(
      screen.getByTestId(`connections-nav-${ServiceCategory.DATABASE_SERVICES}`)
    ).toContainElement(screen.getByTestId('count-skeleton'));
  });

  it('passes the connector selection from the URL down to the data hook', () => {
    mockSearchParams = new URLSearchParams('serviceType=Mysql,Postgres');

    renderView('grid');

    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({ serviceTypes: ['Mysql', 'Postgres'] })
    );
  });

  it('expands the health widget deep-link into the precise states', () => {
    mockSearchParams = new URLSearchParams('health=failing');

    renderView('grid');

    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        healthStates: ['failed', 'partialSuccess'],
      })
    );
  });

  describe('health filter options', () => {
    // The aggregation only returns states some service is in, so an option list built from it cannot
    // represent every selection the URL can carry.
    it('offers every state in severity order, counting the absent ones as zero', () => {
      renderView('grid');

      const offered = screen
        .getAllByTestId(/^connections-health-filter-option-/)
        .map((option) => [
          option.getAttribute('data-testid'),
          option.textContent,
        ]);

      expect(offered).toEqual([
        ['connections-health-filter-option-failed', 'label.failed:1'],
        ['connections-health-filter-option-partialSuccess', 'label.warning:0'],
        ['connections-health-filter-option-notRun', 'label.not-ran:0'],
        ['connections-health-filter-option-success', 'label.healthy:2'],
      ]);
    });

    it('marks both states of the failing deep-link as selected', () => {
      mockSearchParams = new URLSearchParams('health=failing');

      renderView('grid');

      expect(
        screen.getByTestId('connections-health-filter-option-failed')
      ).toHaveAttribute('data-selected', 'true');
      // partialSuccess has no services here, so before the fix it was not offered at all — the
      // selection silently collapsed to failed on the next toggle.
      expect(
        screen.getByTestId('connections-health-filter-option-partialSuccess')
      ).toHaveAttribute('data-selected', 'true');
    });

    it('keeps the other selected state when one of them is unticked', () => {
      mockSearchParams = new URLSearchParams('health=failed,partialSuccess');

      renderView('grid');

      fireEvent.click(
        screen.getByTestId('connections-health-filter-option-failed')
      );

      // setSearchParams is called with an updater, so run it against the current params.
      const update = mockSetSearchParams.mock.calls.at(-1)?.[0];

      expect(update(mockSearchParams).get('health')).toBe('partialSuccess');
    });
  });

  it('asks for deleted services when the switch is turned on', () => {
    renderView('list');

    fireEvent.click(screen.getByTestId('connections-show-deleted'));

    expect(mockSetSearchParams).toHaveBeenCalled();

    const updater = mockSetSearchParams.mock.calls.at(-1)?.[0];
    const next = updater(new URLSearchParams());

    expect(next.get('deleted')).toBe('true');
  });

  it('passes the deleted switch down to the data hook', () => {
    mockSearchParams = new URLSearchParams('deleted=true');

    renderView('list');

    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({ showDeleted: true })
    );
  });

  it('says something went wrong rather than showing an empty estate', () => {
    mockUseConnectionsData.mockReturnValue({
      ...defaultData,
      isError: true,
      rows: [],
    });

    renderView('list');

    expect(screen.getByTestId('connections-list-error')).toBeInTheDocument();
    expect(
      screen.queryByTestId('connections-list-empty')
    ).not.toBeInTheDocument();
  });

  it('marks the results busy while a new page is still loading', () => {
    mockUseConnectionsData.mockReturnValue({
      ...defaultData,
      isRefreshing: true,
    });

    renderView('list');

    // keepPreviousData leaves the previous rows on screen, so without this the list looks
    // settled while a different page is in flight.
    expect(screen.getByTestId('connections-results')).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('does not mark the results busy once they are current', () => {
    renderView('list');

    expect(screen.getByTestId('connections-results')).toHaveAttribute(
      'aria-busy',
      'false'
    );
  });

  it('offers Clear All only once a filter is applied', () => {
    renderView('list');

    expect(
      screen.queryByTestId('connections-clear-filters')
    ).not.toBeInTheDocument();
  });

  it('clears both filters but leaves the search alone', () => {
    mockSearchParams = new URLSearchParams(
      'serviceType=Mysql&health=failed&search=keepme&deleted=true'
    );

    renderView('list');
    fireEvent.click(screen.getByTestId('connections-clear-filters'));

    const updater = mockSetSearchParams.mock.calls.at(-1)?.[0];
    const next = updater(
      new URLSearchParams(
        'serviceType=Mysql&health=failed&search=keepme&deleted=true'
      )
    );

    expect(next.get('serviceType')).toBeNull();
    expect(next.get('health')).toBeNull();
    // The search box is visible and typed; wiping it would discard something the user can see.
    expect(next.get('search')).toBe('keepme');
    expect(next.get('deleted')).toBe('true');
  });

  it('hides the count until it is known for the tab being shown', () => {
    mockUseConnectionsData.mockReturnValue({
      ...defaultData,
      isCountReady: false,
    });

    renderView('list');

    expect(screen.getAllByText('label.all-connections').length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByText('label.all-connections (24)')
    ).not.toBeInTheDocument();
  });

  it('keeps the sidebar badge at the full category total when a connector-type filter narrows the list', () => {
    mockSearchParams = new URLSearchParams('serviceType=Mysql');
    mockUseConnectionsData.mockImplementation(
      ({
        pageSizeOptions,
        serviceTypes,
      }: {
        pageSizeOptions: number[];
        serviceTypes: string[];
      }) => ({
        ...defaultData,
        categoryCounts: { [ServiceCategory.DATABASE_SERVICES]: 24 },
        pageSize: pageSizeOptions[0],
        totalRows: serviceTypes.includes('Mysql') ? 3 : 24,
      })
    );

    render(
      <ConnectionsListView
        category={ServiceCategory.DATABASE_SERVICES}
        searchTerm=""
        viewMode="grid"
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(screen.getByText('label.database-service (3)')).toBeInTheDocument();
    expect(
      screen.getByTestId(`connections-nav-${ServiceCategory.DATABASE_SERVICES}`)
    ).toHaveTextContent('24');
  });

  it('renders the correct skeleton for each layout', () => {
    mockUseConnectionsData.mockReturnValue({
      ...defaultData,
      isLoading: true,
    });

    renderView('grid');

    expect(screen.getByTestId('connections-grid-skeleton')).toBeInTheDocument();
  });

  it('renders an empty placeholder when no rows match the search', () => {
    mockUseConnectionsData.mockReturnValue({ ...defaultData, rows: [] });

    render(
      <ConnectionsListView
        category="all"
        searchTerm="no-such-service"
        viewMode="list"
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // One placeholder serves both states: a narrowed result swaps the first-run copy for the
    // try-changing-the-filters title, and keeps the icon and the Add Service action.
    expect(
      screen.getByTestId('connections-list-empty-first-run')
    ).toHaveTextContent('message.no-data-available-for-selected-filter');
    expect(
      screen.queryByTestId('connections-list-empty-first-run')
    ).not.toHaveTextContent('message.empty-all-connections-description');
  });

  describe('onboarding extension point', () => {
    const ONBOARDING_CONTRIBUTION = 'onboarding-checklist-card';
    const FIRST_RUN_PLACEHOLDER = 'connections-list-empty-first-run';

    const contributeOnboarding = () => {
      mockGetContributions.mockImplementation((extensionPointId: string) =>
        extensionPointId === EXTENSION_POINTS.CONNECTIONS_LIST_ONBOARDING
          ? [
              {
                key: 'onboarding',
                component: () => <div data-testid={ONBOARDING_CONTRIBUTION} />,
              },
            ]
          : []
      );
    };

    const renderEmptyEstate = (searchTerm = '') => {
      mockUseConnectionsData.mockReturnValue({ ...defaultData, rows: [] });

      return render(
        <ConnectionsListView
          category="all"
          searchTerm={searchTerm}
          viewMode="list"
          onCategoryChange={mockOnCategoryChange}
        />
      );
    };

    it('replaces the bare placeholder with a contributed onboarding component', () => {
      contributeOnboarding();

      renderEmptyEstate();

      expect(screen.getByTestId(ONBOARDING_CONTRIBUTION)).toBeInTheDocument();
      expect(
        screen.queryByTestId(FIRST_RUN_PLACEHOLDER)
      ).not.toBeInTheDocument();
    });

    // The contribution stands in for the whole browse view — a zero count and filters over
    // nothing are only noise in front of it.
    it('drops the surrounding chrome while a contributed onboarding component is showing', () => {
      contributeOnboarding();

      renderEmptyEstate();

      expect(
        screen.queryByTestId('connections-page-title')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('connections-page-subtitle')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('connections-filter-row')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('connections-secondary-nav')
      ).not.toBeInTheDocument();
    });

    it('keeps the chrome when nothing is contributed for the onboarding slot', () => {
      renderEmptyEstate();

      expect(screen.getByTestId('connections-page-title')).toBeInTheDocument();
      expect(screen.getByTestId('connections-filter-row')).toBeInTheDocument();
      expect(
        screen.getByTestId('connections-secondary-nav')
      ).toBeInTheDocument();
    });

    // In-flight data is not an empty estate — hiding the chrome would strip the page down and
    // rebuild it a moment later.
    it('keeps the chrome and the loading skeleton, not the contribution, while the estate is still loading', () => {
      contributeOnboarding();
      mockUseConnectionsData.mockReturnValue({
        ...defaultData,
        rows: [],
        isLoading: true,
      });

      render(
        <ConnectionsListView
          category="all"
          searchTerm=""
          viewMode="list"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByTestId('connections-filter-row')).toBeInTheDocument();
      expect(
        screen.queryByTestId(ONBOARDING_CONTRIBUTION)
      ).not.toBeInTheDocument();
    });

    // Nor is a failed fetch — it must keep saying something went wrong, with its chrome.
    it('keeps the chrome and the error when the estate could not be loaded', () => {
      contributeOnboarding();
      mockUseConnectionsData.mockReturnValue({
        ...defaultData,
        rows: [],
        isError: true,
      });

      render(
        <ConnectionsListView
          category="all"
          searchTerm=""
          viewMode="list"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(screen.getByTestId('connections-filter-row')).toBeInTheDocument();
      expect(
        screen.queryByTestId(ONBOARDING_CONTRIBUTION)
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('connections-list-error')).toBeInTheDocument();
    });

    it('shows results rather than a contribution as soon as a service exists', () => {
      contributeOnboarding();
      mockUseConnectionsData.mockReturnValue(defaultData);

      render(
        <ConnectionsListView
          category="all"
          searchTerm=""
          viewMode="list"
          onCategoryChange={mockOnCategoryChange}
        />
      );

      expect(
        screen.queryByTestId(ONBOARDING_CONTRIBUTION)
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('connections-results')).toBeInTheDocument();
    });
  });

  describe('first-run placeholder', () => {
    const FIRST_RUN = 'connections-list-empty-first-run';
    const ADD_SERVICE = 'connections-list-empty-add-service';

    const renderEmpty = (
      category: ConnectionsCategory = 'all',
      searchTerm = ''
    ) => {
      mockUseConnectionsData.mockReturnValue({ ...defaultData, rows: [] });

      return render(
        <ConnectionsListView
          category={category}
          searchTerm={searchTerm}
          viewMode="list"
          onCategoryChange={mockOnCategoryChange}
        />
      );
    };

    // One case per shape of the config: an OSS-shared category, another one, and the
    // all-spanning All tab that has no ServiceCategory to look up.
    it.each([
      [
        ServiceCategory.DATABASE_SERVICES,
        'message.empty-database-services-title',
        'message.empty-database-services-description',
      ],
      [
        ServiceCategory.DRIVE_SERVICES,
        'message.empty-drive-services-title',
        'message.empty-drive-services-description',
      ],
      [
        ServiceCategory.SECURITY_SERVICES,
        'message.empty-security-services-title',
        'message.empty-security-services-description',
      ],
      [
        'all' as const,
        'message.empty-all-connections-title',
        'message.empty-all-connections-description',
      ],
    ])(
      'tells the user what the %s tab is for, and opens that tab own add-service page',
      (category, title, description) => {
        renderEmpty(category as ConnectionsCategory);

        const placeholder = screen.getByTestId(FIRST_RUN);

        expect(placeholder).toHaveTextContent(title);
        expect(placeholder).toHaveTextContent(description);
        expect(placeholder).not.toHaveTextContent(
          'message.no-data-available-for-selected-filter'
        );

        fireEvent.click(screen.getByTestId(ADD_SERVICE));

        // 'all' spans every category, so it opens the wizard on the `all` sentinel — every
        // category's connectors, none pre-selected — rather than defaulting to databases.
        const expectedCategory =
          category === 'all' ? ALL_SERVICES_CATEGORY : category;

        expect(mockGetAddServicePath).toHaveBeenCalledWith(expectedCategory);
        expect(mockNavigate).toHaveBeenCalledWith(
          `/${expectedCategory}/add-service`
        );
      }
    );

    it('checks create permission against the resource of the tab in view', () => {
      renderEmpty(ServiceCategory.DRIVE_SERVICES);

      expect(mockCheckPermission).toHaveBeenCalledWith(
        'Create',
        ServiceCategory.DRIVE_SERVICES,
        mockPermissions
      );
    });

    it('gates the All tab action on being able to create any category, not databases', () => {
      // A user who can create only API services must still get the button on All Connections —
      // the old check asked about databases specifically and wrongly hid it.
      mockCheckPermission.mockImplementation(
        (_operation, resource) => resource === ServiceCategory.API_SERVICES
      );

      renderEmpty('all');

      expect(screen.getByTestId(ADD_SERVICE)).toBeInTheDocument();
    });

    it('hides the All tab action when the user can create nothing', () => {
      mockCheckPermission.mockReturnValue(false);

      renderEmpty('all');

      expect(screen.getByTestId(FIRST_RUN)).toBeInTheDocument();
      expect(screen.queryByTestId(ADD_SERVICE)).not.toBeInTheDocument();
    });

    it('keeps the copy but drops the action without create permission', () => {
      mockCheckPermission.mockReturnValue(false);

      renderEmpty(ServiceCategory.DATABASE_SERVICES);

      expect(screen.getByTestId(FIRST_RUN)).toHaveTextContent(
        'message.empty-database-services-title'
      );
      expect(screen.queryByTestId(ADD_SERVICE)).not.toBeInTheDocument();
    });

    it('drops the action until permissions have loaded', () => {
      mockPermissions = {};

      renderEmpty(ServiceCategory.DATABASE_SERVICES);

      expect(screen.queryByTestId(ADD_SERVICE)).not.toBeInTheDocument();
      expect(mockCheckPermission).not.toHaveBeenCalled();
    });

    // Each of the three narrowing inputs has to suppress the first-run copy independently: an empty
    // result under any of them says nothing about whether the estate is empty.
    it.each([
      ['a connector filter is set', 'serviceType=Mysql'],
      ['a health filter is set', 'health=failed'],
      ['deleted services are shown', 'deleted=true'],
    ])(
      'swaps the first-run copy for the filter copy when %s',
      (_case, query) => {
        mockSearchParams = new URLSearchParams(query);

        renderEmpty(ServiceCategory.DATABASE_SERVICES);

        const placeholder = screen.getByTestId(FIRST_RUN);

        expect(placeholder).toHaveTextContent(
          'message.no-data-available-for-selected-filter'
        );
        expect(placeholder).not.toHaveTextContent(
          'message.empty-database-services-title'
        );
        expect(placeholder).not.toHaveTextContent(
          'message.empty-database-services-description'
        );
      }
    );

    // A narrowed view is empty by the user's own choice, so it keeps the try-other-filters
    // placeholder even when the onboarding slot has a contribution registered — the contribution
    // would read as "you have no services", which is not the case.
    it('keeps the placeholder over a contribution when a search narrowed the view to nothing', () => {
      mockGetContributions.mockImplementation((extensionPointId: string) =>
        extensionPointId === EXTENSION_POINTS.CONNECTIONS_LIST_ONBOARDING
          ? [{ key: 'onboarding', component: () => <div /> }]
          : []
      );

      renderEmpty('all', 'no-such-service');

      expect(screen.getByTestId(FIRST_RUN)).toBeInTheDocument();
    });
  });

  it('keeps the secondary navigation and filters interactive while the empty placeholder is shown', () => {
    mockUseConnectionsData.mockReturnValue({ ...defaultData, rows: [] });

    renderView();

    // The placeholder is absolutely positioned, so it must be bounded by a
    // relative host or it blankets the nav column and swallows every click.
    expect(screen.getByTestId('connections-list-empty-wrapper')).toHaveClass(
      'tw:relative'
    );

    fireEvent.click(
      screen.getByTestId(`connections-nav-${ServiceCategory.DATABASE_SERVICES}`)
    );

    expect(mockOnCategoryChange).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES
    );

    expect(screen.getByTestId('connections-service-type-filter')).toBeEnabled();
    expect(screen.getByTestId('connections-health-filter')).toBeEnabled();
  });

  it('toggles name sort order in list mode', () => {
    renderView();

    fireEvent.click(screen.getByTestId('connections-list-name-header'));

    expect(mockToggleSortOrder).toHaveBeenCalledTimes(1);
  });

  it('changes pages and rows per page in either layout', () => {
    renderView('grid');

    fireEvent.click(screen.getByText('page-2'));
    fireEvent.change(screen.getByLabelText('page-size'), {
      target: { value: '24' },
    });

    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(mockSetPageSize).toHaveBeenCalledWith(24);
  });

  it('navigates to service details from a list row', () => {
    renderView();

    fireEvent.click(screen.getByTestId('connections-list-row-mysql'));

    expect(mockGetServiceDetailsPath).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES,
      'mysql'
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      '/connections/databaseServices/mysql'
    );
  });

  it('uses twelve cards per grid page and ten rows per list page', () => {
    renderView('grid');

    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: 'all',
        healthStates: [],
        pageSizeOptions: GRID_PAGE_SIZE_OPTIONS,
        searchTerm: '',
        serviceTypes: [],
      })
    );

    renderView('list');

    expect(mockUseConnectionsData).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSizeOptions: LIST_PAGE_SIZE_OPTIONS })
    );
  });

  // Clicking an owner avatar opens its own popover; the row must not navigate out from under it.
  it('keeps a click on an owner link from opening the service', () => {
    renderView('list');

    fireEvent.click(screen.getByTestId('owner-link'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // The counterpart a blanket wrapper got wrong: the placeholder and the padding around the avatars
  // are not controls, so they belong to the row like the rest of it.
  it.each([
    ['the owner placeholder', 'owner-placeholder'],
    ['the owner region itself', 'owner-label'],
  ])('still opens the service when %s is clicked', (_, testId) => {
    renderView('list');

    fireEvent.click(screen.getByTestId(testId));

    expect(mockNavigate).toHaveBeenCalled();
  });

  // A service name has no natural width bound, so without a fixed layout the browser sized the name
  // column to its longest value and `truncate` had nothing to truncate against. The class that used
  // to do this was `[&]:tw:[table-layout:fixed]`, which generates no CSS at all under the Tailwind
  // v4 prefix — it sat in the DOM looking right while the table stayed `auto`.
  it('lays the table out fixed so the name column can ellipsize', () => {
    renderView('list');

    expect(screen.getByTestId('connections-list-table')).toHaveClass(
      'tw:table-fixed'
    );
  });

  // Every column is sized. Leaving the name to take the remainder gave it the same share as the
  // rest, so a long name still had nowhere to ellipsize.
  // The enum member, not the bare 'databaseServices' literal: ConnectionsCategory is built from the
  // ServiceCategory string enum, and a plain literal is not assignable to an enum member type.
  it.each([
    ['all' as const, 'all', SECONDARY_COLUMN_WIDTH.all],
    [
      ServiceCategory.DATABASE_SERVICES,
      'scoped',
      SECONDARY_COLUMN_WIDTH.scoped,
    ],
  ])('sizes every column on the %s tab', (category, _shape, secondaryWidth) => {
    render(
      <ConnectionsListView
        category={category}
        searchTerm=""
        viewMode="list"
        viewToggle={<div data-testid="view-toggle" />}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    const headers = [
      ...screen.getByTestId('connections-list-table').querySelectorAll('th'),
    ];

    expect(headers.length).toBeGreaterThan(0);

    headers.forEach((header) => {
      const expected =
        header.getAttribute('data-column') === 'name'
          ? NAME_COLUMN_WIDTH
          : secondaryWidth;

      expect(header).toHaveClass(expected);
    });
  });

  // A contributed footer (e.g. an AI composer) overlays the bottom of the page, so the scroll area
  // has to reserve its height or the pagination bar can never be scrolled out from under it.
  it('reserves the measured footer height at the bottom of the scroll area', () => {
    renderView('list', 149);

    expect(screen.getByTestId('connections-scroll-container')).toHaveStyle({
      paddingBottom: '149px',
    });
  });

  // A footer-shaped hole with no footer in it is dead space that puts a scrollbar on content
  // that already fits, which is what a fixed padding would do.
  it('reserves nothing when there is no footer to clear', () => {
    renderView('list', 0);

    expect(
      screen.getByTestId('connections-scroll-container').style.paddingBottom
    ).toBe('');
  });
});
