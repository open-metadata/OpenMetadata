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

import { renderHook, waitFor } from '@testing-library/react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { LogStreamEndReason } from '../../../generated/entity/services/ingestionPipelines/logStreamEvent';
import { getIngestionPipelineLogById } from '../../../rest/ingestionPipelineAPI';
import {
  useLogStream,
  UseLogStreamResult,
} from '../../common/LogViewerModal/useLogStream';
import { useAgentLogs } from './useAgentLogs';

jest.mock('../../common/LogViewerModal/useLogStream', () => ({
  useLogStream: jest.fn(),
  getIngestionLogStreamUrl: (fqn: string, runId: string) =>
    `/stream/${fqn}/${runId}`,
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineLogById: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUseLogStream = useLogStream as jest.Mock;
const mockGetLogs = getIngestionPipelineLogById as jest.Mock;

const IDLE_STREAM: UseLogStreamResult = {
  logs: '',
  loading: false,
  streamDone: false,
  endReason: undefined,
  truncated: false,
  error: null,
  health: 'connecting',
};

const FQN = 'sample_data.metadata_agent';
const RUN_ID = 'scheduled__2026-08-11T00:00:00+00:00';

const renderAgentLogs = (isActive: boolean, runId?: string) =>
  renderHook(() =>
    useAgentLogs(FQN, PipelineType.Metadata, true, isActive, runId)
  );

describe('useAgentLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLogStream.mockReturnValue(IDLE_STREAM);
    mockGetLogs.mockResolvedValue({
      data: { ingestion_task: 'polled line' },
    });
  });

  it('tails a live run over the stream and never polls the log endpoint', async () => {
    mockUseLogStream.mockReturnValue({
      ...IDLE_STREAM,
      logs: '[2026-08-11 00:00:00] INFO {reader} - streamed line\n',
      health: 'live',
    });

    const { result } = renderAgentLogs(true, RUN_ID);

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    expect(result.current.rawText).toContain('streamed line');
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.streamHealth).toBe('live');
    expect(mockGetLogs).not.toHaveBeenCalled();
    expect(mockUseLogStream).toHaveBeenCalledWith({
      streamUrl: `/stream/${FQN}/${RUN_ID}`,
      enabled: true,
    });
  });

  it('falls back to the paginated endpoint when the run id is unknown', async () => {
    const { result } = renderAgentLogs(true);

    await waitFor(() => expect(result.current.rawText).toBe('polled line'));

    expect(result.current.isStreaming).toBe(false);
    expect(mockGetLogs).toHaveBeenCalledWith(FQN, undefined);
    expect(mockUseLogStream).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('reads a finished run from the paginated endpoint', async () => {
    const { result } = renderAgentLogs(false, RUN_ID);

    await waitFor(() => expect(result.current.rawText).toBe('polled line'));

    expect(result.current.isStreaming).toBe(false);
    expect(mockUseLogStream).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('stops reporting the run as live once the stream says it finished', async () => {
    // The agent's own status row still says running at this point — only the
    // stream knows the run is over, and the viewer's live indicator is driven
    // from here.
    mockUseLogStream.mockReturnValue({
      ...IDLE_STREAM,
      logs: 'done\n',
      streamDone: true,
      endReason: LogStreamEndReason.RunFinished,
    });

    const { result } = renderAgentLogs(true, RUN_ID);

    await waitFor(() => expect(result.current.isLive).toBe(false));

    expect(result.current.isStreaming).toBe(false);
  });

  it('keeps reporting a still-running agent as live while it streams', async () => {
    mockUseLogStream.mockReturnValue({
      ...IDLE_STREAM,
      logs: 'tailing\n',
      health: 'live',
    });

    const { result } = renderAgentLogs(true, RUN_ID);

    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    expect(result.current.isLive).toBe(true);
  });

  it('surfaces a stream failure and hands the live run back to polling', async () => {
    mockUseLogStream.mockReturnValue({
      ...IDLE_STREAM,
      streamDone: true,
      error: 'No log backend is configured on this deployment.',
      health: 'unavailable',
    });

    const { result } = renderAgentLogs(true, RUN_ID);

    await waitFor(() => expect(result.current.rawText).toBe('polled line'));

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamError).toBe(
      'No log backend is configured on this deployment.'
    );
  });
});
