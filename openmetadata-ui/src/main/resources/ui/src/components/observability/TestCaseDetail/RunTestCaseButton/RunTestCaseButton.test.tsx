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
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
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
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import RunTestCaseButton from './RunTestCaseButton';

const mockUseEntityPermissions = jest.fn();
const mockResourcePermissions: {
  ingestionPipeline?: Partial<OperationPermission>;
} = {};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  usePermissionProvider: () => ({ permissions: mockResourcePermissions }),
}));

const testCase = {
  id: 'test-case-id',
  name: 'row_count',
  fullyQualifiedName: 'svc.db.schema.orders.row_count',
  testSuite: {
    id: 'suite-id',
    type: 'testSuite',
    fullyQualifiedName: 'svc.db.schema.orders.testSuite',
  },
} as TestCase;

// The run is scoped by the test case's entity link to its suite's test suite pipeline.
const RUN_THIS_TEST_CASE = {
  entityLink: '<#E::testCase::svc.db.schema.orders.row_count>',
  pipelineType: 'TestSuite',
};

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

// Waiting for the call alone is not enough: until the pipelines arrive the button is hidden
// anyway, so an assertion that it is hidden would pass without the permission check.
const waitForPipelinesLoaded = (queryClient: QueryClient) =>
  waitFor(() => {
    const queries = queryClient.getQueryCache().getAll();

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query.state.status === 'success')).toBe(
      true
    );
  });

const setPipelinePermission = (
  canTrigger: boolean,
  { isLoading = false }: { isLoading?: boolean } = {}
) => {
  const permissions = {
    [Operation.Trigger]: canTrigger,
  } as unknown as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

describe('RunTestCaseButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockResourcePermissions.ingestionPipeline;
  });

  it('shows the button to a user who may trigger the suite pipeline', async () => {
    setPipelines([pipeline()]);
    setPipelinePermission(true);

    renderWithQueryClient(<RunTestCaseButton testCase={testCase} />);

    expect(await screen.findByTestId('run-test-case-button')).toBeEnabled();
  });

  it('hides the button from a user who may not trigger the suite pipeline', async () => {
    setPipelines([pipeline()]);
    setPipelinePermission(false);

    const { queryClient } = renderWithQueryClient(
      <RunTestCaseButton testCase={testCase} />
    );

    await waitForPipelinesLoaded(queryClient);

    expect(
      screen.queryByTestId('run-test-case-button')
    ).not.toBeInTheDocument();
  });

  it('stays hidden while the pipeline permission is still loading', async () => {
    setPipelines([pipeline()]);
    setPipelinePermission(true, { isLoading: true });

    const { queryClient } = renderWithQueryClient(
      <RunTestCaseButton testCase={testCase} />
    );

    await waitForPipelinesLoaded(queryClient);

    expect(
      screen.queryByTestId('run-test-case-button')
    ).not.toBeInTheDocument();
  });

  it('hides the button when there is no runnable pipeline and the user may not trigger pipelines at all', async () => {
    setPipelines([pipeline({ deployed: false })]);
    setPipelinePermission(false);
    mockResourcePermissions.ingestionPipeline = { [Operation.Trigger]: false };

    const { queryClient } = renderWithQueryClient(
      <RunTestCaseButton testCase={testCase} />
    );

    await waitForPipelinesLoaded(queryClient);

    expect(
      screen.queryByTestId('run-test-case-button')
    ).not.toBeInTheDocument();
  });

  it('disables the button when there is no runnable pipeline but the user may trigger pipelines', async () => {
    setPipelines([pipeline({ deployed: false })]);
    setPipelinePermission(false);
    mockResourcePermissions.ingestionPipeline = { [Operation.Trigger]: true };

    renderWithQueryClient(<RunTestCaseButton testCase={testCase} />);

    expect(await screen.findByTestId('run-test-case-button')).toBeDisabled();
    expect(
      screen.getByRole('group', { name: 'message.pipeline-not-deployed' })
    ).toBeInTheDocument();
  });

  it('runs the test case on click, confirms it was queued and reloads the run state', async () => {
    setPipelines([pipeline()]);
    setPipelinePermission(true);
    (runIngestionPipelineForEntity as jest.Mock).mockResolvedValue({});

    renderWithQueryClient(<RunTestCaseButton testCase={testCase} />);
    fireEvent.click(await screen.findByTestId('run-test-case-button'));

    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.test-case-run-queued'
      )
    );

    expect(runIngestionPipelineForEntity).toHaveBeenCalledWith(
      RUN_THIS_TEST_CASE
    );
    expect(getIngestionPipelines).toHaveBeenCalledTimes(2);
  });

  it('shows the server error when the run is rejected', async () => {
    const error = new AxiosError('Failed to trigger IngestionPipeline');
    setPipelines([pipeline()]);
    setPipelinePermission(true);
    (runIngestionPipelineForEntity as jest.Mock).mockRejectedValue(error);

    renderWithQueryClient(<RunTestCaseButton testCase={testCase} />);
    fireEvent.click(await screen.findByTestId('run-test-case-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(screen.getByTestId('run-test-case-button')).toBeEnabled();
  });

  it('shows a queued run and still lets the user start another', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    setPipelines([
      pipeline({
        pipelineStatuses: [
          {
            runId: 'queued-run',
            pipelineState: PipelineState.Queued,
            timestamp: Date.now(),
          },
        ],
      }),
    ]);
    setPipelinePermission(true);
    (runIngestionPipelineForEntity as jest.Mock).mockResolvedValue({});

    renderWithQueryClient(<RunTestCaseButton testCase={testCase} />);
    const runButton = await screen.findByTestId('run-test-case-button');

    expect(runButton).toBeEnabled();
    expect(runButton).toHaveTextContent('label.queued');

    fireEvent.mouseMove(document);
    await user.hover(runButton);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'message.test-case-run-already-in-progress'
    );

    await user.click(runButton);

    await waitFor(() =>
      expect(runIngestionPipelineForEntity).toHaveBeenCalledWith(
        RUN_THIS_TEST_CASE
      )
    );
  });
});
