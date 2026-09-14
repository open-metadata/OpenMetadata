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
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useLogStream,
  UseLogStreamResult,
} from '../components/common/LogViewerModal/useLogStream';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { PipelineState } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { LogStreamEndReason } from '../generated/entity/services/ingestionPipelines/logStreamEvent';
import {
  getApplicationByName,
  getExternalApplicationRuns,
  getLatestApplicationRuns,
} from '../rest/applicationAPI';
import {
  getIngestionPipelineByFqn,
  getIngestionPipelineLogById,
} from '../rest/ingestionPipelineAPI';
import { downloadIngestionLog } from '../utils/IngestionLogs/LogsUtils';
import { useEntityLogs } from './useEntityLogs';

const mockReset = jest.fn();
const mockUpdateProgress = jest.fn();

jest.mock('./useDownloadProgressStore', () => ({
  useDownloadProgressStore: () => ({
    progress: 0,
    reset: mockReset,
    updateProgress: mockUpdateProgress,
  }),
}));

jest.mock('../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineByFqn: jest.fn(),
  getIngestionPipelineLogById: jest.fn(),
}));

jest.mock('../rest/applicationAPI', () => ({
  getApplicationByName: jest.fn(),
  getExternalApplicationRuns: jest.fn(),
  getLatestApplicationRuns: jest.fn(),
}));

jest.mock('../utils/IngestionLogs/LogsUtils', () => ({
  downloadAppLogs: jest.fn(),
  downloadIngestionLog: jest.fn().mockResolvedValue(new Blob(['x'])),
}));

jest.mock('../components/ServiceAgents/utils/agentsDataMapper', () => ({
  getLogTaskFieldForType: (log: { ingestion_task?: string }) =>
    log.ingestion_task ?? '',
}));

jest.mock('../utils/EntityNameUtils', () => ({
  getEntityName: (entity?: { name?: string }) => entity?.name ?? '',
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../components/common/LogViewerModal/useLogStream', () => ({
  useLogStream: jest.fn(),
  getIngestionLogStreamUrl: (fqn: string, runId: string) =>
    `/stream/${fqn}/${runId}`,
}));

const mockUseLogStream = useLogStream as jest.Mock;

const IDLE_STREAM: UseLogStreamResult = {
  logs: '',
  loading: false,
  streamDone: false,
  endReason: undefined,
  truncated: false,
  error: null,
  health: 'connecting',
};

const streamState = (
  overrides: Partial<UseLogStreamResult> = {}
): UseLogStreamResult => ({
  ...IDLE_STREAM,
  ...overrides,
});

const RUNNING_PIPELINE = {
  id: 'pid',
  fullyQualifiedName: 'svc.pipeline',
  name: 'My Pipeline',
  pipelineType: 'Metadata',
  pipelineStatuses: [{ pipelineState: PipelineState.Running, runId: 'run-1' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLogStream.mockReturnValue(IDLE_STREAM);
});

describe('useEntityLogs', () => {
  beforeAll(() => {
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
  });

  it('loads ingestion pipeline logs and derives pagination', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      fullyQualifiedName: 'svc.pipeline',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1\nline2', after: '2', total: '4' },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1\nline2'));

    expect(result.current.title).toBe('My Pipeline');
    expect(result.current.totalLines).toBe(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('does not fetch logs until the fqn is known', async () => {
    // Logs are fetched by fqn; a pipeline with an id but no fqn yet must not
    // fire a request for `/logs//last`.
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });

    renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(getIngestionPipelineByFqn).toHaveBeenCalled());

    expect(getIngestionPipelineLogById).not.toHaveBeenCalled();
  });

  it('appends the next page when loadMore is called', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      fullyQualifiedName: 'svc.pipeline',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock)
      .mockResolvedValueOnce({
        data: { ingestion_task: 'line1', after: '1', total: '2' },
      })
      // Last page omits `after` (backend behaviour) → tail, hasMore=false.
      .mockResolvedValueOnce({
        data: { ingestion_task: 'line2' },
      });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1'));

    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.logs).toBe('line1line2'));

    expect(result.current.hasMore).toBe(false);
  });

  it('loads application logs without pagination', async () => {
    (getApplicationByName as jest.Mock).mockResolvedValue({ name: 'My App' });
    (getExternalApplicationRuns as jest.Mock).mockResolvedValue({ data: [] });
    (getLatestApplicationRuns as jest.Mock).mockResolvedValue({
      data_insight_task: '',
      application_task: 'app log line',
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: GlobalSettingOptions.APPLICATIONS,
        fqn: 'my-app',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('app log line'));

    expect(result.current.hasMore).toBe(false);
    expect(result.current.title).toBe('My App');
  });

  it('ignores a stale app-log response after runId changes', async () => {
    let resolveFirstApp: (value: { name: string }) => void = (_value) =>
      undefined;
    (getApplicationByName as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise<{ name: string }>((resolve) => {
            resolveFirstApp = resolve;
          })
      )
      .mockResolvedValue({ name: 'My App' });
    (getExternalApplicationRuns as jest.Mock).mockResolvedValue({ data: [] });
    (getLatestApplicationRuns as jest.Mock).mockImplementation(
      (_fqn: string, runId?: string) =>
        Promise.resolve({ application_task: `${runId}-logs` })
    );

    const { result, rerender } = renderHook(
      ({ runId }) =>
        useEntityLogs({
          logEntityType: GlobalSettingOptions.APPLICATIONS,
          fqn: 'my-app',
          runId,
        }),
      { initialProps: { runId: 'A' } }
    );

    // Switch to run B while run A's getApplicationByName is still pending.
    rerender({ runId: 'B' });

    await waitFor(() => expect(result.current.logs).toBe('B-logs'));

    // Now let run A resolve — its chain must be invalidated, not applied.
    await act(async () => {
      resolveFirstApp({ name: 'My App' });
    });

    expect(result.current.logs).toBe('B-logs');
  });

  it('downloads ingestion logs and resets the progress store', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      fullyQualifiedName: 'svc.pipeline',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1', after: '4', total: '4' },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1'));

    await act(async () => {
      await result.current.download();
    });

    // Logs are fetched/downloaded by fqn (not id) so the backend needs no id -> fqn lookup.
    expect(downloadIngestionLog).toHaveBeenCalledWith('svc.pipeline');
    expect(mockUpdateProgress).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
  });
});

describe('useEntityLogs — live (polling) state', () => {
  it('is live while the ingestion run is running', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      fullyQualifiedName: 'svc.pipeline',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
      pipelineStatuses: [{ pipelineState: PipelineState.Running }],
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1', after: '4', total: '4' },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.isLive).toBe(true));
  });

  it('is not live once the ingestion run reaches a terminal state', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      id: 'pid',
      fullyQualifiedName: 'svc.pipeline',
      name: 'My Pipeline',
      pipelineType: 'Metadata',
      pipelineStatuses: [{ pipelineState: PipelineState.Success }],
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'line1', after: '4', total: '4' },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('line1'));

    expect(result.current.isLive).toBe(false);
  });

  it('does not stream a run whose id is unknown, and keeps polling instead', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue({
      ...RUNNING_PIPELINE,
      pipelineStatuses: [{ pipelineState: PipelineState.Running }],
    });
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'polled', after: '4', total: '4' },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('polled'));

    expect(result.current.isStreaming).toBe(false);
    expect(mockUseLogStream).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('is live while an application run is in progress', async () => {
    (getApplicationByName as jest.Mock).mockResolvedValue({ name: 'My App' });
    (getExternalApplicationRuns as jest.Mock).mockResolvedValue({ data: [] });
    (getLatestApplicationRuns as jest.Mock).mockResolvedValue({
      data_insight_task: '',
      application_task: 'app log',
      pipelineStatus: { pipelineState: PipelineState.Running },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: GlobalSettingOptions.APPLICATIONS,
        fqn: 'my-app',
      })
    );

    await waitFor(() => expect(result.current.isLive).toBe(true));
  });
});

describe('useEntityLogs — SSE tail', () => {
  it('serves the stream and leaves the paginated endpoint alone while live', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue(
      RUNNING_PIPELINE
    );
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'polled', after: '4', total: '4' },
    });
    mockUseLogStream.mockReturnValue(
      streamState({ logs: 'streamed line\n', health: 'live' })
    );

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    expect(result.current.logs).toBe('streamed line\n');
    expect(result.current.isLive).toBe(true);
    expect(result.current.streamHealth).toBe('live');
    expect(result.current.hasMore).toBe(false);
    expect(getIngestionPipelineLogById).not.toHaveBeenCalled();
    expect(mockUseLogStream).toHaveBeenCalledWith({
      streamUrl: '/stream/svc.pipeline/run-1',
      enabled: true,
    });
  });

  it('hands back to the paginated endpoint once the stream says the run finished', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue(
      RUNNING_PIPELINE
    );
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'final log' },
    });
    mockUseLogStream.mockReturnValue(
      streamState({
        logs: 'streamed line\n',
        streamDone: true,
        endReason: LogStreamEndReason.RunFinished,
      })
    );

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('final log'));

    expect(result.current.isLive).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(getIngestionPipelineLogById).toHaveBeenCalled();
  });

  it('falls back to the paginated path when the stream gives up mid-run', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue(
      RUNNING_PIPELINE
    );
    (getIngestionPipelineLogById as jest.Mock).mockResolvedValue({
      data: { ingestion_task: 'polled', after: '4', total: '4' },
    });
    mockUseLogStream.mockReturnValue(
      streamState({
        streamDone: true,
        error: 'No log backend is configured on this deployment.',
        health: 'unavailable',
      })
    );

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('polled'));

    // The run is still going, so the live indicator stays on and the
    // paginated + polling path takes over.
    expect(result.current.isLive).toBe(true);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError).toBe(
      'No log backend is configured on this deployment.'
    );
  });

  it('reports a truncated backlog to the viewer', async () => {
    (getIngestionPipelineByFqn as jest.Mock).mockResolvedValue(
      RUNNING_PIPELINE
    );
    mockUseLogStream.mockReturnValue(
      streamState({ logs: 'tail only\n', truncated: true, health: 'live' })
    );

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      })
    );

    await waitFor(() => expect(result.current.streamTruncated).toBe(true));
  });

  it('never streams for an application run', async () => {
    (getApplicationByName as jest.Mock).mockResolvedValue({ name: 'My App' });
    (getExternalApplicationRuns as jest.Mock).mockResolvedValue({ data: [] });
    (getLatestApplicationRuns as jest.Mock).mockResolvedValue({
      application_task: 'app log',
      pipelineStatus: { pipelineState: PipelineState.Running },
    });

    const { result } = renderHook(() =>
      useEntityLogs({
        logEntityType: GlobalSettingOptions.APPLICATIONS,
        fqn: 'my-app',
      })
    );

    await waitFor(() => expect(result.current.logs).toBe('app log'));

    expect(result.current.isStreaming).toBe(false);
    expect(mockUseLogStream).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });
});
