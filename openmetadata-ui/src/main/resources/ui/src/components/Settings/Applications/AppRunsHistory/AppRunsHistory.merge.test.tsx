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
  within,
} from '@testing-library/react';
import { Table as AntdTable } from 'antd';
import {
  AppRunRecord,
  Status,
} from '../../../../generated/entity/applications/appRunRecord';
import { mockApplicationData } from '../../../../mocks/rests/applicationAPI.mock';
import AppRunsHistory from './AppRunsHistory.component';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};
let mockGetApplicationRuns = jest.fn();
const mockHasAppRunStats = jest.fn();

jest.mock('../../../../constants/LeftSidebar.constants', () => ({
  SIDEBAR_NESTED_KEYS: {},
  SIDEBAR_LIST: [],
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('username'),
}));

jest.mock('../../../common/FormBuilder/FormBuilder', () =>
  jest
    .fn()
    .mockImplementation(({ formData }) => (
      <div data-testid="app-run-config-form-data">
        {JSON.stringify(formData)}
      </div>
    ))
);

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    paging: {},
    pageSize: 5,
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
  }),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn().mockImplementation(() => ({
    socket: mockSocket,
  })),
}));

jest.mock('../../../../rest/applicationAPI', () => ({
  getApplicationRuns: jest
    .fn()
    .mockImplementation((...args) => mockGetApplicationRuns(...args)),
}));

jest.mock('../../../../utils/ApplicationUtils', () => ({
  getStatusFromPipelineState: jest.fn(),
  getStatusTypeForApplication: jest.fn(),
  hasAppRunStats: (...args: unknown[]) => mockHasAppRunStats(...args),
  getAppRunFailureLogs: jest.fn().mockReturnValue('mock failure logs'),
}));

jest.mock('../../../common/LogViewerModal/LogViewerModal.component', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div>LogViewerModalOpen</div> : null,
}));

jest.mock('../../../../hooks/useLogsModal', () => ({
  useLogsModal: () => ({ openLogs: jest.fn(), logsModal: null }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('formatDateTime'),
  getCurrentMillis: jest.fn().mockReturnValue(1741037977960),
  getEpochMillisForPastDays: jest.fn().mockReturnValue('startDay'),
  getIntervalInMilliseconds: jest.fn().mockReturnValue(12345),
  formatDuration: jest.fn().mockReturnValue('formatDuration'),
  formatDurationToHHMMSS: jest.fn().mockReturnValue('02:30:15'),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock('../../../common/Table/TableV2', () => {
  return jest.fn().mockImplementation(({ loading, ...rest }) => (
    <div>
      {loading ? <p>TableLoader</p> : <AntdTable {...rest} />}
      Table
    </div>
  ));
});

jest.mock('../AppLogsViewer/AppLogsViewer.component', () =>
  jest.fn().mockReturnValue(<div>AppLogsViewer</div>)
);

jest.mock('../../../common/PopOverCard/UserPopOverCard', () =>
  jest
    .fn()
    .mockImplementation(({ userName }: { userName: string }) => (
      <span data-testid="triggered-by-user">{userName}</span>
    ))
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../../../constants/constants', () => ({
  NO_DATA_PLACEHOLDER: '--',
  SOCKET_EVENTS: {
    SEARCH_INDEX_JOB_BROADCAST_CHANNEL: 'searchIndexJobStatus',
    RDF_INDEX_JOB_BROADCAST_CHANNEL: 'rdfIndexJobStatus',
    DATA_INSIGHTS_JOB_BROADCAST_CHANNEL: 'dataInsightsJobStatus',
    CACHE_WARMUP_JOB_BROADCAST_CHANNEL: 'cacheWarmupJobStatus',
  },
  STATUS_LABEL: {
    [Status.Success]: 'Success',
    [Status.Running]: 'Running',
    [Status.Failed]: 'Failed',
    [Status.Completed]: 'Completed',
  },
}));

const APP_ID = 'bfa9dee3-6737-4e82-b73b-2aef15420ba0';
const START_TIME = 1741037977960;
const APP_NAME = 'SearchIndexingApplication';

// Mirrors a stored on-demand run as persisted by OmAppJobListener.jobToBeExecuted,
// carrying triggeredBy + config that the sparse broadcast omits.
const storedOnDemandRun: AppRunRecord = {
  appId: APP_ID,
  appName: APP_NAME,
  runType: 'OnDemandJob',
  startTime: START_TIME,
  timestamp: START_TIME,
  status: Status.Running,
  triggeredBy: 'alice',
  config: { foo: 'bar' },
};

// Mirrors DistributedJobStatsAggregator.convertToAppRunRecord: carries only
// appId/status/runType/times/successContext, omitting triggeredBy and config.
const sparseBroadcast = {
  appId: APP_ID,
  status: Status.Running,
  runType: 'OnDemandJob',
  startTime: START_TIME,
  endTime: null,
  timestamp: START_TIME + 1000,
  successContext: { stats: {} },
};

const mockProps = {
  appData: mockApplicationData,
  maxRecords: 10,
  showPagination: true,
  jsonSchema: {},
};

const getSocketCallback = (eventName: string) =>
  mockSocket.on.mock.calls.find(([event]) => event === eventName)?.[1] as
    | ((data: string) => void)
    | undefined;

const getTriggeredByCell = () => {
  const columnIndex = screen
    .getAllByRole('columnheader')
    .findIndex((header) => header.textContent === 'label.triggered-by');
  const [, firstDataRow] = screen.getAllByRole('row');

  return within(firstDataRow).getAllByRole('cell')[columnIndex];
};

const getConfigFormData = () => {
  fireEvent.click(screen.getByTestId('app-historical-config'));

  return screen.getByTestId('app-run-config-form-data').textContent;
};

describe('AppRunsHistory websocket merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasAppRunStats.mockReturnValue(true);
  });

  it('preserves triggeredBy when a sparse search-index broadcast updates an on-demand run', async () => {
    mockGetApplicationRuns = jest.fn().mockReturnValue({
      data: [storedOnDemandRun],
      paging: { offset: 0, total: 1 },
    });

    render(<AppRunsHistory {...mockProps} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    expect(getTriggeredByCell()).toHaveTextContent('alice');

    const searchIndexCallback = getSocketCallback('searchIndexJobStatus');

    expect(searchIndexCallback).toBeInstanceOf(Function);

    act(() => {
      searchIndexCallback?.(JSON.stringify(sparseBroadcast));
    });

    expect(getTriggeredByCell()).toHaveTextContent('alice');
    expect(screen.queryByText('--')).not.toBeInTheDocument();
  });

  it('preserves config (Config modal payload) when a sparse search-index broadcast updates a run', async () => {
    mockGetApplicationRuns = jest.fn().mockReturnValue({
      data: [storedOnDemandRun],
      paging: { offset: 0, total: 1 },
    });

    render(<AppRunsHistory {...mockProps} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    act(() => {
      getSocketCallback('searchIndexJobStatus')?.(
        JSON.stringify(sparseBroadcast)
      );
    });

    expect(JSON.parse(getConfigFormData() ?? '{}')).toEqual({ foo: 'bar' });
  });

  it('applies the carried fields from the broadcast while preserving omitted fields', async () => {
    mockGetApplicationRuns = jest.fn().mockReturnValue({
      data: [storedOnDemandRun],
      paging: { offset: 0, total: 1 },
    });

    render(<AppRunsHistory {...mockProps} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    act(() => {
      getSocketCallback('searchIndexJobStatus')?.(
        JSON.stringify({
          appId: APP_ID,
          status: Status.Failed,
          runType: 'OnDemandJob',
          startTime: START_TIME,
          endTime: START_TIME + 5000,
          timestamp: START_TIME + 5000,
          successContext: { stats: { jobStats: { successRecords: 5 } } },
          failureContext: { failure: { message: 'boom' } },
        })
      );
    });

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(getTriggeredByCell()).toHaveTextContent('alice');
  });

  it('does not touch rows whose appId + startTime do not match the broadcast', async () => {
    const otherRun: AppRunRecord = {
      appId: 'other-app-id',
      appName: 'OtherApp',
      runType: 'OnDemandJob',
      startTime: 1111111111111,
      timestamp: 1111111111111,
      status: Status.Running,
      triggeredBy: 'bob',
      config: { keep: 'me' },
    };
    mockGetApplicationRuns = jest.fn().mockReturnValue({
      data: [storedOnDemandRun, otherRun],
      paging: { offset: 0, total: 2 },
    });

    render(<AppRunsHistory {...mockProps} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    act(() => {
      getSocketCallback('searchIndexJobStatus')?.(
        JSON.stringify(sparseBroadcast)
      );
    });

    const rows = screen.getAllByRole('row');
    const [, firstRow, secondRow] = rows;
    const triggeredByIndex = screen
      .getAllByRole('columnheader')
      .findIndex((header) => header.textContent === 'label.triggered-by');

    expect(
      within(firstRow).getAllByRole('cell')[triggeredByIndex]
    ).toHaveTextContent('alice');
    expect(
      within(secondRow).getAllByRole('cell')[triggeredByIndex]
    ).toHaveTextContent('bob');
  });

  it('merges (not replaces) for the RDF, data-insights, and cache-warmup channels too', async () => {
    mockGetApplicationRuns = jest.fn().mockReturnValue({
      data: [storedOnDemandRun],
      paging: { offset: 0, total: 1 },
    });

    render(<AppRunsHistory {...mockProps} />);
    await waitForElementToBeRemoved(() => screen.getByText('TableLoader'));

    const sparsePayload = {
      appId: APP_ID,
      status: Status.Running,
      runType: 'OnDemandJob',
      startTime: START_TIME,
      timestamp: START_TIME + 1000,
    };

    act(() => {
      getSocketCallback('rdfIndexJobStatus')?.(JSON.stringify(sparsePayload));
    });

    expect(getTriggeredByCell()).toHaveTextContent('alice');

    act(() => {
      getSocketCallback('dataInsightsJobStatus')?.(
        JSON.stringify({ ...sparsePayload, status: Status.Completed })
      );
    });

    expect(getTriggeredByCell()).toHaveTextContent('alice');

    act(() => {
      getSocketCallback('cacheWarmupJobStatus')?.(
        JSON.stringify({ ...sparsePayload, status: Status.Failed })
      );
    });

    expect(getTriggeredByCell()).toHaveTextContent('alice');
    expect(JSON.parse(getConfigFormData() ?? '{}')).toEqual({ foo: 'bar' });
  });
});
