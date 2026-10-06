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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { listIncidentGroups } from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { FilterDescriptor } from '../../../DataQuality/TestCases/FilterChip.interface';
import { FilterBarProps } from '../../common/FilterChip/FilterBar';
import {
  IncidentGroupByDropdownProps,
  IncidentGroupsTableProps,
} from './IncidentGroups.types';
import IncidentGroupsView from './IncidentGroupsView';

const mockListIncidentGroups = listIncidentGroups as jest.Mock;
const mockShowErrorToast = showErrorToast as jest.Mock;

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  listIncidentGroups: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// The global mock drops the interpolated values; the stat chips are counts, so
// this one keeps them to assert what each chip was handed.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { language: 'en-US', dir: jest.fn().mockReturnValue('ltr') },
  }),
}));

let mockFilterBarProps: FilterBarProps;

// The bar's own controls are covered by its tests; here only what the view
// hands it and does with the changes it reports back matters.
jest.mock('../../common/FilterChip/FilterBar', () =>
  jest.fn().mockImplementation((props: FilterBarProps) => {
    mockFilterBarProps = props;

    return <div data-testid="filter-bar" />;
  })
);

// Stands in for the pager so a test can ask for any page the real one lets a
// user click or type, and read back what the view told it to draw.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  PaginationCardWithControls: jest
    .fn()
    .mockImplementation(
      ({
        page,
        total,
        pageSize,
        onPageChange,
        onPageSizeChange,
      }: {
        page: number;
        total: number;
        pageSize: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
      }) => (
        <div data-testid="pager">
          <span data-testid="pager-page">{page}</span>
          <span data-testid="pager-total">{total}</span>
          <span data-testid="pager-size">{pageSize}</span>
          <button
            data-testid="pager-previous"
            onClick={() => onPageChange(page - 1)}>
            previous
          </button>
          <button
            data-testid="pager-next"
            onClick={() => onPageChange(page + 1)}>
            next
          </button>
          <button
            data-testid="pager-jump-ahead"
            onClick={() => onPageChange(page + 3)}>
            jump-ahead
          </button>
          <button
            data-testid="pager-size-25"
            onClick={() => onPageSizeChange(25)}>
            size-25
          </button>
        </div>
      )
    ),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('./IncidentGroupByDropdown', () =>
  jest
    .fn()
    .mockImplementation(({ value, onChange }: IncidentGroupByDropdownProps) => (
      <div>
        <span data-testid="selected-group-by">{value}</span>
        <button
          data-testid="select-owner"
          onClick={() => onChange('owner' as IncidentGroupBy)}>
          owner
        </button>
        <button
          data-testid="select-test-definition"
          onClick={() => onChange('testDefinition' as IncidentGroupBy)}>
          testDefinition
        </button>
      </div>
    ))
);

jest.mock('./IncidentGroupsTable', () =>
  jest
    .fn()
    .mockImplementation(
      ({ groups, sortType, onSortTypeChange }: IncidentGroupsTableProps) => (
        <div data-testid="incident-groups-table">
          <span data-testid="table-group-count">{groups.length}</span>
          <span data-testid="table-sort-type">{sortType}</span>
          <button
            data-testid="flip-sort"
            onClick={() => onSortTypeChange('asc')}>
            asc
          </button>
        </div>
      )
    )
);

const LocationSearch = () => {
  const { search } = useLocation();

  return <span data-testid="location-search">{search}</span>;
};

const mockGroups = [
  {
    groupBy: IncidentGroupBy.TestDefinition,
    name: 'columnValuesToBeUnique',
    incidentCount: 5,
    trendDirection: IncidentTrendDirection.Rising,
  },
  {
    groupBy: IncidentGroupBy.TestDefinition,
    name: 'tableRowCountToEqual',
    incidentCount: 3,
    trendDirection: IncidentTrendDirection.Rising,
  },
  {
    groupBy: IncidentGroupBy.TestDefinition,
    name: 'columnValuesToBeNotNull',
    incidentCount: 1,
    trendDirection: IncidentTrendDirection.Falling,
  },
];

const viewTree = (refreshKey?: number) => (
  <>
    <IncidentGroupsView refreshKey={refreshKey} />
    <LocationSearch />
  </>
);

const renderView = (initialEntry = '/observability/incident-manager') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>{viewTree()}</MemoryRouter>
  );

describe('IncidentGroupsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 5 },
    });
  });

  it('should show the loader until the groups resolve', async () => {
    let resolveGroups: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveGroups = resolve;
      })
    );

    renderView();

    expect(screen.getByTestId('incident-groups-loader')).toBeInTheDocument();

    await act(async () => {
      resolveGroups({ data: mockGroups, paging: { total: 5 } });
    });

    expect(
      screen.queryByTestId('incident-groups-loader')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should render the header stats and the table once loaded', async () => {
    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-count')).toHaveTextContent(
      'label.group-count:5'
    );
    expect(
      screen.getByTestId('incident-groups-recurring-count')
    ).toHaveTextContent('label.recurring-count:2');
    expect(screen.getByTestId('table-group-count')).toHaveTextContent('3');
  });

  it('should refire the fetch with the ordering the table hands back', async () => {
    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('table-sort-type')).toHaveTextContent('desc');

    await act(async () => {
      fireEvent.click(screen.getByTestId('flip-sort'));
    });

    expect(screen.getByTestId('table-sort-type')).toHaveTextContent('asc');
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'asc',
    });
  });

  it('should keep the table mounted across a sort refetch', async () => {
    await act(async () => {
      renderView();
    });

    let resolveSorted: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveSorted = resolve;
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('flip-sort'));
    });

    // Swapping the table for a loader here would drop focus from the sort
    // header the user just pressed.
    expect(
      screen.queryByTestId('incident-groups-loader')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();

    await act(async () => {
      resolveSorted({ data: mockGroups, paging: { total: 5 } });
    });

    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should render the empty state when no group is returned', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-empty')).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
  });

  it('should render the error state when the fetch fails', async () => {
    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-count')).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
  });

  it('should not raise an error toast for a request that settles after unmount', async () => {
    let rejectGroups: (reason: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectGroups = reject;
      })
    );

    const { unmount } = renderView();

    unmount();

    await act(async () => {
      rejectGroups(new Error('failure'));
    });

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('should fetch with the default dimension when the URL carries none', async () => {
    await act(async () => {
      renderView();
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
    });
    expect(screen.getByTestId('selected-group-by')).toHaveTextContent(
      IncidentGroupBy.TestDefinition
    );
  });

  it('should fetch with the dimension read from the URL', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table');
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.Table,
      limit: 10,
      sortType: 'desc',
    });
    expect(screen.getByTestId('selected-group-by')).toHaveTextContent(
      IncidentGroupBy.Table
    );
  });

  it('should fall back to the default dimension for an unknown URL value', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=unknown');
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
    });
  });

  it('should sync the dimension switch to the URL and refire the fetch', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table&assignee=adam');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'groupBy=owner'
    );
    // Unrelated filters in the URL survive the switch.
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'assignee=adam'
    );
    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      assignee: 'adam',
      limit: 10,
      sortType: 'desc',
    });
  });

  it('should re-read the groups when the page reports an incident change', async () => {
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
  });

  it('should keep the rows and the stats on screen while a reported change is re-read', async () => {
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    let resolveRefresh: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    rendered?.rerender(
      <MemoryRouter initialEntries={['/observability/incident-manager']}>
        {viewTree(1)}
      </MemoryRouter>
    );

    // The re-read is in flight: the table the user is reading stays put.
    expect(
      screen.queryByTestId('incident-groups-loader')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-count')).toHaveTextContent(
      'label.group-count:5'
    );

    await act(async () => {
      resolveRefresh({ data: mockGroups.slice(0, 2), paging: { total: 2 } });
    });

    expect(screen.getByTestId('table-group-count')).toHaveTextContent('2');
  });

  it('should leave the rows in place when a reported change fails to re-read', async () => {
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    expect(
      screen.queryByTestId('incident-groups-error')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('table-group-count')).toHaveTextContent('3');
    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('should drop the previous dimension rows while the new one loads', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=testDefinition');
    });

    let resolveSwitched: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveSwitched = resolve;
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    // Kept, they would render test-definition groups under the owner column
    // header, and the stats would count the dimension the user just left.
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-loader')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-count')).toBeEmptyDOMElement();

    await act(async () => {
      resolveSwitched({ data: mockGroups.slice(0, 1), paging: { total: 1 } });
    });

    expect(screen.getByTestId('table-group-count')).toHaveTextContent('1');
  });

  it('should hold the error state when a reported change fails to re-read it', async () => {
    mockListIncidentGroups.mockRejectedValue(new Error('failure'));
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    // Clearing the flag for a re-read that fails too would leave the section
    // on the 'no incidents' placeholder while the endpoint is still down.
    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-empty')
    ).not.toBeInTheDocument();
  });

  it('should clear the error once a reported change re-reads successfully', async () => {
    mockListIncidentGroups.mockRejectedValueOnce(new Error('failure'));
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    expect(
      screen.queryByTestId('incident-groups-error')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('table-group-count')).toHaveTextContent('3');
  });

  it('should not re-read the groups while the reported change stands', async () => {
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);
  });

  it('should own the loader and the error when a reported change finds the table empty', async () => {
    let rendered: ReturnType<typeof render> | undefined;

    await act(async () => {
      rendered = render(
        <MemoryRouter
          initialEntries={[
            '/observability/incident-manager?groupBy=testDefinition',
          ]}>
          {viewTree(0)}
        </MemoryRouter>
      );
    });

    // The dimension switch never settles, so its rows never reach the table.
    mockListIncidentGroups.mockReturnValue(new Promise(() => undefined));

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      rendered?.rerender(
        <MemoryRouter
          initialEntries={[
            '/observability/incident-manager?groupBy=testDefinition',
          ]}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    // The re-read supersedes the switch it raced, so it is the only request
    // left to speak for the section: with no rows to preserve, reporting 'no
    // active incidents' would hide a fetch that failed.
    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-empty')
    ).not.toBeInTheDocument();
  });

  it('should not refire the fetch when the selected dimension is picked again', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=testDefinition');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-test-definition'));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);
  });
});

const BASE_PATH = '/observability/incident-manager';

const getDescriptor = (key: string): FilterDescriptor => {
  const descriptor = mockFilterBarProps.filters.find(
    (filter) => filter.key === key
  );

  if (!descriptor) {
    throw new Error(`No filter descriptor for ${key}`);
  }

  return descriptor;
};

const getSearchParams = () =>
  new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');

describe('IncidentGroupsView filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 3 },
    });
  });

  it('should compose every filter the URL carries into the request', async () => {
    await act(async () => {
      renderView(
        `${BASE_PATH}?groupBy=table&testCaseFQN=svc.db.orders.row_count` +
          '&assignee=adam&status=New&status=Ack&dateField=updatedAt' +
          '&startTs=100&endTs=200'
      );
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.Table,
      testCaseFQN: 'svc.db.orders.row_count',
      assignee: 'adam',
      status: ['New', 'Ack'],
      dateField: 'updatedAt',
      startTs: 100,
      endTs: 200,
      limit: 10,
      sortType: 'desc',
    });
    expect(mockFilterBarProps.hasActiveFilters).toBe(true);
    expect(getDescriptor('status').value).toEqual(['New', 'Ack']);
    expect(getDescriptor('dateField').value).toBe('updatedAt');
  });

  it('should refetch page 1 with all active filters when a filter changes', async () => {
    await act(async () => {
      renderView(`${BASE_PATH}?assignee=adam&page=3&cursor=cursor-3`);
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 'cursor-3' })
    );

    await act(async () => {
      getDescriptor('status').onChange(['New']);
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      assignee: 'adam',
      status: ['New'],
      limit: 10,
      sortType: 'desc',
    });

    const params = getSearchParams();

    expect(params.getAll('status')).toEqual(['New']);
    expect(params.get('assignee')).toBe('adam');
    expect(params.has('page')).toBe(false);
    expect(params.has('cursor')).toBe(false);
  });

  it.each([
    [
      'testCaseFQN',
      () => getDescriptor('testCaseFQN').onChange('svc.db.orders.row_count'),
      { testCaseFQN: 'svc.db.orders.row_count' },
    ],
    [
      'assignee',
      () =>
        getDescriptor('assignee').onOwnerChange?.([
          { id: 'u1', type: 'user', name: 'adam' },
        ]),
      { assignee: 'adam' },
    ],
    [
      'dateField',
      () => getDescriptor('dateField').onChange('updatedAt'),
      { dateField: 'updatedAt' },
    ],
    [
      'dateRange',
      () => getDescriptor('dateRange').onChange({ startTs: 1, endTs: 2 }),
      { startTs: 1, endTs: 2 },
    ],
  ])(
    'should reset to page 1 when the %s filter changes',
    async (_name, change, expected) => {
      await act(async () => {
        renderView(`${BASE_PATH}?page=2&cursor=cursor-2`);
      });

      await act(async () => {
        change();
      });

      expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
        groupBy: IncidentGroupBy.TestDefinition,
        limit: 10,
        sortType: 'desc',
        ...expected,
      });
      expect(getSearchParams().has('cursor')).toBe(false);
      expect(getSearchParams().has('page')).toBe(false);
    }
  );

  it('should restore the unfiltered request when the filters are cleared', async () => {
    await act(async () => {
      renderView(
        `${BASE_PATH}?groupBy=owner&assignee=adam&status=New&startTs=1&endTs=2` +
          '&dateField=updatedAt&testCaseFQN=fqn&page=2&cursor=cursor-2&unrelated=x'
      );
    });

    await act(async () => {
      mockFilterBarProps.onClearAll();
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
      sortType: 'desc',
    });
    expect(mockFilterBarProps.hasActiveFilters).toBe(false);
    // Only the filters and the pager go: the dimension and what else shares
    // the query string stay.
    expect(Object.fromEntries(getSearchParams())).toEqual({
      groupBy: 'owner',
      unrelated: 'x',
    });
  });

  it('should round-trip the filters through the URL', async () => {
    await act(async () => {
      renderView();
    });

    await act(async () => {
      getDescriptor('status').onChange(['New', 'Assigned']);
    });

    await act(async () => {
      getDescriptor('dateRange').onChange({ startTs: 10, endTs: 20 });
    });

    // Written as the repeatable param the endpoint reads, then read back from
    // the URL into the request and into the controls.
    expect(getSearchParams().getAll('status')).toEqual(['New', 'Assigned']);
    expect(getDescriptor('status').value).toEqual(['New', 'Assigned']);
    expect(getDescriptor('dateRange').value).toEqual({
      startTs: 10,
      endTs: 20,
    });
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      status: ['New', 'Assigned'],
      startTs: 10,
      endTs: 20,
      limit: 10,
      sortType: 'desc',
    });
  });

  it('should keep the filter bar up when the fetch fails', async () => {
    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      renderView(`${BASE_PATH}?assignee=adam`);
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
  });

  it('should say the filters matched nothing rather than that nothing is open', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderView(`${BASE_PATH}?assignee=adam`);
    });

    expect(screen.getByTestId('incident-groups-empty')).toHaveTextContent(
      'message.no-data-available-for-selected-filter'
    );
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
  });
});

describe('IncidentGroupsView pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 30, after: 'cursor-2' },
    });
  });

  it('should size the pager from paging.total', async () => {
    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('pager-page')).toHaveTextContent('1');
    expect(screen.getByTestId('pager-total')).toHaveTextContent('3');
    expect(screen.getByTestId('pager-size')).toHaveTextContent('10');
  });

  it('should page forward by handing paging.after back verbatim', async () => {
    await act(async () => {
      renderView();
    });

    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 30, before: 'cursor-1', after: 'cursor-3' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-next'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      offset: 'cursor-2',
      sortType: 'desc',
    });
    expect(getSearchParams().get('page')).toBe('2');
    expect(getSearchParams().get('cursor')).toBe('cursor-2');
    expect(screen.getByTestId('pager-page')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-next'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 'cursor-3' })
    );
    expect(getSearchParams().get('page')).toBe('3');
  });

  it('should page backward by handing paging.before back verbatim', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 30, before: 'cursor-2-back' },
    });

    await act(async () => {
      renderView(`${BASE_PATH}?page=3&cursor=cursor-3`);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-previous'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 'cursor-2-back' })
    );
    expect(getSearchParams().get('page')).toBe('2');
    expect(getSearchParams().get('cursor')).toBe('cursor-2-back');
  });

  it('should return to the first page without a cursor', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 30, before: 'cursor-1', after: 'cursor-3' },
    });

    await act(async () => {
      renderView(`${BASE_PATH}?page=2&cursor=cursor-2`);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-previous'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
    });
    expect(getSearchParams().has('page')).toBe(false);
    expect(getSearchParams().has('cursor')).toBe(false);
  });

  it('should ignore a page change while a page is still loading', async () => {
    await act(async () => {
      renderView();
    });

    mockListIncidentGroups.mockReturnValue(new Promise(() => undefined));

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-next'));
    });

    // Page 1's `after` still in hand would lead to page 2 again, not page 3.
    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-next'));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(getSearchParams().get('page')).toBe('2');
    expect(getSearchParams().get('cursor')).toBe('cursor-2');
  });

  it('should step one page towards a page further away', async () => {
    await act(async () => {
      renderView();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-jump-ahead'));
    });

    // No cursor is ever computed for page 4: the only one there is leads to 2.
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 'cursor-2' })
    );
    expect(getSearchParams().get('page')).toBe('2');
  });

  it('should not move past the last page', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 3 },
    });

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('pager-total')).toHaveTextContent('1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-next'));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);
    expect(getSearchParams().has('page')).toBe(false);
  });

  it('should not move before the first page', async () => {
    await act(async () => {
      renderView();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-previous'));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);
  });

  it('should restart from page 1 at the new page size', async () => {
    await act(async () => {
      renderView(`${BASE_PATH}?page=2&cursor=cursor-2`);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pager-size-25'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 25,
      sortType: 'desc',
    });
    expect(getSearchParams().get('pageSize')).toBe('25');
    expect(getSearchParams().has('cursor')).toBe(false);
    expect(screen.getByTestId('pager-size')).toHaveTextContent('25');
  });

  it('should restart from page 1 when the dimension changes', async () => {
    await act(async () => {
      renderView(`${BASE_PATH}?groupBy=table&page=2&cursor=cursor-2`);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
      sortType: 'desc',
    });
    expect(getSearchParams().get('groupBy')).toBe('owner');
    expect(getSearchParams().has('page')).toBe(false);
    expect(getSearchParams().has('cursor')).toBe(false);
  });

  it('should restart from page 1 when the ordering changes', async () => {
    await act(async () => {
      renderView(`${BASE_PATH}?page=2&cursor=cursor-2`);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('flip-sort'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'asc',
    });
    expect(getSearchParams().has('cursor')).toBe(false);
  });

  it('should fall back to page 1 when a later page has emptied out', async () => {
    mockListIncidentGroups
      .mockResolvedValueOnce({ data: [], paging: { total: 3 } })
      .mockResolvedValue({ data: mockGroups, paging: { total: 3 } });

    await act(async () => {
      renderView(`${BASE_PATH}?page=2&cursor=cursor-2`);
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
    });
    expect(screen.getByTestId('table-group-count')).toHaveTextContent('3');
  });
});
