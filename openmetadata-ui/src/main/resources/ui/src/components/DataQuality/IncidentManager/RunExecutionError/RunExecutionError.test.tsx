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
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
  IngestionPipeline,
  PipelineState,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  getIngestionPipelines,
  runIngestionPipelineForEntity,
} from '../../../../rest/ingestionPipelineAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import RunExecutionError from './RunExecutionError';
import { parseTraceback } from './RunExecutionError.utils';

const mockUseEntityPermissions = jest.fn();
const mockUseParams = jest.fn().mockReturnValue({});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockUseParams(),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
  runIngestionPipelineForEntity: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: (...args: unknown[]) =>
      mockUseEntityPermissions(...args),
  })
);

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

const TEST_CASE = {
  name: 'row_count_equal',
  fullyQualifiedName: 'svc.db.schema.orders.row_count_equal',
  testSuite: {
    id: 'suite-id',
    type: 'testSuite',
    fullyQualifiedName: 'svc.db.schema.orders.testSuite',
  },
} as TestCase;

const STACK_TRACE = [
  'Traceback (most recent call last):',
  '  File "/runner/validator.py", line 42, in run',
  '    rows = session.execute(query)',
  'psycopg2.OperationalError: connection timed out',
].join('\n');

const pipeline = (overrides: Partial<IngestionPipeline> = {}) =>
  ({
    name: 'suite_pipeline',
    fullyQualifiedName: 'svc.db.schema.orders.testSuite.suite_pipeline',
    pipelineType: PipelineType.TestSuite,
    enabled: true,
    deployed: true,
    airflowConfig: {},
    sourceConfig: {},
    pipelineStatuses: [],
    ...overrides,
  } as IngestionPipeline);

const setPipelines = (pipelines: IngestionPipeline[]) =>
  (getIngestionPipelines as jest.Mock).mockResolvedValue({ data: pipelines });

const setTriggerPermission = (canTrigger: boolean) => {
  const permissions = {
    [Operation.Trigger]: canTrigger,
  } as unknown as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

// Retry is hidden until the pipelines and the permission are known, so a
// "hidden" assertion only means something once the query has settled.
const waitForPipelinesLoaded = (queryClient: QueryClient) =>
  waitFor(() => {
    const queries = queryClient.getQueryCache().getAll();

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query.state.status === 'success')).toBe(
      true
    );
  });

const renderError = (props: Partial<Parameters<typeof RunExecutionError>[0]>) =>
  renderWithQueryClient(
    <RunExecutionError result="Error" testCase={TEST_CASE} {...props} />
  );

describe('RunExecutionError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({});
    setPipelines([pipeline()]);
    setTriggerPermission(true);
  });

  it('shows the structured error type, message and traceback', () => {
    renderError({
      errorDetails: {
        errorType: 'OperationalError',
        message: 'connection timed out',
        stackTrace: STACK_TRACE,
      },
      result: 'Error computing row count',
    });

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

  it('lets the keyboard reach the capped traceback to scroll it, as the SQL block does', () => {
    renderError({ errorDetails: { stackTrace: STACK_TRACE } });

    const traceback = screen.getByRole('region', { name: 'label.traceback' });

    expect(traceback).toHaveAttribute('tabindex', '0');
    expect(traceback).toHaveTextContent(
      'psycopg2.OperationalError: connection timed out'
    );
  });

  it('falls back to the plain-text result without structured details', () => {
    renderError({ result: 'Error computing row count' });

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

  it('retries the run', async () => {
    (runIngestionPipelineForEntity as jest.Mock).mockResolvedValue({});
    renderError({});

    fireEvent.click(await screen.findByTestId('run-execution-error-retry'));

    await waitFor(() =>
      expect(runIngestionPipelineForEntity).toHaveBeenCalledWith({
        entityLink: '<#E::testCase::svc.db.schema.orders.row_count_equal>',
        pipelineType: 'TestSuite',
      })
    );
  });

  it('disables retry, and says so, while a run is in progress', async () => {
    setPipelines([
      pipeline({
        pipelineStatuses: [
          {
            runId: 'running-run',
            pipelineState: PipelineState.Running,
            timestamp: Date.now(),
          },
        ],
      }),
    ]);
    renderError({});

    const retry = await screen.findByTestId('run-execution-error-retry');

    expect(retry).toBeDisabled();
    expect(retry).toHaveTextContent('label.running');

    fireEvent.click(retry);

    expect(runIngestionPipelineForEntity).not.toHaveBeenCalled();
  });

  it('hides retry without permission', async () => {
    setTriggerPermission(false);
    const { queryClient } = renderError({});

    await waitForPipelinesLoaded(queryClient);

    expect(
      screen.queryByTestId('run-execution-error-retry')
    ).not.toBeInTheDocument();
  });

  it('hides retry on the version page, as the header hides Run now, without reading the pipelines', () => {
    mockUseParams.mockReturnValue({ version: '0.2' });
    renderError({});

    expect(
      screen.queryByTestId('run-execution-error-retry')
    ).not.toBeInTheDocument();
    expect(getIngestionPipelines).not.toHaveBeenCalled();
  });

  it('hides retry when the test case cannot be run', async () => {
    setPipelines([pipeline({ deployed: false })]);
    const { queryClient } = renderError({});

    await waitForPipelinesLoaded(queryClient);

    expect(
      screen.queryByTestId('run-execution-error-retry')
    ).not.toBeInTheDocument();
  });
});

describe('parseTraceback', () => {
  it('tags each line by its role', () => {
    expect(parseTraceback(`${STACK_TRACE}\n`).map(({ kind }) => kind)).toEqual([
      'header',
      'location',
      'code',
      'exception',
    ]);
  });

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

  it("tags ingestion's truncation marker and the fragment cut after it", () => {
    const truncated = [
      '... [truncated 18423 characters]',
      'ction(statement, parameters)',
      '  File "/metadata/validator.py", line 64, in run',
      '    row = runner.select_first(metric)',
      'psycopg2.errors.QueryCanceled: canceling statement due to statement timeout',
    ].join('\n');

    expect(parseTraceback(truncated).map(({ kind }) => kind)).toEqual([
      'truncated',
      'code',
      'location',
      'code',
      'exception',
    ]);
  });

  it('keeps a known line after the marker in its own role', () => {
    const truncated = [
      '... [truncated 42 characters]',
      'Traceback (most recent call last):',
      'ValueError: boom',
    ].join('\n');

    expect(parseTraceback(truncated).map(({ kind }) => kind)).toEqual([
      'truncated',
      'header',
      'exception',
    ]);
  });
});
