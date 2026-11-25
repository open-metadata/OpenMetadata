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
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  SuffixFormat,
  TableType,
} from '../../../../generated/entity/data/table';
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { useTestCaseStore } from '../useTestCase.store';
import RunDetailsCard from './RunDetailsCard';

// Only the REST and permission boundaries are stubbed; the Retry run hook runs for real.
jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockResolvedValue({ data: [] }),
  runIngestionPipelineForEntity: jest.fn(),
}));

jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      permissions: {},
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    }),
  })
);

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn(),
}));

const TEST_CASE = {
  name: 'row_count_equal',
  fullyQualifiedName: 'svc.db.schema.orders.row_count_equal',
  parameterValues: [{ name: 'value', value: '10000' }],
  testDefinition: {
    id: 'def',
    type: 'testDefinition',
    name: 'tableRowCountToEqual',
  },
} as TestCase;

const FAILED_RUN: TestCaseResult = {
  timestamp: 1_786_001_601_000,
  testCaseStatus: TestCaseStatus.Failed,
  result: 'Found rowCount=110 vs. the expected 10000',
  testResultValue: [{ name: 'rowCount', value: '110' }],
  duration: 2600,
};

const renderCard = (results: TestCaseResult[], testCase = TEST_CASE) =>
  renderWithQueryClient(
    <RunDetailsCard results={results} testCase={testCase} />
  );

describe('RunDetailsCard', () => {
  afterEach(() => {
    act(() => useTestCaseStore.getState().reset());
  });

  it('shows the selected historical execution source after representative rollover', () => {
    const older = {
      ...FAILED_RUN,
      evaluationScope: {
        executionSource: {
          databaseName: 'demo_project',
          schemaName: 'demo_dataset',
          tableName: 'events_20260101',
        },
      },
    };
    const newer = {
      ...FAILED_RUN,
      timestamp: FAILED_RUN.timestamp + 1000,
      evaluationScope: {
        executionSource: {
          databaseName: 'demo_project',
          schemaName: 'demo_dataset',
          tableName: 'events_20260102',
        },
      },
    };
    act(() =>
      useTestCaseStore.setState({ selectedRunTimestamp: older.timestamp })
    );
    renderCard([older, newer]);

    expect(screen.getByTestId('run-execution-source')).toHaveTextContent(
      'events_20260101'
    );
    expect(screen.getByTestId('run-execution-source')).not.toHaveTextContent(
      'events_20260102'
    );

    act(() =>
      useTestCaseStore.setState({ selectedRunTimestamp: newer.timestamp })
    );

    expect(screen.getByTestId('run-execution-source')).toHaveTextContent(
      'events_20260102'
    );
  });

  it('shows a failed run with its expected, found and difference', () => {
    renderCard([FAILED_RUN]);

    expect(screen.getByTestId('run-details-card')).toHaveAttribute(
      'data-status',
      TestCaseStatus.Failed
    );
    expect(screen.getByTestId('run-details-definition')).toHaveTextContent(
      'tableRowCountToEqual'
    );
    // Sentence case, as the mock labels the card.
    expect(
      screen.getByText('label.test-definition-sentence')
    ).toBeInTheDocument();
    expect(screen.getByTestId('run-details-expected')).toHaveTextContent(
      '10,000'
    );
    expect(screen.getByTestId('run-details-found')).toHaveTextContent('110');
    expect(screen.getByTestId('run-details-difference')).toHaveTextContent(
      '-9,890 (-98.9%)'
    );
    expect(screen.getByTestId('run-details-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('run-details-duration')).toHaveTextContent(
      '2.6s'
    );
    expect(screen.getByTestId('run-details-note')).toHaveTextContent(
      'message.run-details-failed-note'
    );
  });

  it('sets the four values in columns, in the weight the mock gives them', () => {
    renderCard([FAILED_RUN]);

    const found = screen.getByTestId('run-details-found');

    expect(found).toHaveClass('tw:text-xs', 'tw:font-semibold');
    expect(screen.getByTestId('run-details-definition')).toHaveClass(
      'tw:text-xs',
      'tw:font-medium'
    );
    // Equal columns broke "tableRowCountToBeBetween" mid-word at 1440px; the
    // definition's column is never narrower than the name.
    expect(found.closest('.tw\\:grid')).toHaveClass(
      'tw:@lg:grid-cols-[minmax(max-content,1fr)_repeat(3,minmax(0,1fr))]',
      'tw:gap-x-3'
    );
  });

  it('quiets an unknown expectation, as it does an unknown result', () => {
    renderCard([{ ...FAILED_RUN, testCaseStatus: TestCaseStatus.Aborted }], {
      ...TEST_CASE,
      parameterValues: [],
    } as TestCase);

    const expected = screen.getByTestId('run-details-expected');

    expect(expected).toHaveTextContent('—');
    expect(expected).toHaveClass('tw:text-quaternary');
  });

  it('shows a successful run with its note', () => {
    renderCard([
      {
        ...FAILED_RUN,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [{ name: 'rowCount', value: '10000' }],
      },
    ]);

    // Signed like any other difference, as the mock shows it.
    expect(screen.getByTestId('run-details-difference')).toHaveTextContent(
      '+0 (+0.0%)'
    );
    expect(screen.getByTestId('run-details-note')).toHaveTextContent(
      'message.run-details-success-note'
    );
  });

  it('shows a queued run as dashes with no comparison bar', () => {
    renderCard([
      {
        timestamp: FAILED_RUN.timestamp,
        testCaseStatus: TestCaseStatus.Queued,
        testResultValue: [],
      },
    ]);

    expect(screen.getByTestId('run-details-found')).toHaveTextContent('—');
    expect(screen.getByTestId('run-details-difference')).toHaveTextContent('—');
    expect(
      screen.queryByTestId('run-details-comparison')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('run-details-note')).toHaveTextContent(
      'message.run-details-queued-note'
    );
  });

  it('shows an aborted run as an execution error instead of a note', () => {
    renderCard([
      {
        timestamp: FAILED_RUN.timestamp,
        testCaseStatus: TestCaseStatus.Aborted,
        result: 'Error computing row count',
        testResultValue: [{ name: 'rowCount', value: undefined }],
        duration: 30000,
        errorDetails: {
          errorType: 'QueryTimeoutError',
          message: 'connection to server timed out',
          stackTrace: 'Traceback (most recent call last):\nQueryTimeoutError',
        },
      },
    ]);

    expect(screen.getByTestId('run-execution-error')).toBeInTheDocument();
    expect(screen.queryByTestId('run-details-note')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('run-details-comparison')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('run-details-duration')).toHaveTextContent(
      'label.duration-with-timeout'
    );
  });

  it('draws no bar for a run without a single numeric result', () => {
    renderCard(
      [
        {
          ...FAILED_RUN,
          testResultValue: [
            { name: 'valuesCount', value: '100' },
            { name: 'uniqueCount', value: '90' },
          ],
        },
      ],
      {
        ...TEST_CASE,
        parameterValues: [],
        testDefinition: {
          id: 'def',
          type: 'testDefinition',
          name: 'columnValuesToBeUnique',
        },
      }
    );

    expect(screen.getByTestId('run-details-found')).toHaveTextContent(
      'valuesCount 100, uniqueCount 90'
    );
    expect(
      screen.queryByTestId('run-details-comparison')
    ).not.toBeInTheDocument();
  });

  it('keeps the duration slot, with a dash, for a run that has none yet', () => {
    renderCard([
      {
        timestamp: FAILED_RUN.timestamp,
        testCaseStatus: TestCaseStatus.Queued,
        testResultValue: [],
      },
    ]);

    expect(screen.getByTestId('run-details-duration')).toHaveTextContent('—');
  });

  it("dates the run as the banner does, in the reader's time zone", () => {
    renderCard([FAILED_RUN]);

    const header = screen.getByTestId('run-details-date');

    expect(header).toHaveTextContent(formatDateTime(FAILED_RUN.timestamp));
    expect(header).toHaveTextContent('(UTC');
  });

  it('draws found and expected as bars on one scale, the found one in its status colour', () => {
    renderCard([FAILED_RUN]);

    const comparison = screen.getByTestId('run-details-comparison');
    const found = within(screen.getByTestId('run-details-found-bar'));
    const expected = within(screen.getByTestId('run-details-expected-bar'));

    // 10,000 is the longer bar; 110 is 1.1% of it.
    expect(expected.getByRole('progressbar', { hidden: true })).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(found.getByRole('progressbar', { hidden: true })).toHaveAttribute(
      'aria-valuenow',
      '1.1'
    );
    expect(screen.getByTestId('run-details-found-bar')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(comparison).toHaveTextContent('110');
    expect(screen.getByTestId('run-details-found-value')).toHaveClass(
      'tw:text-utility-error-700'
    );
  });

  it('shows the run selected on the chart', () => {
    const olderRun = {
      ...FAILED_RUN,
      timestamp: FAILED_RUN.timestamp - 86_400_000,
      testResultValue: [{ name: 'rowCount', value: '9000' }],
    };
    act(() =>
      useTestCaseStore.getState().setSelectedRunTimestamp(olderRun.timestamp)
    );

    renderCard([FAILED_RUN, olderRun]);

    expect(screen.getByTestId('run-details-found')).toHaveTextContent('9,000');
    // An older run says so, and offers the way back.
    expect(screen.getByTestId('run-details-selected')).toHaveTextContent(
      'label.selected-run'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'label.back-to-latest' })
    );

    expect(useTestCaseStore.getState().selectedRunTimestamp).toBeUndefined();
    expect(screen.getByTestId('run-details-found')).toHaveTextContent('110');
    expect(
      screen.queryByTestId('run-details-selected')
    ).not.toBeInTheDocument();
  });

  it('does not label the latest run as selected, even when it was clicked', () => {
    act(() =>
      useTestCaseStore.getState().setSelectedRunTimestamp(FAILED_RUN.timestamp)
    );

    renderCard([FAILED_RUN]);

    expect(
      screen.queryByTestId('run-details-selected')
    ).not.toBeInTheDocument();
  });

  it('falls back to the latest run without a selection', () => {
    renderCard([
      {
        ...FAILED_RUN,
        timestamp: FAILED_RUN.timestamp - 86_400_000,
        testResultValue: [{ name: 'rowCount', value: '9000' }],
      },
      FAILED_RUN,
    ]);

    expect(screen.getByTestId('run-details-found')).toHaveTextContent('110');
  });

  it('renders nothing without runs', () => {
    renderCard([]);

    expect(screen.queryByTestId('run-details-card')).not.toBeInTheDocument();
  });
});

it.each([TableType.Regular, TableType.Sharded])(
  'shows missing run provenance only for sharded tables (%s)',
  async (tableType) => {
    jest.mocked(getTableDetailsByFQN).mockResolvedValueOnce({
      id: 'my-table',
      name: 'my_table',
      columns: [],
      tableType,
      tableSharding:
        tableType === TableType.Sharded
          ? {
              prefix: 'events_',
              suffixFormat: SuffixFormat.Yyyymmdd,
              shardCount: 1,
              firstShardDate: new Date('2026-01-02'),
              lastShardDate: new Date('2026-01-02'),
              representative: {
                databaseName: 'my_db',
                schemaName: 'my_schema',
                tableName: 'events_20260102',
                shardDate: new Date('2026-01-02'),
              },
            }
          : undefined,
    });
    const view = renderCard([FAILED_RUN], {
      ...TEST_CASE,
      entityLink: '<#E::table::svc.my_db.my_schema.my_table>',
    });
    await waitFor(() => expect(view.queryClient.isFetching()).toBe(0));
    if (tableType === TableType.Sharded) {
      expect(
        screen.getByText('message.execution-source-unavailable')
      ).toBeInTheDocument();
    } else {
      expect(
        screen.queryByTestId('run-execution-source')
      ).not.toBeInTheDocument();
    }

    expect(screen.queryByText(/events_20260102/)).not.toBeInTheDocument();
  }
);
