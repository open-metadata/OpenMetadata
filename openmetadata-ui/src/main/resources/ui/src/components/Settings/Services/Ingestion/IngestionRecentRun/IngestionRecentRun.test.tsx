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
import { Status } from '../../../../../generated/entity/applications/appRunRecord';
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

  describe('Timestamp Sorting Logic', () => {
    it('should sort runs by timestamp in ascending order and show last 5 runs', async () => {
      const unorderedRuns = [
        {
          runId: 'run-3',
          pipelineState: 'success',
          startDate: 1667307000,
          timestamp: 1667307000,
          endDate: 1667307003,
        },
        {
          runId: 'run-1',
          pipelineState: 'failed',
          startDate: 1667301000,
          timestamp: 1667301000,
          endDate: 1667301003,
        },
        {
          runId: 'run-5',
          pipelineState: 'success',
          startDate: 1667309000,
          timestamp: 1667309000,
          endDate: 1667309003,
        },
        {
          runId: 'run-2',
          pipelineState: 'partialSuccess',
          startDate: 1667304000,
          timestamp: 1667304000,
          endDate: 1667304003,
        },
        {
          runId: 'run-4',
          pipelineState: 'running',
          startDate: 1667308000,
          timestamp: 1667308000,
          endDate: 1667308003,
        },
        {
          runId: 'run-6',
          pipelineState: 'queued',
          startDate: 1667310000,
          timestamp: 1667310000,
          endDate: 1667310003,
        },
        {
          runId: 'run-7',
          pipelineState: 'success',
          startDate: 1667311000,
          timestamp: 1667311000,
          endDate: 1667311003,
        },
      ];

      (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
        data: unorderedRuns,
        paging: { total: 7 },
      });

      await act(async () => {
        render(<IngestionRecentRuns ingestion={mockIngestion} />);
      });

      const runs = await screen.findAllByTestId('pipeline-status');

      expect(runs).toHaveLength(5);

      const latestRun = await screen.findByText(/Success/);

      expect(latestRun).toBeInTheDocument();
    });

    it('should handle runs with missing timestamps gracefully by treating them as 0', async () => {
      const runsWithMissingTimestamps = [
        {
          runId: 'run-with-timestamp',
          pipelineState: 'success',
          startDate: 1667307000,
          timestamp: 1667307000,
          endDate: 1667307003,
        },
        {
          runId: 'run-without-timestamp',
          pipelineState: 'failed',
          startDate: 1667301000,
          endDate: 1667301003,
        },
        {
          runId: 'run-with-null-timestamp',
          pipelineState: 'partialSuccess',
          startDate: 1667304000,
          timestamp: null,
          endDate: 1667304003,
        },
      ];

      (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
        data: runsWithMissingTimestamps,
        paging: { total: 3 },
      });

      await act(async () => {
        render(<IngestionRecentRuns ingestion={mockIngestion} />);
      });

      const runs = await screen.findAllByTestId('pipeline-status');

      expect(runs).toHaveLength(3);

      const latestRun = await screen.findByText(/Success/);

      expect(latestRun).toBeInTheDocument();
    });

    it('should sort appRuns by timestamp when provided', async () => {
      const unorderedAppRuns = [
        {
          runId: 'app-run-2',
          status: Status.Success,
          startTime: 1667307000,
          timestamp: 1667307000,
          endTime: 1667307003,
          appId: 'app-2',
        },
        {
          runId: 'app-run-1',
          status: Status.Failed,
          startTime: 1667301000,
          timestamp: 1667301000,
          endTime: 1667301003,
          appId: 'app-1',
        },
        {
          runId: 'app-run-3',
          status: Status.Running,
          startTime: 1667309000,
          timestamp: 1667309000,
          endTime: 1667309003,
          appId: 'app-3',
        },
      ];

      await act(async () => {
        render(
          <IngestionRecentRuns appRuns={unorderedAppRuns} fetchStatus={false} />
        );
      });

      const runs = await screen.findAllByTestId('pipeline-status');

      expect(runs).toHaveLength(3);

      const latestRun = await screen.findByText(/Running/);

      expect(latestRun).toBeInTheDocument();
    });

    it('should limit results to maximum 5 runs after sorting', async () => {
      const manyRuns = Array.from({ length: 10 }, (_, i) => ({
        runId: `run-${i}`,
        pipelineState: 'success',
        startDate: 1667300000 + i * 1000,
        timestamp: 1667300000 + i * 1000,
        endDate: 1667300003 + i * 1000,
      }));

      (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
        data: manyRuns,
        paging: { total: 10 },
      });

      await act(async () => {
        render(<IngestionRecentRuns ingestion={mockIngestion} />);
      });

      const runs = await screen.findAllByTestId('pipeline-status');

      expect(runs).toHaveLength(5);
    });
  });
});
