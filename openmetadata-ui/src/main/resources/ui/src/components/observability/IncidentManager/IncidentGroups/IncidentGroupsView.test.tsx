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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { listIncidentGroups } from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  IncidentGroupByDropdownProps,
  IncidentGroupsFiltersProps,
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

jest.mock('./IncidentGroupsFilters', () =>
  jest
    .fn()
    .mockImplementation(({ filters, onChange }: IncidentGroupsFiltersProps) => (
      <div>
        <span data-testid="filters-state">{JSON.stringify(filters)}</span>
        <button
          aria-label="filter-assignee"
          data-testid="filter-assignee"
          onClick={() => onChange({ assignee: 'aaron' })}
        />
        <button
          aria-label="filter-status"
          data-testid="filter-status"
          onClick={() =>
            onChange({
              status: [
                TestCaseResolutionStatusTypes.New,
                TestCaseResolutionStatusTypes.ACK,
              ],
            })
          }
        />
        <button
          aria-label="filter-clear-status"
          data-testid="filter-clear-status"
          onClick={() => onChange({ status: [] })}
        />
      </div>
    ))
);

// Same press sequence react-aria listens for; a bare click does not open its
// Select.
const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

const LocationSearch = () => {
  const { search } = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <span data-testid="location-search">{search}</span>
      {/* Stands in for the incident table below, which writes its own paging
          params into the same query string. */}
      <button
        aria-label="write-unrelated-param"
        data-testid="write-unrelated-param"
        onClick={() =>
          navigate({ search: `${search}&currentPage=3` }, { replace: true })
        }
      />
    </>
  );
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
      '5 label.group-lowercase-plural'
    );
    expect(
      screen.getByTestId('incident-groups-recurring-count')
    ).toHaveTextContent('2 label.recurring-lowercase');
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
      page: 1,
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
    expect(
      screen.queryByTestId('incident-groups-count')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
  });

  it('should say so in the section, not in a toast, when the first read fails, and retry it', async () => {
    mockListIncidentGroups.mockRejectedValueOnce(new Error('failure'));

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should tell filtered-out groups from having no incidents, and clear the filters', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderView('/observability/incident-manager?assignee=aaron');
    });

    expect(screen.getByTestId('incident-groups-no-match')).toHaveTextContent(
      'message.no-match-found'
    );
    expect(
      screen.queryByTestId('incident-groups-empty')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'label.clear-filter-plural' })
      );
    });

    expect(screen.getByTestId('location-search')).not.toHaveTextContent(
      'assignee'
    );
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
      page: 1,
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
      page: 1,
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
      page: 1,
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
    // The filters in the URL survive the switch and keep applying.
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'assignee=adam'
    );
    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
      sortType: 'desc',
      page: 1,
      assignee: 'adam',
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
      '5 label.group-lowercase-plural'
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
    expect(
      screen.queryByTestId('incident-groups-count')
    ).not.toBeInTheDocument();

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

describe('IncidentGroupsView filters and paging', () => {
  const firstPage = {
    data: mockGroups,
    paging: { total: 25, after: 'cursor-2' },
  };
  const secondPage = {
    data: mockGroups,
    paging: { total: 25, before: 'cursor-1', after: 'cursor-3' },
  };

  const currentPageInput = () =>
    screen.getByRole('textbox', { name: 'Current page' });

  const goToSecondPage = async () => {
    mockListIncidentGroups.mockResolvedValueOnce(secondPage);

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListIncidentGroups.mockResolvedValue(firstPage);
  });

  it('should send the filters the URL carries with the groups request', async () => {
    await act(async () => {
      renderView(
        '/observability/incident-manager?testCaseFQN=svc.db.schema.orders.row_count' +
          '&assignee=aaron&status=New&status=Ack&dateField=updatedAt&startTs=1&endTs=2'
      );
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 1,
      testCaseFQN: 'svc.db.schema.orders.row_count',
      assignee: 'aaron',
      status: [
        TestCaseResolutionStatusTypes.New,
        TestCaseResolutionStatusTypes.ACK,
      ],
      dateField: 'updatedAt',
      startTs: 1,
      endTs: 2,
    });
  });

  it('should hand the parsed filters to the filter row', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?assignee=aaron');
    });

    expect(
      JSON.parse(screen.getByTestId('filters-state').textContent ?? '')
    ).toEqual({
      assignee: 'aaron',
      status: [],
      dateField: 'timestamp',
    });
  });

  it('should write a filter change to the URL and refetch with it', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('filter-status'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'groupBy=table&status=New&status=Ack'
    );
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Table,
      limit: 10,
      sortType: 'desc',
      page: 1,
      status: [
        TestCaseResolutionStatusTypes.New,
        TestCaseResolutionStatusTypes.ACK,
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('filter-clear-status'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'groupBy=table'
    );
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Table,
      limit: 10,
      sortType: 'desc',
      page: 1,
    });
  });

  it('should not refetch when a param it does not read changes', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table');
    });

    const callCount = mockListIncidentGroups.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('write-unrelated-param'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'currentPage=3'
    );
    expect(mockListIncidentGroups).toHaveBeenCalledTimes(callCount);
  });

  it('should page forward by page number', async () => {
    await act(async () => {
      renderView();
    });

    expect(currentPageInput()).toHaveValue('1');

    await goToSecondPage();

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 2,
    });
    expect(currentPageInput()).toHaveValue('2');
  });

  it('should page back by page number', async () => {
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('previous'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 1,
    });
    expect(currentPageInput()).toHaveValue('1');
  });

  it('should jump straight to any page and stop at the last one', async () => {
    await act(async () => {
      renderView();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 3,
    });
    expect(currentPageInput()).toHaveValue('3');
    expect(screen.getByTestId('next')).toBeDisabled();
  });

  it('should go back to the first page when a filter changes', async () => {
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('filter-assignee'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 1,
      assignee: 'aaron',
    });
    expect(currentPageInput()).toHaveValue('1');
  });

  it('should go back to the first page when the dimension changes', async () => {
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
      sortType: 'desc',
      page: 1,
    });
    expect(currentPageInput()).toHaveValue('1');
  });

  it('should go back to the first page when the ordering changes', async () => {
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId('flip-sort'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'asc',
      page: 1,
    });
    expect(currentPageInput()).toHaveValue('1');
  });

  it('should refetch the first page in the picked page size', async () => {
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    await act(async () => {
      press(
        within(screen.getByTestId('rows-per-page-dropdown')).getByRole('button')
      );
    });
    await act(async () => {
      press(screen.getByTestId('rows-per-page-option-25'));
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 25,
      sortType: 'desc',
      page: 1,
    });
    expect(currentPageInput()).toHaveValue('1');
  });

  it('should keep the page across a background refresh', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/observability/incident-manager']}>
        {viewTree(0)}
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
    });
    await goToSecondPage();

    mockListIncidentGroups.mockResolvedValueOnce(secondPage);

    await act(async () => {
      rerender(
        <MemoryRouter initialEntries={['/observability/incident-manager']}>
          {viewTree(1)}
        </MemoryRouter>
      );
    });

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 2,
    });
    expect(currentPageInput()).toHaveValue('2');
  });

  it('should show no pager while there is no group to page through', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderView();
    });

    expect(screen.queryByTestId('next')).not.toBeInTheDocument();
  });

  it('should size the pager from the loaded groups when no total is reported', async () => {
    mockListIncidentGroups.mockResolvedValue({ data: mockGroups, paging: {} });

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-count')).toHaveTextContent(
      '3 label.group-lowercase-plural'
    );
    expect(currentPageInput()).toHaveAttribute('max', '1');
  });

  it('should ignore a slow response for a dimension the user already left', async () => {
    let resolveFirst: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      })
    );
    mockListIncidentGroups.mockResolvedValueOnce({
      data: [mockGroups[0]],
      paging: { total: 1 },
    });

    renderView();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });
    await act(async () => {
      resolveFirst(firstPage);
    });

    expect(screen.getByTestId('table-group-count')).toHaveTextContent('1');
  });

  it('should read a single group in the singular', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [mockGroups[0]],
      paging: { total: 1 },
    });

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-count')).toHaveTextContent(
      '1 label.group-lowercase'
    );
  });
});
