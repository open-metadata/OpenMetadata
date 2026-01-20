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
import { fireEvent, render, screen } from '@testing-library/react';
import QueryString from 'qs';
import { act } from 'react';
import { Table } from '../../generated/entity/data/table';
import { getListTestCaseIncidentStatusFromSearch } from '../../rest/incidentManagerAPI';
import '../../test/unit/mocks/mui.mock';
import IncidentManager from './IncidentManager.component';

jest.mock('../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
jest.mock('../DataQuality/IncidentManager/Severity/Severity.component', () => {
  return jest.fn().mockImplementation(({ onSubmit }) => (
    <button data-testid="severity-update" onClick={() => onSubmit('Severity2')}>
      Update Severity
    </button>
  ));
});
jest.mock('../common/MuiDatePickerMenu/MuiDatePickerMenu', () => {
  return jest.fn().mockImplementation(({ handleDateRangeChange }) => (
    <div>
      <p>DatePickerMenu.component</p>
      <button
        data-testid="time-filter"
        onClick={() =>
          handleDateRangeChange({
            startTs: 1709556624254,
            endTs: 1710161424255,
            key: 'last7days',
            title: 'Last 7 days',
          })
        }>
        time filter
      </button>
    </div>
  ));
});
jest.mock('../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));
jest.mock(
  '../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TestCaseIncidentManagerStatus</div>);
  }
);
jest.mock('../../pages/TasksPage/shared/Assignees', () => {
  return jest.fn().mockImplementation(({ onChange }) => (
    <div>
      <p>Assignees.component</p>
      <button
        data-testid="assignee-change-btn"
        onClick={() => onChange([{ name: 'user1' }])}>
        Change Assignee
      </button>
    </div>
  ));
});
jest.mock('../common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest
    .fn()
    .mockImplementation(({ 'data-testid': testId }) => (
      <div data-testid={testId}>AsyncSelect.component</div>
    )),
}));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
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

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    showPagination: true,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));
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
}));
jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ hits: { hits: [] } })),
}));
jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: QueryString.stringify({
      endTs: 1710161424255,
      startTs: 1709556624254,
    }),
  }));
});
jest.mock('../../utils/date-time/DateTimeUtils', () => {
  return {
    getEpochMillisForPastDays: jest
      .fn()
      .mockImplementation(() => 1709556624254),
    formatDateTime: jest.fn().mockImplementation(() => 'formatted date'),
    getCurrentMillis: jest.fn().mockImplementation(() => 1710161424255),
    getStartOfDayInMillis: jest
      .fn()
      .mockImplementation((timestamp) => timestamp),
    getEndOfDayInMillis: jest.fn().mockImplementation((timestamp) => timestamp),
  };
});

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('EntityName'),
}));

jest.mock('../../utils/CommonUtils', () => ({
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

describe('IncidentManagerPage', () => {
  it('should render component', async () => {
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(await screen.findByTestId('status-select')).toBeInTheDocument();
    expect(
      await screen.findByTestId('test-case-incident-manager-table')
    ).toBeInTheDocument();
    expect(await screen.findByText('Assignees.component')).toBeInTheDocument();
    expect(
      await screen.findByText('AsyncSelect.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DatePickerMenu.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('NextPrevious.component')
    ).toBeInTheDocument();
  });

  it('should call list incident API on page load', async () => {
    await act(async () => {
      render(<IncidentManager />);
    });

    expect(getListTestCaseIncidentStatusFromSearch).toHaveBeenCalledWith({
      limit: 10,
      latest: true,
      include: 'non-deleted',
      originEntityFQN: undefined,
      domain: undefined,
      startTs: 1709556624254,
      endTs: 1710161424255,
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

    expect(select).toBeInTheDocument();
  });

  it('should handle status change', async () => {
    const mockUseNavigate = require('react-router-dom').useNavigate;
    const navigate = jest.fn();
    mockUseNavigate.mockReturnValue(navigate);

    await act(async () => {
      render(<IncidentManager />);
    });

    const select = await screen.findByTestId('status-select');
    const selectBox = select.querySelector('.ant-select-selector');

    expect(selectBox).toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseDown(selectBox!);
    });

    const resolvedOption = await screen.findByText('label.resolved');

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

  it('should handle assignee change', async () => {
    const mockUseNavigate = require('react-router-dom').useNavigate;
    const navigate = jest.fn();
    mockUseNavigate.mockReturnValue(navigate);

    await act(async () => {
      render(<IncidentManager />);
    });

    const assigneeBtn = await screen.findByTestId('assignee-change-btn');

    await act(async () => {
      fireEvent.click(assigneeBtn);
    });

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.stringContaining('assignee=user1'),
      }),
      expect.anything()
    );
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

  it('Incident should be fetch with updated time', async () => {
    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatusFromSearch as jest.Mock;
    await act(async () => {
      render(<IncidentManager />);
    });

    const timeFilterButton = await screen.findByTestId('time-filter');

    await act(async () => {
      fireEvent.click(timeFilterButton);
    });

    expect(mockGetListTestCaseIncidentStatus).toHaveBeenCalledWith({
      endTs: 1710161424255,
      latest: true,
      limit: 10,
      startTs: 1709556624254,
      include: 'non-deleted',
      domain: undefined,
      originEntityFQN: undefined,
    });
  });

  it('Incident should be fetch with deleted', async () => {
    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatusFromSearch as jest.Mock;
    await act(async () => {
      render(<IncidentManager tableDetails={{ deleted: true } as Table} />);
    });

    const timeFilterButton = await screen.findByTestId('time-filter');

    await act(async () => {
      fireEvent.click(timeFilterButton);
    });

    expect(mockGetListTestCaseIncidentStatus).toHaveBeenCalledWith({
      endTs: 1710161424255,
      latest: true,
      limit: 10,
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
});
