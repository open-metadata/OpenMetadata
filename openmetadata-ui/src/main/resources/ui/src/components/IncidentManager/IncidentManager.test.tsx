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
import { act, fireEvent, render, screen } from '@testing-library/react';
import QueryString from 'qs';
import { Table } from '../../generated/entity/data/table';
import { MOCK_PERMISSIONS } from '../../mocks/Glossary.mock';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import IncidentManager from './IncidentManager.component';

jest.mock('../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});
jest.mock('../common/DatePickerMenu/DatePickerMenu.component', () => {
  return jest.fn().mockImplementation(({ handleDateRangeChange }) => (
    <div>
      <p>DatePickerMenu.component</p>
      <button
        data-testid="time-filter"
        onClick={() =>
          handleDateRangeChange({
            startTs: 1709556624254,
            endTs: 1710161424255,
          })
        }>
        time filter
      </button>
    </div>
  ));
});

jest.mock('../../pages/TasksPage/shared/Assignees', () => {
  return jest.fn().mockImplementation(() => <div>Assignees.component</div>);
});
jest.mock('../common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest
    .fn()
    .mockImplementation(() => <div>AsyncSelect.component</div>),
}));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      testCase: MOCK_PERMISSIONS,
    },
    getEntityPermissionByFqn: jest.fn().mockReturnValue(MOCK_PERMISSIONS),
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
  getListTestCaseIncidentStatus: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  updateTestCaseIncidentById: jest.fn(),
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

  it('Incident should be fetch with updated time', async () => {
    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatus as jest.Mock;
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
    });
  });

  it('Incident should be fetch with deleted', async () => {
    const mockGetListTestCaseIncidentStatus =
      getListTestCaseIncidentStatus as jest.Mock;
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
