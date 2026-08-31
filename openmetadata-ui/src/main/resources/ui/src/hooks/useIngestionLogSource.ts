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

import { useCallback, useMemo } from 'react';
import {
  getIngestionLogStreamUrl,
  useLogStream,
} from '../components/common/LogViewerModal/useLogStream';
import { getLogTaskFieldForType } from '../components/ServiceAgents/utils/agentsDataMapper';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { LogStreamEndReason } from '../generated/entity/services/ingestionPipelines/logStreamEvent';
import { getIngestionPipelineLogById } from '../rest/ingestionPipelineAPI';
import { StreamHealth } from '../utils/SseStreamUtils';
import { usePaginatedLiveLog } from './usePaginatedLiveLog';

export interface UseIngestionLogSourceParams {
  // False for entity kinds that have no ingestion log at all (applications).
  enabled: boolean;
  ingestionFqn: string;
  ingestionType?: PipelineType;
  // Run the log belongs to; without one there is nothing to stream.
  runId?: string;
  // The run's own state says it is still producing output.
  runActive: boolean;
}

export interface UseIngestionLogSourceResult {
  logs: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  isLive: boolean;
  isStreaming: boolean;
  // The stream itself reported the run's end — the caller refreshes the run's
  // status once on this edge instead of polling for it.
  runFinishedOnStream: boolean;
  streamHealth: StreamHealth;
  streamTruncated: boolean;
  streamError: string | null;
  loadMore: () => void;
}

/**
 * Serves one ingestion run's log from whichever source fits its state: the SSE
 * tail while the run is live, the paginated REST endpoint for the backlog and
 * for finished runs.
 *
 * The two never run at once, so nothing has to be de-duplicated. The hand-over
 * happens on the live -> terminal edge, where re-enabling the paginated reader
 * triggers the single authoritative refetch of the finished run. A stream that
 * gives up for any reason other than the run finishing (no log backend on this
 * deployment, capacity, repeated transport failures) hands the still-running job
 * back to the paginated + polling path rather than freezing the viewer.
 */
export const useIngestionLogSource = ({
  enabled,
  ingestionFqn,
  ingestionType,
  runId,
  runActive,
}: UseIngestionLogSourceParams): UseIngestionLogSourceResult => {
  const hasLog = enabled && Boolean(ingestionFqn);
  const canStream = hasLog && Boolean(runId);

  const streamUrl = useMemo(
    () =>
      canStream ? getIngestionLogStreamUrl(ingestionFqn, runId ?? '') : '',
    [canStream, ingestionFqn, runId]
  );

  // The stream stops itself once it reaches a terminal frame, so it is safe to
  // leave `enabled` on for the whole active run — it will not reconnect after
  // the run finishes.
  const stream = useLogStream({
    streamUrl,
    enabled: canStream && runActive,
  });

  const runFinishedOnStream =
    stream.endReason === LogStreamEndReason.RunFinished;
  const streamGaveUp = stream.streamDone && !runFinishedOnStream;

  const isLive = runActive && !runFinishedOnStream;
  const isStreaming = canStream && isLive && !streamGaveUp;

  const fetchPage = useCallback(
    (cursor?: string) =>
      getIngestionPipelineLogById(ingestionFqn, cursor).then((res) => ({
        content: ingestionType
          ? getLogTaskFieldForType(res.data, ingestionType)
          : '',
        after: res.data.after,
        total: res.data.total,
      })),
    [ingestionFqn, ingestionType]
  );

  const paginatedEnabled = hasLog && !isStreaming;
  const paginated = usePaginatedLiveLog({
    fetchPage,
    resetKey: ingestionFqn,
    enabled: paginatedEnabled,
    isLive: paginatedEnabled && isLive,
  });

  // Keep showing what the stream delivered until the paginated refetch that
  // follows the run's end has content of its own, so the viewer never blanks on
  // the hand-over. `stream.logs` is only ever non-empty on the streaming path.
  const showStreamLogs =
    Boolean(stream.logs) && (isStreaming || !paginated.logs);

  return {
    logs: showStreamLogs ? stream.logs : paginated.logs,
    loading: showStreamLogs ? stream.loading : paginated.loading,
    loadingMore: paginated.loadingMore,
    hasMore: showStreamLogs ? false : paginated.hasMore,
    isLive,
    isStreaming,
    runFinishedOnStream,
    streamHealth: stream.health,
    streamTruncated: stream.truncated,
    streamError: stream.error,
    loadMore: paginated.loadMore,
  };
};
