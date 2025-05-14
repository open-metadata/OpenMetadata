/*
 *  Copyright 2022 Collate.
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
  findByRole,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EXECUTION_RUNS, FAILURE } from '../../../../../mocks/Ingestion.mock';
import { mockDataInsightApplicationRun } from '../../../../../mocks/LogsViewerPage.mock';
import { getRunHistoryForPipeline } from '../../../../../rest/ingestionPipelineAPI';
import ConnectionStepCard from '../../../../common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import { IngestionRecentRuns } from './IngestionRecentRuns.component';

const mockHandlePipelineIdToFetchStatus = jest.fn();

jest.mock(
  '../../../../common/TestConnection/ConnectionStepCard/ConnectionStepCard',
  () => {
    return jest.fn().mockImplementation(() => <p>testConnectionStepCard</p>);
  }
);

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  getRunHistoryForPipeline: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'success',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...EXECUTION_RUNS,
      ],
      paging: { total: 4 },
    })
  ),
}));

const mockIngestion = {
  id: 'testId',
  fullyQualifiedName: 'test',
} as IngestionPipeline;

describe('Test IngestionRecentRun component', () => {
  it('should call getRunHistoryForPipeline to fetch all the status', async () => {
    act(() => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    expect(getRunHistoryForPipeline).toHaveBeenCalledWith(
      'test',
      expect.anything()
    );
  });

  it('should render runs when API returns runs', async () => {
    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Success/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render queued runs when API returns runs with status queued', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'queued',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...EXECUTION_RUNS,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Queued/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render running runs when API returns runs with status running', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'running',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...EXECUTION_RUNS,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Running/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render failed runs when API returns runs with status failed', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'failed',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...EXECUTION_RUNS,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Failed/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render partialSuccess runs when API returns runs with status partialSuccess', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'partialSuccess',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...EXECUTION_RUNS,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/PartialSuccess/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should show additional details for click on run', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...EXECUTION_RUNS],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/PartialSuccess/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    act(() => {
      fireEvent.click(partialSuccess);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    expect(await screen.findByText(/Source/)).toBeInTheDocument();

    expect(await screen.findByText(/Sink/)).toBeInTheDocument();
    expect(await screen.findAllByText(/label.log-plural/)).toHaveLength(1);
  });

  it('should show additional details for clicked on non latest run', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...EXECUTION_RUNS],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/PartialSuccess/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    await act(async () => {
      // click on last run
      fireEvent.click(runs[runs.length - 1]);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    expect(await screen.findByText(/Source/)).toBeInTheDocument();

    expect(await screen.findByText(/Sink/)).toBeInTheDocument();
    expect(await screen.findAllByText(/label.log-plural/)).toHaveLength(1);
  });

  it('should show stacktrace when click on logs', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...EXECUTION_RUNS],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/PartialSuccess/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    act(() => {
      fireEvent.click(partialSuccess);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(await screen.findByText(/label.log-plural/));
    });

    expect(ConnectionStepCard).toHaveBeenNthCalledWith(
      2,
      {
        isTestingConnection: false,
        testConnectionStep: {
          description: FAILURE.error,
          mandatory: false,
          name: 'FILES',
        },
        testConnectionStepResult: {
          errorLog: FAILURE.stackTrace,
          mandatory: false,
          message: FAILURE.error,
          name: 'FILES',
          passed: false,
        },
      },
      {}
    );
    expect(
      await screen.findByText(/testConnectionStepCard/)
    ).toBeInTheDocument();
  });

  it('should not fetch getRunHistoryForPipeline in case of Application', async () => {
    await act(async () => {
      render(
        <IngestionRecentRuns
          appRuns={mockDataInsightApplicationRun.data}
          fetchStatus={false}
        />
      );
    });

    expect(getRunHistoryForPipeline).not.toHaveBeenCalled();
  });

  it('should fetch the pipeline status on demand if the pipelineIdToFetchStatus matches the current pipeline id', async () => {
    await act(async () => {
      render(
        <IngestionRecentRuns
          handlePipelineIdToFetchStatus={mockHandlePipelineIdToFetchStatus}
          ingestion={mockIngestion}
          pipelineIdToFetchStatus="testId"
        />
      );
    });

    expect(getRunHistoryForPipeline).toHaveBeenCalledTimes(2);
    expect(mockHandlePipelineIdToFetchStatus).toHaveBeenCalled();
  });
});
