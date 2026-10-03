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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { RouteVisibilityProvider } from '../../../../context/RouteVisibilityProvider/RouteVisibilityProvider';
import {
  Severities as CreateSeverities,
  TestCaseResolutionStatusTypes as CreateStatusTypes,
} from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import {
  IncidentGroupBy,
  IncidentTrendDirection,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { listIncidentGroups } from '../../../../rest/incidentManagerAPI';
import {
  showErrorToast as mockShowError,
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../../utils/ToastUtils';
import {
  IncidentGroupBulkFailuresModalProps,
  IncidentGroupBulkStatusModalProps,
  IncidentGroupByDropdownProps,
  IncidentGroupDetailProps,
  IncidentGroupDrawerProps,
  IncidentGroupsFiltersProps,
  IncidentGroupsSelectionBarProps,
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
  showInfoToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockApplyBulkChange = jest.fn();

jest.mock('./useIncidentGroupBulkUpdate', () => ({
  useIncidentGroupBulkUpdate: () => ({
    isApplying: false,
    applyBulkChange: mockApplyBulkChange,
  }),
}));

jest.mock('./IncidentGroupsSelectionBar', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        selectedCount,
        incidentCount,
        onSetStatus,
        onSetSeverity,
        onClearSelection,
      }: IncidentGroupsSelectionBarProps) => (
        <div data-testid="selection-bar">
          <span data-testid="selected-count">{selectedCount}</span>
          <span data-testid="selected-incidents">{incidentCount}</span>
          <button
            data-testid="bulk-ack"
            onClick={() => onSetStatus(CreateStatusTypes.ACK)}>
            ack
          </button>
          <button
            data-testid="bulk-assign"
            onClick={() => onSetStatus(CreateStatusTypes.Assigned)}>
            assign
          </button>
          <button
            data-testid="bulk-severity"
            onClick={() => onSetSeverity(CreateSeverities.Severity2)}>
            severity
          </button>
          <button data-testid="bulk-clear" onClick={onClearSelection}>
            clear
          </button>
        </div>
      )
    )
);

jest.mock('./IncidentGroupBulkStatusModal', () =>
  jest
    .fn()
    .mockImplementation(
      ({ status, onApply, onCancel }: IncidentGroupBulkStatusModalProps) =>
        status ? (
          <div data-testid="bulk-status-modal">
            <span data-testid="bulk-status-modal-status">{status}</span>
            <button
              data-testid="bulk-status-modal-apply"
              onClick={() =>
                onApply({ assignee: { id: 'user-a', type: 'user' } })
              }>
              apply
            </button>
            <button data-testid="bulk-status-modal-cancel" onClick={onCancel}>
              cancel
            </button>
          </div>
        ) : null
    )
);

jest.mock('./IncidentGroupBulkFailuresModal', () =>
  jest
    .fn()
    .mockImplementation(
      ({ outcome, onClose }: IncidentGroupBulkFailuresModalProps) =>
        outcome ? (
          <div data-testid="bulk-failures-modal">
            <span data-testid="bulk-failures-count">
              {outcome.failures.length}
            </span>
            <button data-testid="bulk-failures-close" onClick={onClose}>
              close
            </button>
          </div>
        ) : null
    )
);

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
      ({
        groups,
        sortType,
        onSortTypeChange,
        onGroupPreview,
        onGroupOpen,
        onGroupSelect,
        onPageSelect,
        selectedKeys,
      }: IncidentGroupsTableProps) => (
        <div data-testid="incident-groups-table">
          <span data-testid="table-group-count">{groups.length}</span>
          <span data-testid="table-sort-type">{sortType}</span>
          <button
            data-testid="flip-sort"
            onClick={() => onSortTypeChange('asc')}>
            asc
          </button>
          <button
            data-testid="preview-first-group"
            onClick={() => onGroupPreview(groups[0])}>
            preview
          </button>
          <span data-testid="table-selected-count">{selectedKeys.size}</span>
          <button
            data-testid="select-first-group"
            onClick={() => onGroupSelect(groups[0], true)}>
            select
          </button>
          <button
            data-testid="deselect-first-group"
            onClick={() => onGroupSelect(groups[0], false)}>
            deselect
          </button>
          <button
            data-testid="select-all-groups"
            onClick={() => onPageSelect(true)}>
            select all
          </button>
          <button
            // The real chevron is keyed the way the view looks it up to restore focus.
            data-testid={`group-open-${groups[0]?.id ?? groups[0]?.name}`}
            onClick={() => onGroupOpen(groups[0])}>
            open
          </button>
        </div>
      )
    )
);

jest.mock('./IncidentGroupDrawer', () =>
  jest
    .fn()
    .mockImplementation(
      ({ group, onClose, onViewAll }: IncidentGroupDrawerProps) =>
        group ? (
          <div data-testid="incident-group-drawer">
            <span data-testid="drawer-group">{group.name}</span>
            <button data-testid="drawer-close" onClick={onClose}>
              close
            </button>
            <button
              data-testid="drawer-view-all"
              onClick={() => onViewAll(group)}>
              view all
            </button>
          </div>
        ) : null
    )
);

jest.mock('./IncidentGroupDetail', () =>
  jest
    .fn()
    .mockImplementation(({ group, onBack }: IncidentGroupDetailProps) => (
      <div data-testid="incident-group-detail">
        <span data-testid="detail-group">{`${group.name}:${group.incidentCount}`}</span>
        <button data-testid="detail-back" onClick={onBack}>
          back
        </button>
      </div>
    ))
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
    id: 'def-unique',
    name: 'columnValuesToBeUnique',
    incidentCount: 5,
    trendDirection: IncidentTrendDirection.Rising,
  },
  {
    groupBy: IncidentGroupBy.TestDefinition,
    id: 'def-row-count',
    name: 'tableRowCountToEqual',
    incidentCount: 3,
    trendDirection: IncidentTrendDirection.Rising,
  },
  {
    groupBy: IncidentGroupBy.TestDefinition,
    id: 'def-not-null',
    name: 'columnValuesToBeNotNull',
    incidentCount: 1,
    trendDirection: IncidentTrendDirection.Falling,
  },
];

const renderView = (initialEntry = '/observability/incident-manager') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IncidentGroupsView />
      <LocationSearch />
    </MemoryRouter>
  );

// A bulk change that went through is what re-reads the groups on screen.
const applyBulkAck = async () => {
  fireEvent.click(screen.getByTestId('select-first-group'));
  await act(async () => {
    fireEvent.click(screen.getByTestId('bulk-ack'));
  });
};

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

  it('should keep the rows and the stats on screen while a bulk change is re-read', async () => {
    mockApplyBulkChange.mockResolvedValue({
      total: 1,
      passed: 1,
      failures: [],
      unchanged: 0,
    });
    await act(async () => {
      renderView();
    });

    let resolveRefresh: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    await applyBulkAck();

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

  it('should leave the rows in place when a bulk change fails to re-read', async () => {
    mockApplyBulkChange.mockResolvedValue({
      total: 1,
      passed: 1,
      failures: [],
      unchanged: 0,
    });
    await act(async () => {
      renderView();
    });

    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await applyBulkAck();

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

  it('should own the loader and the error when a bulk change lands on an empty table', async () => {
    let resolveBulk: (value: unknown) => void = jest.fn();
    mockApplyBulkChange.mockReturnValue(
      new Promise((resolve) => {
        resolveBulk = resolve;
      })
    );
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=testDefinition');
    });

    await applyBulkAck();

    // The dimension switch never settles, so its rows never reach the table.
    mockListIncidentGroups.mockReturnValue(new Promise(() => undefined));

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      resolveBulk({ total: 1, passed: 1, failures: [], unchanged: 0 });
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
    mockApplyBulkChange.mockResolvedValue({
      total: 1,
      passed: 1,
      failures: [],
      unchanged: 0,
    });
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    mockListIncidentGroups.mockResolvedValueOnce(secondPage);

    await applyBulkAck();

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 2,
    });
    expect(currentPageInput()).toHaveValue('2');
  });

  it('should step back to the last page when a refresh empties the current one', async () => {
    mockApplyBulkChange.mockResolvedValue({
      total: 1,
      passed: 1,
      failures: [],
      unchanged: 0,
    });
    await act(async () => {
      renderView();
    });
    await goToSecondPage();

    mockListIncidentGroups.mockResolvedValueOnce({
      data: [],
      paging: { total: 10 },
    });

    await applyBulkAck();

    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
      sortType: 'desc',
      page: 1,
    });
    expect(currentPageInput()).toHaveValue('1');
    expect(
      screen.queryByTestId('incident-groups-empty')
    ).not.toBeInTheDocument();
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

  it('should scope the groups to the active domain', async () => {
    useDomainStore.setState({ activeDomain: 'Marketing' });

    try {
      await act(async () => {
        renderView();
      });

      expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
        groupBy: IncidentGroupBy.TestDefinition,
        limit: 10,
        sortType: 'desc',
        page: 1,
        domain: 'Marketing',
      });
    } finally {
      useDomainStore.setState({ activeDomain: DEFAULT_DOMAIN_VALUE });
    }
  });

  it('should preview a group in the drawer and close it again', async () => {
    await act(async () => {
      renderView();
    });

    expect(
      screen.queryByTestId('incident-group-drawer')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('preview-first-group'));

    expect(screen.getByTestId('drawer-group')).toHaveTextContent(
      'columnValuesToBeUnique'
    );

    fireEvent.click(screen.getByTestId('drawer-close'));

    expect(
      screen.queryByTestId('incident-group-drawer')
    ).not.toBeInTheDocument();
  });

  it('should drill into a group in place of the groups and come back to them', async () => {
    await act(async () => {
      renderView();
    });

    fireEvent.click(screen.getByTestId('group-open-def-unique'));

    expect(screen.getByTestId('detail-group')).toHaveTextContent(
      'columnValuesToBeUnique:5'
    );
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('filters-state')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('detail-back'));

    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('group-open-def-unique')).toHaveFocus()
    );
  });

  it('should keep the groups page across a drill-down', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 25, after: 'cursor-2' },
    });

    await act(async () => {
      renderView();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    fireEvent.click(screen.getByTestId('group-open-def-unique'));
    fireEvent.click(screen.getByTestId('detail-back'));

    expect(screen.getByRole('textbox', { name: 'Current page' })).toHaveValue(
      '2'
    );
  });

  it('should open the drill-down from the drawer', async () => {
    await act(async () => {
      renderView();
    });

    fireEvent.click(screen.getByTestId('preview-first-group'));
    fireEvent.click(screen.getByTestId('drawer-view-all'));

    expect(
      screen.queryByTestId('incident-group-drawer')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-group')).toHaveTextContent(
      'columnValuesToBeUnique'
    );
  });

  it('should show the drilled-into group as the latest read has it', async () => {
    let resolveBulk: (value: unknown) => void = jest.fn();
    mockApplyBulkChange.mockReturnValue(
      new Promise((resolve) => {
        resolveBulk = resolve;
      })
    );
    await act(async () => {
      renderView();
    });

    // A bulk change still running when the user drills into a group re-reads
    // the groups under the drill-down once it lands.
    await applyBulkAck();
    fireEvent.click(screen.getByTestId('group-open-def-unique'));
    mockListIncidentGroups.mockResolvedValue({
      data: [{ ...mockGroups[0], incidentCount: 7 }, ...mockGroups.slice(1)],
      paging: { total: 5 },
    });

    await act(async () => {
      resolveBulk({ total: 1, passed: 1, failures: [], unchanged: 0 });
    });

    expect(screen.getByTestId('detail-group')).toHaveTextContent(
      'columnValuesToBeUnique:7'
    );
  });

  it('should put the drill-down in the URL and read its group on its own', async () => {
    await act(async () => {
      renderView();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('group-open-def-unique'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'group=def-unique'
    );
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ group: 'def-unique', limit: 1 })
    );
  });

  it('should reopen the drill-down a link names, wherever its group is', async () => {
    mockListIncidentGroups.mockImplementation(
      async ({ group }: { group?: string }) =>
        group === undefined
          ? { data: mockGroups.slice(0, 2), paging: { total: 25 } }
          : { data: [mockGroups[2]], paging: { total: 1 } }
    );

    await act(async () => {
      renderView('/observability/incident-manager?group=def-not-null');
    });

    expect(screen.getByTestId('detail-group')).toHaveTextContent(
      'columnValuesToBeNotNull:1'
    );
  });

  it('should say so when the linked group has no open incident left', async () => {
    mockListIncidentGroups.mockImplementation(
      async ({ group }: { group?: string }) =>
        group === undefined
          ? { data: mockGroups, paging: { total: 5 } }
          : { data: [], paging: { total: 0 } }
    );

    await act(async () => {
      renderView(
        '/observability/incident-manager?groupBy=testDefinition&group=gone'
      );
    });

    expect(
      screen.getByTestId('incident-group-detail-missing')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'label.back-to-group-plural' })
      );
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?groupBy=testDefinition'
    );
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should wait for the linked group before showing its drill-down', async () => {
    mockListIncidentGroups.mockImplementation(({ group }: { group?: string }) =>
      group === undefined
        ? Promise.resolve({ data: [], paging: { total: 0 } })
        : new Promise(jest.fn())
    );

    await act(async () => {
      renderView('/observability/incident-manager?group=def-unique');
    });

    expect(
      screen.getByTestId('incident-group-detail-loader')
    ).toBeInTheDocument();
  });

  it('should report a failed read of the linked group', async () => {
    mockListIncidentGroups.mockImplementation(
      async ({ group }: { group?: string }) => {
        if (group !== undefined) {
          throw new Error('failure');
        }

        return { data: [], paging: { total: 0 } };
      }
    );

    await act(async () => {
      renderView('/observability/incident-manager?group=def-unique');
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(
      screen.getByTestId('incident-group-detail-missing')
    ).toBeInTheDocument();
  });

  it('should hide the drawer while the page is kept hidden behind another route', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/observability/incident-manager']}>
        <IncidentGroupsView />
      </MemoryRouter>
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId('preview-first-group'));

    expect(screen.getByTestId('incident-group-drawer')).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/observability/incident-manager']}>
        <RouteVisibilityProvider isVisible={false}>
          <IncidentGroupsView />
        </RouteVisibilityProvider>
      </MemoryRouter>
    );

    expect(
      screen.queryByTestId('incident-group-drawer')
    ).not.toBeInTheDocument();
  });

  describe('bulk changes', () => {
    beforeEach(() => {
      mockApplyBulkChange.mockResolvedValue({
        total: 3,
        passed: 3,
        failures: [],
        unchanged: 0,
      });
    });

    const renderSelected = async () => {
      await act(async () => {
        renderView();
      });
      fireEvent.click(screen.getByTestId('select-first-group'));
    };

    it('should offer the bulk actions only once a group is selected', async () => {
      await act(async () => {
        renderView();
      });

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('select-first-group'));

      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('bulk-clear'));

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
    });

    it('should count every loaded group when all are selected', async () => {
      await act(async () => {
        renderView();
      });

      fireEvent.click(screen.getByTestId('select-all-groups'));

      expect(screen.getByTestId('selected-count')).toHaveTextContent('3');
    });

    it('should acknowledge the selected groups straight away and re-read them', async () => {
      await renderSelected();
      const reads = mockListIncidentGroups.mock.calls.length;

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-ack'));
      });

      expect(mockApplyBulkChange).toHaveBeenCalledWith([mockGroups[0]], {
        kind: 'status',
        status: CreateStatusTypes.ACK,
      });
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.bulk-incident-update-success:3'
      );
      expect(mockListIncidentGroups.mock.calls.length).toBeGreaterThan(reads);
      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
    });

    it('should ask for the assignee before assigning', async () => {
      await renderSelected();

      fireEvent.click(screen.getByTestId('bulk-assign'));

      expect(mockApplyBulkChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('bulk-status-modal-status')).toHaveTextContent(
        CreateStatusTypes.Assigned
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-status-modal-apply'));
      });

      expect(mockApplyBulkChange).toHaveBeenCalledWith([mockGroups[0]], {
        kind: 'status',
        status: CreateStatusTypes.Assigned,
        details: { assignee: { id: 'user-a', type: 'user' } },
      });
      expect(screen.queryByTestId('bulk-status-modal')).not.toBeInTheDocument();
    });

    it('should drop a pending status when its details are cancelled', async () => {
      await renderSelected();

      fireEvent.click(screen.getByTestId('bulk-assign'));
      fireEvent.click(screen.getByTestId('bulk-status-modal-cancel'));

      expect(screen.queryByTestId('bulk-status-modal')).not.toBeInTheDocument();
      expect(mockApplyBulkChange).not.toHaveBeenCalled();
    });

    it('should change the severity of the selected groups', async () => {
      await renderSelected();

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-severity'));
      });

      expect(mockApplyBulkChange).toHaveBeenCalledWith([mockGroups[0]], {
        kind: 'severity',
        severity: CreateSeverities.Severity2,
      });
    });

    it('should list every incident a partial change could not update', async () => {
      mockApplyBulkChange.mockResolvedValue({
        total: 3,
        passed: 1,
        failures: [{ message: 'a' }, { message: 'b' }],
        unchanged: 0,
      });
      await renderSelected();

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-ack'));
      });

      expect(screen.getByTestId('bulk-failures-count')).toHaveTextContent('2');
      expect(showSuccessToast).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('bulk-failures-close'));

      expect(
        screen.queryByTestId('bulk-failures-modal')
      ).not.toBeInTheDocument();
    });

    it('should say how many incidents it skipped', async () => {
      mockApplyBulkChange.mockResolvedValue({
        total: 2,
        passed: 2,
        failures: [],
        unchanged: 3,
      });
      await renderSelected();

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-ack'));
      });

      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.bulk-incident-update-success-skipped:2'
      );
    });

    it('should keep the selection across pages, and drop it for other filters', async () => {
      await renderSelected();

      expect(screen.getByTestId('selected-incidents')).toHaveTextContent('5');

      await act(async () => {
        fireEvent.click(screen.getByTestId('next'));
      });

      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
      expect(screen.getByTestId('table-selected-count')).toHaveTextContent('1');

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-assignee'));
      });

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
    });

    it('should drop the selection when the active domain changes', async () => {
      await renderSelected();

      expect(screen.getByTestId('selection-bar')).toBeInTheDocument();

      try {
        await act(async () => {
          useDomainStore.setState({ activeDomain: 'Marketing' });
        });

        expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      } finally {
        useDomainStore.setState({ activeDomain: DEFAULT_DOMAIN_VALUE });
      }
    });

    it('should drop a group from the selection', async () => {
      await renderSelected();

      fireEvent.click(screen.getByTestId('deselect-first-group'));

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
    });

    it('should say so when no incident needed the change', async () => {
      mockApplyBulkChange.mockResolvedValue({
        total: 0,
        passed: 0,
        failures: [],
        unchanged: 3,
      });
      await renderSelected();

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-ack'));
      });

      expect(showInfoToast).toHaveBeenCalledWith(
        'message.bulk-incident-no-change'
      );
    });

    it('should report a bulk change that failed outright', async () => {
      mockApplyBulkChange.mockRejectedValue(new Error('failure'));
      await renderSelected();

      await act(async () => {
        fireEvent.click(screen.getByTestId('bulk-ack'));
      });

      expect(mockShowError).toHaveBeenCalled();
    });
  });
});
