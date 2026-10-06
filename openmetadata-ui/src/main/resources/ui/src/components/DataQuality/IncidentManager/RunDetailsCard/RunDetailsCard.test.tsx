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
import { act, screen } from '@testing-library/react';
import {
  TestCase,
  TestCaseResult,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
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

  it('shows a successful run with its note', () => {
    renderCard([
      {
        ...FAILED_RUN,
        testCaseStatus: TestCaseStatus.Success,
        testResultValue: [{ name: 'rowCount', value: '10000' }],
      },
    ]);

    expect(screen.getByTestId('run-details-difference')).toHaveTextContent(
      '0 (0.0%)'
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

  it('hides the duration when the run has none', () => {
    renderCard([{ ...FAILED_RUN, duration: undefined }]);

    expect(
      screen.queryByTestId('run-details-duration')
    ).not.toBeInTheDocument();
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
