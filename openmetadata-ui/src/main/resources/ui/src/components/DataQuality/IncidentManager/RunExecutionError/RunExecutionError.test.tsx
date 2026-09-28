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
import { fireEvent, render, screen } from '@testing-library/react';
import { TestCase } from '../../../../generated/tests/testCase';
import { useRunTestCase } from '../../../observability/TestCaseDetail/RunTestCaseButton/useRunTestCase';
import RunExecutionError from './RunExecutionError';
import { parseTraceback } from './RunExecutionError.utils';

jest.mock(
  '../../../observability/TestCaseDetail/RunTestCaseButton/useRunTestCase',
  () => ({ useRunTestCase: jest.fn() })
);

const mockRun = jest.fn();
const mockUseRunTestCase = useRunTestCase as jest.Mock;

const TEST_CASE = {
  name: 'row_count_equal',
  fullyQualifiedName: 'svc.db.schema.orders.row_count_equal',
} as TestCase;

const STACK_TRACE = [
  'Traceback (most recent call last):',
  '  File "/runner/validator.py", line 42, in run',
  '    rows = session.execute(query)',
  'psycopg2.OperationalError: connection timed out',
].join('\n');

const setRunAccess = (access: {
  canRun: boolean;
  disabledReasonKey?: string;
}) =>
  mockUseRunTestCase.mockReturnValue({
    isTriggering: false,
    run: mockRun,
    ...access,
  });

describe('RunExecutionError', () => {
  beforeEach(() => {
    setRunAccess({ canRun: true });
  });

  it('shows the structured error type, message and traceback', () => {
    render(
      <RunExecutionError
        errorDetails={{
          errorType: 'OperationalError',
          message: 'connection timed out',
          stackTrace: STACK_TRACE,
        }}
        result="Error computing row count"
        testCase={TEST_CASE}
      />
    );

    expect(screen.getByTestId('run-execution-error-type')).toHaveTextContent(
      'OperationalError'
    );
    expect(screen.getByTestId('run-execution-error-message')).toHaveTextContent(
      'connection timed out'
    );
    expect(
      screen.getByTestId('run-execution-error-traceback')
    ).toHaveTextContent('psycopg2.OperationalError: connection timed out');
  });

  it('falls back to the plain-text result without structured details', () => {
    render(
      <RunExecutionError
        result="Error computing row count"
        testCase={TEST_CASE}
      />
    );

    expect(screen.getByTestId('run-execution-error-message')).toHaveTextContent(
      'Error computing row count'
    );
    expect(
      screen.queryByTestId('run-execution-error-type')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('run-execution-error-traceback')
    ).not.toBeInTheDocument();
  });

  it('retries the run', () => {
    render(<RunExecutionError result="Error" testCase={TEST_CASE} />);

    fireEvent.click(screen.getByTestId('run-execution-error-retry'));

    expect(mockRun).toHaveBeenCalled();
  });

  it('hides retry without permission', () => {
    setRunAccess({ canRun: false });
    render(<RunExecutionError result="Error" testCase={TEST_CASE} />);

    expect(
      screen.queryByTestId('run-execution-error-retry')
    ).not.toBeInTheDocument();
  });

  it('hides retry when the test case cannot be run', () => {
    setRunAccess({
      canRun: true,
      disabledReasonKey: 'message.no-test-suite-pipeline',
    });
    render(<RunExecutionError result="Error" testCase={TEST_CASE} />);

    expect(
      screen.queryByTestId('run-execution-error-retry')
    ).not.toBeInTheDocument();
  });
});

describe('parseTraceback', () => {
  it('tags every exception of a chained traceback', () => {
    const chained = [
      'Traceback (most recent call last):',
      '  File "/sqlalchemy/engine/base.py", line 1967, in _exec',
      '    cursor.execute(statement, parameters)',
      'psycopg2.errors.UndefinedColumn: column "legacy_flag" does not exist',
      'LINE 2: SELECT legacy_flag',
      '',
      'The above exception was the direct cause of the following exception:',
      '',
      'Traceback (most recent call last):',
      '  File "/metadata/validator.py", line 64, in run',
      '    row = runner.select_first(metric)',
      'sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn)',
    ].join('\n');

    expect(parseTraceback(chained).map(({ kind }) => kind)).toEqual([
      'header',
      'location',
      'code',
      'exception',
      'exception',
      'code',
      'location',
      'code',
      'header',
      'location',
      'code',
      'exception',
    ]);
  });

  it('tags each line by its role', () => {
    expect(parseTraceback(`${STACK_TRACE}\n`).map(({ kind }) => kind)).toEqual([
      'header',
      'location',
      'code',
      'exception',
    ]);
  });
});
