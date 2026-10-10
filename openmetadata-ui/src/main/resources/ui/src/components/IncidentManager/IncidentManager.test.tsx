/*
 *  Copyright 2023 Collate.
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
import { fireEvent, screen, within } from '@testing-library/react';
import QueryString from 'qs';
import React, { act } from 'react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { Table } from '../../generated/entity/data/table';
import { TestCasePageTabs } from '../../pages/IncidentManager/IncidentManager.interface';
import { getListTestCaseIncidentStatusFromSearch } from '../../rest/incidentManagerAPI';
import {
  renderWithQueryClient as render,
  runQueryNotificationsSynchronously,
} from '../../test/unit/test-utils';
import { getPastDaysRange } from '../../utils/date-time/calendarDate.utils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import IncidentManager from './IncidentManager.component';

jest.mock('../common/NextPrevious/NextPrevious', () => {
  return jest
    .fn()
    .mockImplementation(
      (props: {
        pagingHandler?: (params: { currentPage: number }) => void;
        currentPage?: number;
        onShowSizeChange?: (size: number) => void;
      }) => (
        <div data-testid="pagination">
          <span>NextPrevious.component</span>
          <button
            data-testid="pagination-next"
            type="button"
            onClick={() =>
              props.pagingHandler?.({
                currentPage: (props.currentPage ?? 1) + 1,
              })
            }>
            Next
          </button>
          <button
            data-testid="pagination-previous"
            type="button"
            onClick={() =>
              props.pagingHandler?.({
                currentPage: (props.currentPage ?? 1) - 1,
              })
            }>
            Previous
          </button>
          <button
            data-testid="pagination-page-2"
            type="button"
            onClick={() => props.pagingHandler?.({ currentPage: 2 })}>
            Page 2
          </button>
          <button
            data-testid="pagination-page-3"
            type="button"
            onClick={() => props.pagingHandler?.({ currentPage: 3 })}>
            Page 3
          </button>
          <button
            data-testid="pagination-page-size-25"
            type="button"
            onClick={() => props.onShowSizeChange?.(25)}>
            Page size 25
          </button>
        </div>
      )
    );
});
jest.mock('../DataQuality/IncidentManager/Severity/Severity.component', () => {
  return jest.fn().mockImplementation(({ onSubmit }) => (
    <button data-testid="severity-update" onClick={() => onSubmit('Severity2')}>
      Update Severity
    </button>
  ));
});
jest.mock('@openmetadata/ui-core-components', () => {
  const TableMock = Object.assign(
    ({
      children,
      'data-testid': testId,
      'aria-label': ariaLabel,
    }: {
      children?: React.ReactNode;
      'data-testid'?: string;
      'aria-label'?: string;
    }) => (
      <table aria-label={ariaLabel} data-testid={testId}>
        {children}
      </table>
    ),
    {
      Header: ({
        columns,
        children,
      }: {
        columns?: { id: string; label: string }[];
        children: (col: { id: string; label: string }) => React.ReactNode;
      }) => (
        <thead>
          <tr>
            {columns?.map((col) => (
              <th key={col.id}>{children(col)}</th>
            ))}
          </tr>
        </thead>
      ),
      Head: ({ label }: { label?: string }) => <span>{label}</span>,
      Body: ({
        items,
        children,
        renderEmptyState,
      }: {
        items?: unknown[];
        children: (item: unknown) => React.ReactNode;
        renderEmptyState?: () => React.ReactNode;
        dependencies?: unknown[];
      }) => (
        <tbody>
          {!items || items.length === 0 ? (
            <tr>
              <td>{renderEmptyState?.()}</td>
            </tr>
          ) : (
            items.map((item) => children(item))
          )}
        </tbody>
      ),
      Row: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <tr data-rowid={id}>{children}</tr>
      ),
      Cell: ({ children }: { children?: React.ReactNode }) => (
        <td>{children}</td>
      ),
    }
  );

  return {
    ...jest.requireActual('@openmetadata/ui-core-components'),
    EmptyPlaceholder: ({
      title,
      description,
    }: {
      title?: React.ReactNode;
      description?: React.ReactNode;
    }) => (
      <div data-testid="empty-placeholder">
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ),
    Skeleton: jest
      .fn()
      .mockImplementation(() => <div data-testid="skeleton" />),
    Table: TableMock,
    Owner: jest.fn().mockImplementation(() => <div>Owner</div>),
    toOwnerRefs: jest.requireActual('@openmetadata/ui-core-components')
      .toOwnerRefs,
    toOwnerRef: jest.requireActual('@openmetadata/ui-core-components')
      .toOwnerRef,
  };
});

jest.mock(
  '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TestCaseIncidentManagerStatus</div>);
  }
);
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, state, to, ...rest }) => (
    <a
      data-state={JSON.stringify(state)}
      data-to={typeof to === 'string' ? to : JSON.stringify(to)}
      {...rest}>
      {children}
    </a>
  )),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      testCase: {
        Create: true,
        Delete: true,
        EditAll: true,
        EditCustomFields: true,
        EditDataProfile: true,
        EditDescription: true,
        EditDisplayName: true,
        EditLineage: true,
        EditOwner: true,
        EditQueries: true,
        EditSampleData: true,
        EditSelect: true,
        EditTags: true,
        EditTests: true,
        EditTier: true,
        ViewAll: true,
        ViewBasic: true,
        ViewDataProfile: true,
        ViewQueries: true,
        ViewSampleData: true,
        ViewTests: true,
        ViewUsage: true,
      },
    },
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwner: true,
      EditQueries: true,
      EditSampleData: true,
      EditSelect: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewBasic: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    }),
  }),
}));

jest.mock('../../hooks/paging/usePaging', () => {
  const mockHandlePageChange = jest.fn();
  const mockHandlePagingChange = jest.fn();
  const mockHandlePageSizeChange = jest.fn();

  return {
    usePaging: jest.fn().mockReturnValue({
      currentPage: 1,
      paging: { after: '', before: '', total: 25 },
      showPagination: true,
      pageSize: 10,
      handlePageChange: mockHandlePageChange,
      handlePagingChange: mockHandlePagingChange,
      handlePageSizeChange: mockHandlePageSizeChange,
    }),
    mockHandlePageChange,
    mockHandlePagingChange,
    mockHandlePageSizeChange,
  };
});
jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatusFromSearch: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  updateTestCaseIncidentById: jest.fn(),
  postTestCaseIncidentStatus: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {},
    })
  ),
}));
jest.mock('../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));
jest.mock('../../rest/userAPI', () => ({
  getUsers: jest.fn().mockImplementation(() => Promise.resolve({ data: [] })),
  getUserByName: jest.fn().mockResolvedValue({ id: 'user-1', name: 'user1' }),
}));
jest.mock('../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockResolvedValue({ id: 'team-1', name: 'team1' }),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ hits: { hits: [], total: { value: 0 } } })
    ),
}));
jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: '',
  }));
});
jest.mock('../../utils/date-time/DateTimeUtils', () => {
  return {
    getEpochMillisForPastDays: jest
      .fn()
      .mockImplementation(() => 1709556624254),
    formatDateTime: jest.fn().mockImplementation(() => 'formatted date'),
    getCurrentMillis: jest.fn().mockImplementation(() => 1710161424255),
    getCurrentDayEndGMTinMillis: jest
      .fn()
      .mockImplementation(() => 1710161424255),
    getDayAgoStartGMTinMillis: jest
      .fn()
      .mockImplementation(() => 1709556624254),
    getStartOfDayInMillis: jest
      .fn()
      .mockImplementation((timestamp) => timestamp),
    getEndOfDayInMillis: jest.fn().mockImplementation((timestamp) => timestamp),
  };
});

jest.mock('../../utils/FqnUtils', () => ({
  getNameFromFQN: jest.fn().mockReturnValue('NameFromFQN'),
  getPartialNameFromTableFQN: jest.fn().mockReturnValue('PartialName'),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getTestCaseDetailPagePath: jest.fn().mockReturnValue('test-case-path'),
  getEntityDetailsPath: jest.fn().mockReturnValue('entity-details-path'),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../common/DateTimeDisplay/DateTimeDisplay', () => {
  return jest.fn().mockImplementation(() => <div>DateTimeDisplay</div>);
});

runQueryNotificationsSynchronously();

describe('IncidentManagerPage', () => {
  beforeEach(() => {
    require('../../hooks/useCustomLocation/useCustomLocation').mockReturnValue({
      search: '',
    });
    require('../../rest/searchAPI').searchQuery.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    });
  });

  it('names each AI-style filter even when its trigger shows a selected value', async () => {
    await act(async () => {
      render(<IncidentManager />);
    });

    for (const label of [
      'test-case',
      'assignee',
      'status',
      'date-filter',
      'date-range',
    ]) {
      expect(
        screen.getByRole('group', { name: `label.${label}` })
      ).toBeInTheDocument();
    }
  });

  it('should render component', async () => {
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(await screen.findByTestId('status-select')).toBeInTheDocument();
    expect(
      await screen.findByTestId('test-case-incident-manager-table')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'label.assignee' })
    ).toContainElement(screen.getByTestId('select-assignee'));
    expect(
      screen.getByRole('group', { name: 'label.test-case' })
    ).toContainElement(screen.getByTestId('test-case-select'));
    expect(
      screen.getByRole('group', { name: 'label.date-range' })
    ).toBeInTheDocument();
    expect(
      await screen.findByText('NextPrevious.component')
    ).toBeInTheDocument();
  });

  it('hides both date controls when the table caller disables the date range picker', async () => {
    await act(async () => {
      render(<IncidentManager isDateRangePickerVisible={false} />);
    });

    expect(
      screen.queryByRole('group', { name: 'label.date-filter' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'label.date-range' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('status-select')).toBeInTheDocument();
  });

  it('should call list incident API on page load', async () => {
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      latest: true,
      include: 'non-deleted',
      originEntityFQN: undefined,
      domain: undefined,
    });
  });

  it('should handle test case search', async () => {
    const mockSearchQuery = require('../../rest/searchAPI').searchQuery;
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'test_case_1',
              name: 'test_case_1',
              entityType: 'testCase',
            },
          },
        ],
      },
    });

    await act(async () => {
      render(<IncidentManager />);
    });

    const select = await screen.findByTestId('test-case-select');

    await act(async () => {
      fireEvent.click(select);
    });
    const option = await screen.findByTestId('test_case_1');

    expect(option).toHaveTextContent('test_case_1');

    await act(async () => {
      fireEvent.click(option);
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(require('react-router-dom').useNavigate()).toHaveBeenCalledWith(
      { search: 'testCaseFQN=test_case_1' },
      { replace: true }
    );
  });

  it('should handle status change', async () => {
    const mockUseNavigate = require('react-router-dom').useNavigate;
    const navigate = jest.fn();
    mockUseNavigate.mockReturnValue(navigate);

    await act(async () => {
      render(<IncidentManager />);
    });

    const select = await screen.findByTestId('status-select');
    await act(async () => {
      fireEvent.click(select);
    });

    const resolvedOption = await screen.findByTestId('Resolved');

    await act(async () => {
      fireEvent.click(resolvedOption);
    });

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining(
          'testCaseResolutionStatusType=Resolved'
        ),
      }),
      expect.anything()
    );
  });

  it('picks a user through the same user/team picker as AI mode', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    require('../../rest/searchAPI').searchQuery.mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: 'user-1',
              name: 'user1',
              displayName: 'User One',
              entityType: 'user',
            },
          },
        ],
      },
    });
    await act(async () => {
      render(<IncidentManager />);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-assignee'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /label.user-plural/ }));
    });
    const panel = screen.getByTestId('owner-select-users-panel');
    await act(async () => {
      fireEvent.click(within(panel).getByTestId('owner-option'));
    });

    expect(navigate).toHaveBeenCalledWith(
      { search: 'assignee=user1' },
      { replace: true }
    );
    expect(screen.queryByTestId('select-owner-tabs')).not.toBeInTheDocument();
  });

  it('clears a URL-selected assignee after reopening the picker without needing a combobox', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    require('../../hooks/useCustomLocation/useCustomLocation').mockReturnValue({
      search: 'assignee=user1&testCaseResolutionStatusType=Assigned',
    });
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(screen.getByTestId('select-assignee')).toHaveTextContent('user1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-assignee'));
    });
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId('owner-select-users-panel')).getByTestId(
          'remove-owner'
        )
      );
    });

    expect(navigate).toHaveBeenCalledWith(
      { search: 'testCaseResolutionStatusType=Assigned' },
      { replace: true }
    );
    expect(screen.queryByTestId('select-owner-tabs')).not.toBeInTheDocument();
  });

  it('restores a team assignee from the URL when the name is not a user', async () => {
    require('../../rest/userAPI').getUserByName.mockRejectedValueOnce(
      new Error('not a user')
    );
    require('../../hooks/useCustomLocation/useCustomLocation').mockReturnValue({
      search: 'assignee=team1',
    });
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(screen.getByTestId('select-assignee')).toHaveTextContent('team1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-assignee'));
    });

    expect(
      screen.getByRole('tab', { name: /label.team-plural/ })
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByTestId('owner-select-teams-panel')).getByTestId(
        'owner-option'
      )
    ).toHaveTextContent('team1');
  });

  it('should handle severity update', async () => {
    const mockGetList = getListTestCaseIncidentStatusFromSearch as jest.Mock;
    const updateTestCaseIncidentById =
      require('../../rest/incidentManagerAPI').updateTestCaseIncidentById;

    mockGetList.mockResolvedValue({
      data: [
        {
          id: 'test-id',
          testCaseReference: {
            fullyQualifiedName:
              'sample_service.sample_db.sample_schema.sample_table.test_case',
            name: 'test-name',
          },
          testCaseResolutionStatusType: 'New',
          severity: 'Severity1',
        },
      ],
      paging: { total: 1 },
    });

    await act(async () => {
      render(<IncidentManager />);
    });

    const severityBtn = await screen.findByTestId('severity-update');

    await act(async () => {
      fireEvent.click(severityBtn);
    });

    expect(updateTestCaseIncidentById).toHaveBeenCalledWith(
      'test-id',
      expect.anything() // json patch
    );
  });

  it('Incident should be fetch with updated time from URL', async () => {
    const mockUseCustomLocation = require('../../hooks/useCustomLocation/useCustomLocation');
    mockUseCustomLocation.mockImplementation(() => ({
      search: QueryString.stringify({
        endTs: 1710161424255,
        startTs: 1709556624254,
      }),
    }));

    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatusFromSearch as jest.Mock;
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(mockGetListTestCaseIncidentStatus).toHaveBeenCalledWith({
      endTs: 1710161424255,
      latest: true,
      limit: 10,
      offset: 0,
      startTs: 1709556624254,
      include: 'non-deleted',
      domain: undefined,
      originEntityFQN: undefined,
    });
  });

  it('Incident should be fetch with deleted', async () => {
    const mockUseCustomLocation = require('../../hooks/useCustomLocation/useCustomLocation');
    mockUseCustomLocation.mockImplementation(() => ({
      search: QueryString.stringify({
        endTs: 1710161424255,
        startTs: 1709556624254,
      }),
    }));

    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatusFromSearch as jest.Mock;
    await act(async () => {
      render(<IncidentManager tableDetails={{ deleted: true } as Table} />);
    });

    expect(mockGetListTestCaseIncidentStatus).toHaveBeenCalledWith({
      endTs: 1710161424255,
      latest: true,
      limit: 10,
      offset: 0,
      startTs: 1709556624254,
      include: 'deleted',
      domain: undefined,
      originEntityFQN: undefined,
    });
  });

  it('Should not ender table column if isIncidentManager is false', async () => {
    await act(async () => {
      render(<IncidentManager isIncidentPage={false} />);
    });

    expect(screen.queryByText('label.table')).not.toBeInTheDocument();
  });

  it('Should render table column if isIncidentManager is true', async () => {
    await act(async () => {
      render(<IncidentManager isIncidentPage />);
    });

    expect(screen.getByText('label.table')).toBeInTheDocument();
  });

  it('shows Created At by default and closes after picking Updated At', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    await act(async () => {
      render(<IncidentManager />);
    });
    const trigger = screen.getByTestId('sort-field-dropdown-trigger');

    expect(trigger).toHaveTextContent('label.created-at');

    await act(async () => {
      fireEvent.click(trigger);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('updatedAt'));
    });

    expect(navigate).toHaveBeenCalledWith(
      { search: 'dateField=updatedAt' },
      { replace: true }
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('commits a date preset only when Apply is pressed', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    await act(async () => {
      render(<IncidentManager />);
    });
    const field = screen.getByRole('group', { name: 'label.date-range' });
    await act(async () => {
      fireEvent.click(within(field).getByRole('button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    });

    expect(navigate).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    const params = QueryString.parse(navigate.mock.calls[0][0].search);

    const expectedRange = getPastDaysRange(0);

    expect({
      startTs: Number(params.startTs),
      endTs: Number(params.endTs),
    }).toEqual(expectedRange);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('discards a staged date range when Cancel is pressed', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    await act(async () => {
      render(<IncidentManager />);
    });
    const field = screen.getByRole('group', { name: 'label.date-range' });
    await act(async () => {
      fireEvent.click(within(field).getByRole('button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(within(field).getByRole('button')).toHaveTextContent('Select dates');
  });

  it('restores a date range from URL timestamps without needing legacy preset metadata', async () => {
    require('../../hooks/useCustomLocation/useCustomLocation').mockReturnValue({
      search: 'startTs=1709510400000&endTs=1710115199999',
    });
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(
      within(screen.getByRole('group', { name: 'label.date-range' })).getByRole(
        'button'
      )
    ).toHaveTextContent('2024');
  });

  it('clears all incident filters while preserving unrelated URL parameters', async () => {
    const navigate = jest.fn();
    require('react-router-dom').useNavigate.mockReturnValue(navigate);
    require('../../hooks/useCustomLocation/useCustomLocation').mockReturnValue({
      search: QueryString.stringify({
        testCaseFQN: 'test_case_1',
        assignee: 'user1',
        testCaseResolutionStatusType: 'Assigned',
        startTs: 1709510400000,
        endTs: 1710115199999,
        dateField: 'updatedAt',
        key: 'last7days',
        title: 'Last 7 days',
        domain: 'Finance',
      }),
    });
    await act(async () => {
      render(<IncidentManager />);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('incident-clear-filters'));
    });

    expect(navigate).toHaveBeenCalledWith(
      { search: 'domain=Finance' },
      { replace: true }
    );
  });

  it('should fetch incidents with dateField from URL params', async () => {
    const mockUseCustomLocation = require('../../hooks/useCustomLocation/useCustomLocation');
    mockUseCustomLocation.mockImplementation(() => ({
      search: QueryString.stringify({
        endTs: 1710161424255,
        startTs: 1709556624254,
        dateField: 'updatedAt',
      }),
    }));

    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatusFromSearch as jest.Mock;
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(mockGetListTestCaseIncidentStatus).toHaveBeenCalledWith({
      endTs: 1710161424255,
      latest: true,
      limit: 10,
      offset: 0,
      startTs: 1709556624254,
      dateField: 'updatedAt',
      include: 'non-deleted',
      domain: undefined,
      originEntityFQN: undefined,
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      const usePagingModule = require('../../hooks/paging/usePaging');
      const {
        usePaging,
        mockHandlePageChange,
        mockHandlePagingChange,
        mockHandlePageSizeChange,
      } = usePagingModule;
      usePaging.mockReturnValue({
        currentPage: 1,
        paging: { after: '', before: '', total: 25 },
        showPagination: true,
        pageSize: 10,
        handlePageChange: mockHandlePageChange,
        handlePagingChange: mockHandlePagingChange,
        handlePageSizeChange: mockHandlePageSizeChange,
      });
      (getListTestCaseIncidentStatusFromSearch as jest.Mock).mockResolvedValue({
        data: [],
        paging: { after: '', before: '', total: 25 },
      });
      mockHandlePageChange.mockClear();
      mockHandlePagingChange.mockClear();
      mockHandlePageSizeChange.mockClear();
    });

    it('should fetch next page when Next is clicked', async () => {
      const { mockHandlePageChange } = require('../../hooks/paging/usePaging');
      await act(async () => {
        render(<IncidentManager />);
      });

      const nextButton = await screen.findByTestId('pagination-next');
      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
        })
      );
      expect(mockHandlePageChange).toHaveBeenCalledWith(2);
    });

    it('should fetch previous page when Previous is clicked', async () => {
      const usePagingModule = require('../../hooks/paging/usePaging');
      const { usePaging, mockHandlePageChange } = usePagingModule;
      usePaging.mockReturnValue({
        currentPage: 2,
        paging: { after: '', before: '', total: 25 },
        showPagination: true,
        pageSize: 10,
        handlePageChange: mockHandlePageChange,
        handlePagingChange: usePagingModule.mockHandlePagingChange,
        handlePageSizeChange: jest.fn(),
      });

      await act(async () => {
        render(<IncidentManager />);
      });

      const previousButton = await screen.findByTestId('pagination-previous');
      await act(async () => {
        fireEvent.click(previousButton);
      });

      expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      );
      expect(mockHandlePageChange).toHaveBeenCalledWith(1);
    });

    it('should fetch correct page when page number is clicked', async () => {
      const { mockHandlePageChange } = require('../../hooks/paging/usePaging');
      await act(async () => {
        render(<IncidentManager />);
      });

      const page2Button = await screen.findByTestId('pagination-page-2');
      await act(async () => {
        fireEvent.click(page2Button);
      });

      expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
        })
      );
      expect(mockHandlePageChange).toHaveBeenCalledWith(2);

      const page3Button = await screen.findByTestId('pagination-page-3');
      await act(async () => {
        fireEvent.click(page3Button);
      });

      expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
      expect(mockHandlePageChange).toHaveBeenCalledWith(3);
    });

    it('should call handlePageSizeChange when page size dropdown is used', async () => {
      const {
        mockHandlePageSizeChange,
      } = require('../../hooks/paging/usePaging');
      await act(async () => {
        render(<IncidentManager />);
      });

      const pageSizeButton = await screen.findByTestId(
        'pagination-page-size-25'
      );
      await act(async () => {
        fireEvent.click(pageSizeButton);
      });

      expect(mockHandlePageSizeChange).toHaveBeenCalledWith(25);
    });
  });

  describe('observabilityRouterClassBase migration', () => {
    it('test case name link should use observabilityRouterClassBase.getTestCaseDetailPagePath', async () => {
      const fqn = 'svc.db.schema.table.test_case_1';
      const { getTestCaseDetailPagePath } = require('../../utils/RouterUtils');
      (getTestCaseDetailPagePath as jest.Mock).mockClear();

      (getListTestCaseIncidentStatusFromSearch as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'tcr-1',
            testCaseReference: {
              fullyQualifiedName: fqn,
              name: 'test_case_1',
            },
            testCaseResolutionStatusType: 'New',
          },
        ],
        paging: { total: 1 },
      });

      await act(async () => {
        render(<IncidentManager />);
      });

      const link = await screen.findByTestId('test-case-test_case_1');

      expect(link.tagName).toBe('A');
      expect(link.getAttribute('data-to')).toBe(
        observabilityRouterClassBase.getTestCaseDetailPagePath(
          fqn,
          TestCasePageTabs.TEST_CASE_RESULTS
        )
      );
      expect(getTestCaseDetailPagePath).toHaveBeenCalledWith(
        fqn,
        TestCasePageTabs.TEST_CASE_RESULTS
      );
      expect(JSON.parse(link.getAttribute('data-state') ?? '{}')).toEqual({
        breadcrumbData: [
          {
            name: 'label.incident-manager',
            url: '/incident-manager',
          },
        ],
      });
    });
  });

  describe('permission gating (useIncidentManagerListPage.commonTestCasePermission)', () => {
    // usePermissionProvider is called more than once per render (this component plus
    // useIncidentManagerListPage internally), so `mockReturnValueOnce` only overrides the
    // FIRST call and silently falls back to the granted default for the rest — use a
    // persistent override for the duration of this test, restored afterward so later tests
    // (and other describe blocks, if this file's order ever changes) keep the granted default.
    const grantedReturnValue = (
      usePermissionProvider as jest.Mock
    ).getMockImplementation?.();

    afterEach(() => {
      if (grantedReturnValue) {
        (usePermissionProvider as jest.Mock).mockImplementation(
          grantedReturnValue
        );
      }
    });

    it('shows the permission placeholder instead of the table when neither ViewAll nor ViewBasic is granted', async () => {
      (usePermissionProvider as jest.Mock).mockReturnValue({
        permissions: {
          testCase: {
            ViewAll: false,
            ViewBasic: false,
          },
        },
        getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
      });

      await act(async () => {
        render(<IncidentManager />);
      });

      expect(
        await screen.findByTestId('permission-error-placeholder')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('test-case-incident-manager-table')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('incident-filter-bar')
      ).not.toBeInTheDocument();
    });
  });
});
