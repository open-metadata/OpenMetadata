/*
 *  Copyright 2024 Collate.
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
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table as AntdTable } from 'antd';
import React from 'react';
import { AppType } from '../../../../generated/entity/applications/app';
import { Status } from '../../../../generated/entity/applications/appRunRecord';
import {
  mockApplicationData,
  mockExternalApplicationData,
} from '../../../../mocks/rests/applicationAPI.mock';
import AppRunsHistory from './AppRunsHistory.component';

const mockHandlePagingChange = jest.fn();
const mockHandlePageChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();
let mockGetApplicationRuns = jest.fn().mockReturnValue({
  data: [mockApplicationData],
  paging: {
    offset: 0,
    total: 3,
  },
});
const mockShowErrorToast = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('username'),
}));

jest.mock('../../../common/FormBuilder/FormBuilder', () =>
  jest
    .fn()
    .mockImplementation(({ onSubmit }) => (
      <button onClick={onSubmit}>Configure Save</button>
    ))
);

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 8,
    paging: {},
    pageSize: 5,
    handlePagingChange: jest
      .fn()
      .mockImplementation((...args) => mockHandlePagingChange(...args)),
    handlePageChange: jest
      .fn()
      .mockImplementation((...args) => mockHandlePageChange(...args)),
    handlePageSizeChange: jest
      .fn()
      .mockImplementation(() => mockHandlePageSizeChange()),
    showPagination: true,
  }),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../../../rest/applicationAPI', () => ({
  getApplicationRuns: jest
    .fn()
    .mockImplementation((...args) => mockGetApplicationRuns(...args)),
}));

jest.mock('../../../../utils/ApplicationUtils', () => ({
  getStatusFromPipelineState: jest.fn(),
  getStatusTypeForApplication: jest.fn(),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getLogsViewerPath: jest.fn().mockReturnValue('logs viewer path'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation((...args) => mockShowErrorToast(...args)),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((timestamp) => {
    // Return a fixed string for specific timestamps
    if (timestamp === 1741037977960) {
      return 'Mar 4, 2025, 3:08 AM';
    }

    return 'formatDateTime';
  }),
  getEpochMillisForPastDays: jest.fn().mockReturnValue('startDay'),
  getIntervalInMilliseconds: jest.fn().mockReturnValue('interval'),
  formatDuration: jest.fn().mockReturnValue('formatDuration'),
  formatDurationToHHMMSS: jest.fn().mockImplementation((_ms) => {
    // Return a consistent formatted duration for all cases
    return '02:30:15';
  }),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock('../../../common/Table/Table', () => {
  return jest
    .fn()
    .mockImplementation(({ loading, customPaginationProps, ...rest }) => (
      <div>
        {loading ? <p>TableLoader</p> : <AntdTable {...rest} />}
        {customPaginationProps && (
          <button
            onClick={() =>
              customPaginationProps.pagingHandler({ currentPage: 6 })
            }>
            NextPrevious
          </button>
        )}
        Table
      </div>
    ));
});

jest.mock('../AppLogsViewer/AppLogsViewer.component', () =>
  jest.fn().mockReturnValue(<div>AppLogsViewer</div>)
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../../constants/constants', () => ({
  NO_DATA_PLACEHOLDER: '--',
  STATUS_LABEL: {
    [Status.Success]: 'Success',
  },
}));

const mockProps1 = {
  appData: mockApplicationData,
  maxRecords: 10,
  showPagination: true,
  jsonSchema: {},
};

const mockProps2 = {
  ...mockProps1,
  appData: {
    ...mockProps1.appData,
    appType: AppType.External,
  },
};

const mockProps3 = {
  ...mockProps1,
  appData: {
    ...mockProps1.appData,
    supportsInterrupt: true,
    status: Status.Running,
  },
};

describe('AppRunsHistory', () => {
  it('should contain all necessary elements based on mockProps1', async () => {
    render(<AppRunsHistory {...mockProps1} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('label.run-at')).toBeInTheDocument();
    expect(screen.getByText('label.run-type')).toBeInTheDocument();
    expect(screen.getByText('label.action-plural')).toBeInTheDocument();

    // checking the logs function call for internal app
    act(() => {
      userEvent.click(screen.getByText('label.log-plural'));
    });

    expect(screen.getByText('NextPrevious')).toBeInTheDocument();

    // Verify Stop button is not present as initial status is success
    const stopButton = screen.queryByTestId('stop-button');

    expect(stopButton).not.toBeInTheDocument();
  });

  it('should show the error toast if fail in fetching app history', async () => {
    mockGetApplicationRuns.mockRejectedValueOnce('fetching app history failed');

    render(<AppRunsHistory {...mockProps1} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'fetching app history failed'
    );
  });

  it('should fetch data based on limit and offset for internal app onclick of NextPrevious', async () => {
    render(<AppRunsHistory {...mockProps1} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    fireEvent.click(screen.getByRole('button', { name: 'NextPrevious' }));
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(mockHandlePageChange).toHaveBeenCalledWith(6);
    expect(mockGetApplicationRuns).toHaveBeenCalledWith('mockFQN', {
      limit: 10,
      offset: 25,
    });
  });

  it('should fetch data based on startTs and endTs for external app onclick of NextPrevious', async () => {
    jest.useFakeTimers('modern').setSystemTime(new Date('2024-02-05'));
    render(<AppRunsHistory {...mockProps2} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(mockGetApplicationRuns).toHaveBeenCalledWith('mockFQN', {
      startTs: 'startDay',
      endTs: new Date('2024-02-05').valueOf(),
      limit: 10,
    });

    fireEvent.click(screen.getByRole('button', { name: 'NextPrevious' }));
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(mockHandlePageChange).toHaveBeenCalledWith(6);
    expect(mockGetApplicationRuns).toHaveBeenCalledWith('mockFQN', {
      startTs: 'startDay',
      endTs: new Date('2024-02-05').valueOf(),
      limit: 10,
    });
  });

  it('should expose children method to parent using ref', async () => {
    const refInParent = React.createRef();

    render(
      <AppRunsHistory
        {...mockProps1}
        maxRecords={undefined}
        ref={refInParent}
      />
    );
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    act(() => {
      (
        refInParent.current as { refreshAppHistory: () => void }
      )?.refreshAppHistory();
    });
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(mockGetApplicationRuns).toHaveBeenCalledWith('mockFQN', {
      limit: 5,
      offset: 0,
    });
  });

  it('onclick of logs button should call navigate method of external apps', async () => {
    render(<AppRunsHistory {...mockProps2} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    fireEvent.click(screen.getByText('label.log-plural'));

    expect(mockNavigate).toHaveBeenCalledWith('logs viewer path');
  });

  it('checking behaviour of component when no prop is passed', async () => {
    render(<AppRunsHistory jsonSchema={{}} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('should render the stop button when conditions are met', async () => {
    const mockRunRecordWithStopButton = {
      ...mockApplicationData,
      status: Status.Running, // Ensures Stop button condition is met
      supportsInterrupt: true,
    };
    mockGetApplicationRuns.mockReturnValueOnce({
      data: [mockRunRecordWithStopButton],
      paging: {
        offset: 0,
        total: 1,
      },
    });

    render(<AppRunsHistory {...mockProps3} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    const stopButton = screen.getByTestId('stop-button');

    expect(stopButton).toBeInTheDocument();

    fireEvent.click(stopButton);

    expect(screen.getByTestId('stop-modal')).toBeInTheDocument();
  });

  it('should render the table data for external app', async () => {
    mockGetApplicationRuns = jest.fn().mockImplementation(() => ({
      data: [
        {
          appId: '633f579c-512c-4b5f-864b-5664aa56b37f',
          appName: 'CollateAIApplication',
          extension: 'status',
          status: 'success',
          endTime: 1741038028746,
          executionTime: 1741037977960,
          startTime: 1741037977960,
        },
      ],
      paging: {
        offset: 0,
        total: 1,
      },
    }));

    render(
      <AppRunsHistory appData={mockExternalApplicationData} jsonSchema={{}} />
    );
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    // Verify timestamps are rendered
    expect(screen.getByText('Mar 4, 2025, 3:08 AM')).toBeInTheDocument();

    // Verify status is rendered
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
