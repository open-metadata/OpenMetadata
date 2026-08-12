/*
 *  Copyright 2025 Collate.
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

import { useMemo } from 'react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useIngestionLogSource } from '../../../hooks/useIngestionLogSource';
import { StreamHealth } from '../../../utils/SseStreamUtils';
import { LogLine } from '../AgentsPage.interface';
import { parseLogLines } from '../utils/agentsDataMapper';

interface UseAgentLogsResult {
  lines: LogLine[];
  rawText: string;
  isLoading: boolean;
  hasMore: boolean;
  // The run is still producing output. False once the stream reports the run
  // finished, which lands before the agent's own status row catches up.
  isLive: boolean;
  isStreaming: boolean;
  streamHealth: StreamHealth;
  streamTruncated: boolean;
  streamError: string | null;
  loadMore: () => void;
}

/**
 * Reads one agent run's logs and parses the accumulated text into LogLine[].
 *
 * Source selection — SSE tail while the run is live, paginated REST otherwise —
 * lives in {@link useIngestionLogSource}, shared with the pipeline log viewer so
 * the two cannot drift apart. A run with no known id (the agent list has not
 * caught up, or the deployment reports no run) simply stays on the paginated
 * path.
 */
export const useAgentLogs = (
  fqn: string,
  pipelineType: PipelineType,
  enabled: boolean,
  isActive = false,
  runId?: string
): UseAgentLogsResult => {
  const source = useIngestionLogSource({
    enabled: Boolean(enabled && fqn),
    ingestionFqn: fqn,
    ingestionType: pipelineType,
    runId,
    runActive: isActive,
  });

  const lines = useMemo(() => parseLogLines(source.logs), [source.logs]);

  return {
    lines,
    rawText: source.logs,
    isLoading: source.loading,
    hasMore: source.hasMore,
    isLive: source.isLive,
    isStreaming: source.isStreaming,
    streamHealth: source.streamHealth,
    streamTruncated: source.streamTruncated,
    streamError: source.streamError,
    loadMore: source.loadMore,
  };
};
